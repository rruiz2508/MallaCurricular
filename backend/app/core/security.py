"""Autenticación y autorización.

Flujo de una petición protegida:

1. El frontend inicia sesión con Supabase Auth y recibe un JWT (access token).
2. Envía ese JWT en la cabecera ``Authorization: Bearer <token>``.
3. Aquí se verifica la firma del token con las claves públicas (JWKS) del proyecto
   Supabase, de modo que no hace falta guardar ningún secreto en el backend.
4. Con el ``sub`` del token (el id del usuario) se cargan desde la base el perfil, los
   roles y los permisos efectivos.
5. Cada endpoint declara qué permiso necesita con :func:`require_permission`.

La autorización se valida siempre en este backend; las políticas RLS de la base son solo
un control complementario (el backend se conecta con un rol que las omite).
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import get_settings
from app.core.db import get_connection

# auto_error=False: si falta la cabecera no se responde 403 automáticamente, así
# controlamos nosotros el mensaje y el código (401) en get_current_user.
bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    """Usuario autenticado de la petición en curso, con sus roles y permisos efectivos."""

    id: UUID
    email: str | None
    nombre: str
    apellido: str
    roles: list[str]
    # Unión de los permisos de todos sus roles activos (p. ej. "facultades.leer").
    permisos: set[str]


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    """Cliente de claves públicas de Supabase.

    Se crea una sola vez (lru_cache) para reutilizar su caché interna y no descargar
    el JWKS en cada petición. Si falta ``SUPABASE_URL`` se responde 503 (igual que
    ``db.py`` cuando falta ``DATABASE_URL``) en lugar de fallar con un 500.
    """
    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL no está configurada",
        )
    return jwt.PyJWKClient(settings.jwks_url, cache_keys=True)


def _unauthorized(detail: str) -> HTTPException:
    """Respuesta 401 estándar, con la cabecera que indica el esquema Bearer."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_token(token: str) -> dict[str, object]:
    """Verifica la firma y las reclamaciones del JWT y devuelve su contenido.

    Se comprueba que el token lo haya emitido nuestro proyecto Supabase (``iss``), que
    sea para usuarios autenticados (``aud``) y que no haya vencido. Cualquier fallo se
    traduce en un 401 sin revelar el motivo exacto.
    """
    settings = get_settings()
    try:
        # La clave se elige según el "kid" de la cabecera del token.
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.jwt_issuer,
            # Sin estas reclamaciones el token no identifica a un usuario válido ni
            # caduca, así que no debe aceptarse.
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized("Token inválido o vencido") from exc


async def get_token_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict[str, object]:
    """Dependencia de FastAPI: valida el token Bearer y devuelve sus reclamaciones.

    No usa la base de datos, por lo que una petición sin sesión válida se rechaza con
    401 antes de abrir ninguna conexión.
    """
    if credentials is None:
        raise _unauthorized("Falta el token de autenticación")
    return _decode_token(credentials.credentials)


async def get_current_user(
    # El orden importa: FastAPI resuelve los parámetros de izquierda a derecha, así que
    # el token se valida (y se rechaza con 401) antes de abrir la conexión a la base.
    claims: Annotated[dict[str, object], Depends(get_token_claims)],
    conn: Annotated[AsyncConnection, Depends(get_connection)],
) -> CurrentUser:
    """Dependencia de FastAPI: resuelve el usuario autenticado de la petición.

    Falla con 401 si no hay token o es inválido, y con 403 si el usuario no existe en
    ``seguridad.usuario`` o está desactivado.
    """
    # Un token firmado pero con un "sub" que no es UUID se rechaza como 401: sin esta
    # conversión controlada, ``UUID()`` lanzaría ValueError y la API respondería 500.
    try:
        user_id = UUID(str(claims.get("sub")))
    except (TypeError, ValueError) as exc:
        raise _unauthorized("Token sin identificador de usuario válido") from exc

    # Perfil del usuario (la fila la crea un trigger al darlo de alta en Supabase Auth).
    row = (
        await conn.execute(
            text("select email, nombre, apellido, activo from seguridad.usuario where id = :id"),
            {"id": user_id},
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no está registrado en el sistema",
        )
    if not row.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

    # Roles activos del usuario y los permisos de cada uno. Los left join permiten que un
    # rol sin permisos igualmente aparezca en la lista de roles.
    rows = (
        await conn.execute(
            text(
                """
                select r.nombre as rol, p.codigo as permiso
                from seguridad.usuario_rol ur
                join seguridad.rol r on r.id = ur.rol_id and r.activo
                left join seguridad.rol_permiso rp on rp.rol_id = r.id
                left join seguridad.permiso p on p.id = rp.permiso_id
                where ur.usuario_id = :id
                """
            ),
            {"id": user_id},
        )
    ).all()
    return CurrentUser(
        id=user_id,
        email=row.email,
        nombre=row.nombre,
        apellido=row.apellido,
        roles=sorted({r.rol for r in rows}),
        permisos={r.permiso for r in rows if r.permiso},
    )


def require_permission(codigo: str) -> Callable[..., Awaitable[CurrentUser]]:
    """Crea una dependencia que exige que el usuario tenga el permiso ``codigo``.

    Uso::

        @router.get("", dependencies=[Depends(require_permission("facultades.leer"))])

    Responde 401 si no hay sesión válida y 403 si falta el permiso.
    """

    async def checker(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if codigo not in user.permisos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"Falta el permiso {codigo}"
            )
        return user

    return checker
