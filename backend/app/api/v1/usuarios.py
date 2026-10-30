"""Módulo de usuarios: listado, alta, edición, asignación de roles y cambio de contraseña.

El alta se hace en Supabase Auth (Admin API); un trigger de la base crea el perfil en
``seguridad.usuario`` y aquí se le asignan los roles. Los roles de un usuario se editan
enviando la lista completa (reemplazo).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.api.v1.common import Conn, Entrada, rechazar_nulos
from app.core import supabase_admin
from app.core.security import CurrentUser, require_permission

router = APIRouter(tags=["usuarios"])

# La contraseña no se recorta: los espacios forman parte de ella. 72 es el máximo que
# admite bcrypt, el algoritmo con que Supabase Auth guarda las contraseñas.
Password = Annotated[str, StringConstraints(strip_whitespace=False, min_length=8, max_length=72)]
Email = Annotated[str, StringConstraints(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]


class RolRef(BaseModel):
    """Referencia mínima a un rol asignado a un usuario."""

    id: UUID
    nombre: str


class RolDisponible(RolRef):
    """Rol que se puede asignar desde el formulario de usuarios."""

    descripcion: str | None


class UsuarioOut(BaseModel):
    id: UUID
    email: str | None
    nombre: str
    apellido: str
    activo: bool
    roles: list[RolRef]


class UsuarioIn(Entrada):
    """Datos para crear un usuario."""

    email: Email
    password: Password
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(default="", max_length=100)
    roles: list[UUID] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def _minusculas(cls, valor: str) -> str:
        return valor.lower()


class UsuarioUpdate(Entrada):
    """Datos para editar un usuario. Solo se actualizan los campos enviados; ``roles``
    reemplaza el conjunto completo de roles."""

    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    apellido: str | None = Field(default=None, max_length=100)
    activo: bool | None = None
    roles: list[UUID] | None = None

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        return rechazar_nulos(data, {"nombre", "apellido", "activo", "roles"})


class PasswordIn(Entrada):
    password: Password


# Un usuario por fila; los ids y nombres de sus roles se agregan en el mismo orden.
_SELECT_USUARIO = """
    select u.id, u.email, u.nombre, u.apellido, u.activo,
           coalesce(array_agg(r.id order by r.nombre) filter (where r.id is not null),
                    '{}') as rol_ids,
           coalesce(array_agg(r.nombre order by r.nombre) filter (where r.id is not null),
                    '{}') as rol_nombres
    from seguridad.usuario u
    left join seguridad.usuario_rol ur on ur.usuario_id = u.id
    left join seguridad.rol r on r.id = ur.rol_id
