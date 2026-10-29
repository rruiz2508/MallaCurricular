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

bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: UUID
    email: str | None
    nombre: str
    apellido: str
    roles: list[str]
    permisos: set[str]


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(get_settings().jwks_url, cache_keys=True)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_token(token: str) -> dict[str, object]:
    settings = get_settings()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.jwt_issuer,
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized("Token inválido o vencido") from exc


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    conn: Annotated[AsyncConnection, Depends(get_connection)],
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized("Falta el token de autenticación")
    claims = _decode_token(credentials.credentials)
    user_id = UUID(str(claims["sub"]))

    row = (
        await conn.execute(
            text("select email, nombre, apellido, activo from seguridad.usuario where id = :id"),
            {"id": user_id},
        )
    ).first()
    if row is None or not row.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

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
    async def checker(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if codigo not in user.permisos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"Falta el permiso {codigo}"
            )
        return user

    return checker