"""


def _usuario(row: object) -> UsuarioOut:
    m = row._mapping  # type: ignore[attr-defined]
    return UsuarioOut(
        id=m["id"],
        email=m["email"],
        nombre=m["nombre"],
        apellido=m["apellido"],
        activo=m["activo"],
        roles=[RolRef(id=i, nombre=n) for i, n in zip(m["rol_ids"], m["rol_nombres"], strict=True)],
    )


async def _obtener(conn: AsyncConnection, usuario_id: UUID) -> UsuarioOut:
    row = (
        await conn.execute(
            text(_SELECT_USUARIO + " where u.id = :id group by u.id"), {"id": usuario_id}
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return _usuario(row)


async def _validar_roles(conn: AsyncConnection, roles: list[UUID]) -> list[UUID]:
    """Quita duplicados y comprueba que todos los roles existan (422 si no)."""
    unicos = list(dict.fromkeys(roles))
    existentes = {
        r.id
        for r in await conn.execute(
            text("select id from seguridad.rol where id = any(cast(:ids as uuid[]))"),
            {"ids": unicos},
        )
    }
    if existentes != set(unicos):
        raise HTTPException(status_code=422, detail="Algún rol no existe")
    return unicos


async def _asignar_roles(conn: AsyncConnection, usuario_id: UUID, roles: list[UUID]) -> None:
    """Deja al usuario con exactamente los roles indicados."""
    await conn.execute(
        text(
            "delete from seguridad.usuario_rol "
            "where usuario_id = :u and not (rol_id = any(cast(:ids as uuid[])))"
        ),
        {"u": usuario_id, "ids": roles},
    )
    await conn.execute(
        text(
            "insert into seguridad.usuario_rol (usuario_id, rol_id) "
            "select :u, r from unnest(cast(:ids as uuid[])) as r on conflict do nothing"
        ),
        {"u": usuario_id, "ids": roles},
    )


async def _quedan_administradores(conn: AsyncConnection, excluir: UUID) -> bool:
    """¿Hay otro administrador activo además de ``excluir``? Evita dejar el sistema sin
    nadie que pueda gestionar usuarios y roles."""
    return bool(
        (
            await conn.execute(
                text(
                    """
                    select exists (
                      select 1
                      from seguridad.usuario u
                      join seguridad.usuario_rol ur on ur.usuario_id = u.id
                      join seguridad.rol r on r.id = ur.rol_id and r.nombre = 'administrador'
                      where u.activo and u.id <> :id
                    )
                    """
                ),
                {"id": excluir},
            )
        ).scalar_one()
    )


@router.get(
    "/usuarios/roles",
    response_model=list[RolDisponible],
    dependencies=[Depends(require_permission("usuarios.leer"))],
)
async def roles_disponibles(conn: Conn) -> list[RolDisponible]:
    """Roles activos asignables. Requiere ``usuarios.leer`` (no exige ``roles.leer`` para
    que quien administra usuarios pueda elegir roles sin ver sus permisos)."""
    rows = await conn.execute(
        text("select id, nombre, descripcion from seguridad.rol where activo order by nombre")
    )
    return [RolDisponible(**r._mapping) for r in rows]


@router.get(
    "/usuarios",
    response_model=list[UsuarioOut],
    dependencies=[Depends(require_permission("usuarios.leer"))],
)
async def listar(conn: Conn) -> list[UsuarioOut]:
    """Lista los usuarios con sus roles. Requiere ``usuarios.leer``."""
    rows = await conn.execute(
        text(_SELECT_USUARIO + " group by u.id order by u.apellido, u.nombre, u.email")
    )
    return [_usuario(r) for r in rows]


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear(
    data: UsuarioIn,
    conn: Conn,
    actual: Annotated[CurrentUser, Depends(require_permission("usuarios.gestionar"))],
) -> UsuarioOut:
    """Crea el usuario en Supabase Auth y le asigna los roles. Requiere
    ``usuarios.gestionar``.

    Responde 409 si el correo ya existe, 422 si un rol no existe o la contraseña es débil
    y 503 si el backend no tiene la clave secreta de Supabase.
    """
    roles = await _validar_roles(conn, data.roles)
    usuario_id = await supabase_admin.crear_usuario(
        email=data.email,
        password=data.password,
        nombre=data.nombre,
        apellido=data.apellido,
        creado_por=actual.id,
    )
    try:
        # El trigger de la base ya creó el perfil; solo falta asignar los roles.
        await _asignar_roles(conn, usuario_id, roles)
        return await _obtener(conn, usuario_id)
    except BaseException:
        # Si algo falla después del alta en Auth, se elimina para no dejar un usuario
        # huérfano que existe en Auth pero no figura (o queda sin roles) en el sistema.
        await supabase_admin.eliminar_usuario(usuario_id)
        raise


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioOut)
async def actualizar(
    usuario_id: UUID,
    data: UsuarioUpdate,
    conn: Conn,
    actual: Annotated[CurrentUser, Depends(require_permission("usuarios.gestionar"))],
) -> UsuarioOut:
    """Edita datos, estado o roles de un usuario. Requiere ``usuarios.gestionar``.

    Responde 400 sin cambios, 404 si no existe y 409 si la edición dejaría al sistema sin
    administradores activos o si el usuario intenta desactivarse a sí mismo.
    """
    cambios = data.model_dump(exclude_unset=True)
    roles = cambios.pop("roles", None)
    if not cambios and roles is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")

    antes = await _obtener(conn, usuario_id)
    if usuario_id == actual.id and cambios.get("activo") is False:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="No puede desactivar su propio usuario"
        )

    # ¿Seguirá siendo un administrador activo después del cambio?
    era_admin = antes.activo and any(r.nombre == "administrador" for r in antes.roles)
    if era_admin:
        sigue_activo = cambios.get("activo", antes.activo)
        sigue_admin = True
        if roles is not None:
            nombres = {
                r.nombre
                for r in await conn.execute(
                    text("select nombre from seguridad.rol where id = any(cast(:ids as uuid[]))"),
                    {"ids": await _validar_roles(conn, roles)},
                )
            }
            sigue_admin = "administrador" in nombres
        if (not sigue_activo or not sigue_admin) and not await _quedan_administradores(
            conn, usuario_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Debe quedar al menos un administrador activo",
            )

    if cambios:
        # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
        asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
        await conn.execute(
            text(f"update seguridad.usuario set {asignaciones} where id = :id"),
            {**cambios, "id": usuario_id},
        )
    if roles is not None:
        await _asignar_roles(conn, usuario_id, await _validar_roles(conn, roles))
    return await _obtener(conn, usuario_id)


@router.put(
    "/usuarios/{usuario_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("usuarios.gestionar"))],
)
async def cambiar_password(usuario_id: UUID, data: PasswordIn, conn: Conn) -> None:
    """Establece una nueva contraseña para el usuario. Requiere ``usuarios.gestionar``."""
    await _obtener(conn, usuario_id)  # 404 si no existe
    await supabase_admin.cambiar_password(usuario_id, data.password)
