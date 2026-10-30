"""Módulo de roles y permisos.

Los permisos son un catálogo fijo (cada endpoint declara el código que exige), así que
solo se listan y se asignan a roles. Los roles sí se pueden crear, editar y eliminar; los
roles de sistema están protegidos por triggers en la base (no se renombran ni se borran).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.api.v1.common import Conn, Entrada, rechazar_nulos, regla_de_negocio
from app.core.security import require_permission

router = APIRouter(tags=["roles"])


class PermisoOut(BaseModel):
    """Permiso del catálogo, agrupado por módulo en la interfaz."""

    id: UUID
    codigo: str
    modulo: str
    descripcion: str


class RolOut(BaseModel):
    """Rol con los códigos de los permisos que tiene asignados."""

    id: UUID
    nombre: str
    descripcion: str | None
    es_sistema: bool
    activo: bool
    permisos: list[str]
    usuarios: int


def _codigos_unicos(codigos: list[str]) -> list[str]:
    """Elimina duplicados y espacios, conservando el orden."""
    return list(dict.fromkeys(c.strip() for c in codigos if c.strip()))


class RolIn(Entrada):
    """Datos para crear un rol."""

    nombre: str = Field(min_length=1, max_length=100)
    descripcion: str | None = Field(default=None, max_length=500)
    activo: bool = True
    permisos: list[str] = Field(default_factory=list)

    @field_validator("permisos")
    @classmethod
    def _normalizar(cls, valor: list[str]) -> list[str]:
        return _codigos_unicos(valor)


class RolUpdate(Entrada):
    """Datos para editar un rol. Solo se actualizan los campos enviados; ``permisos``
    reemplaza el conjunto completo de permisos del rol."""

    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    descripcion: str | None = Field(default=None, max_length=500)
    activo: bool | None = None
    permisos: list[str] | None = None

    @field_validator("permisos")
    @classmethod
    def _normalizar(cls, valor: list[str] | None) -> list[str] | None:
        return None if valor is None else _codigos_unicos(valor)

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        # La descripción sí puede quedar en null (se borra); el resto no.
        return rechazar_nulos(data, {"nombre", "activo", "permisos"})


# Un rol por fila con sus permisos agregados y la cantidad de usuarios que lo tienen.
_SELECT_ROL = """
    select r.id, r.nombre, r.descripcion, r.es_sistema, r.activo,
           coalesce(array_agg(p.codigo order by p.codigo) filter (where p.codigo is not null),
                    '{}') as permisos,
           (select count(*) from seguridad.usuario_rol ur where ur.rol_id = r.id) as usuarios
    from seguridad.rol r
    left join seguridad.rol_permiso rp on rp.rol_id = r.id
    left join seguridad.permiso p on p.id = rp.permiso_id
"""


def _rol(row: object) -> RolOut:
    return RolOut(**row._mapping)  # type: ignore[attr-defined]


async def _obtener(conn: AsyncConnection, rol_id: UUID) -> RolOut:
    row = (
        await conn.execute(text(_SELECT_ROL + " where r.id = :id group by r.id"), {"id": rol_id})
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    return _rol(row)


async def _resolver_permisos(conn: AsyncConnection, codigos: list[str]) -> list[UUID]:
    """Convierte códigos de permiso en ids; 422 si alguno no existe en el catálogo."""
    rows = (
        await conn.execute(
            text("select id, codigo from seguridad.permiso where codigo = any(:codigos)"),
            {"codigos": codigos},
        )
    ).all()
    desconocidos = sorted(set(codigos) - {r.codigo for r in rows})
    if desconocidos:
        raise HTTPException(
            status_code=422,
            detail=f"Permisos inexistentes: {', '.join(desconocidos)}",
        )
    return [r.id for r in rows]


async def _asignar_permisos(conn: AsyncConnection, rol_id: UUID, codigos: list[str]) -> None:
    """Deja al rol con exactamente los permisos indicados.

    Solo se borran los que sobran y se agregan los que faltan, así el trigger que protege
    al rol administrador únicamente se dispara si realmente se le quita un permiso.
    """
    ids = await _resolver_permisos(conn, codigos)
    await conn.execute(
        text(
            "delete from seguridad.rol_permiso "
            "where rol_id = :rol and not (permiso_id = any(cast(:ids as uuid[])))"
        ),
        {"rol": rol_id, "ids": ids},
    )
    await conn.execute(
        text(
            "insert into seguridad.rol_permiso (rol_id, permiso_id) "
            "select :rol, p from unnest(cast(:ids as uuid[])) as p "
            "on conflict do nothing"
        ),
        {"rol": rol_id, "ids": ids},
    )


@router.get(
    "/permisos",
    response_model=list[PermisoOut],
    dependencies=[Depends(require_permission("roles.leer"))],
)
async def listar_permisos(conn: Conn) -> list[PermisoOut]:
    """Catálogo de permisos ordenado por módulo y código. Requiere ``roles.leer``."""
    rows = await conn.execute(
        text(
            "select id, codigo, modulo, descripcion from seguridad.permiso order by modulo, codigo"
        )
    )
    return [PermisoOut(**r._mapping) for r in rows]


@router.get(
    "/roles",
    response_model=list[RolOut],
    dependencies=[Depends(require_permission("roles.leer"))],
)
async def listar(conn: Conn) -> list[RolOut]:
    """Lista los roles con sus permisos. Requiere ``roles.leer``."""
    rows = await conn.execute(
        text(_SELECT_ROL + " group by r.id order by r.es_sistema desc, r.nombre")
    )
    return [_rol(r) for r in rows]


@router.post(
    "/roles",
    response_model=RolOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("roles.gestionar"))],
)
async def crear(data: RolIn, conn: Conn) -> RolOut:
    """Crea un rol con los permisos indicados. Requiere ``roles.gestionar``.

    Responde 409 si el nombre ya existe y 422 si algún permiso no existe.
    """
    try:
        rol_id = (
            await conn.execute(
                text(
                    "insert into seguridad.rol (nombre, descripcion, activo) "
                    "values (:nombre, :descripcion, :activo) returning id"
                ),
                data.model_dump(include={"nombre", "descripcion", "activo"}),
            )
        ).scalar_one()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya existe un rol con ese nombre"
        ) from exc
    await _asignar_permisos(conn, rol_id, data.permisos)
    return await _obtener(conn, rol_id)


@router.patch(
    "/roles/{rol_id}",
    response_model=RolOut,
    dependencies=[Depends(require_permission("roles.gestionar"))],
)
async def actualizar(rol_id: UUID, data: RolUpdate, conn: Conn) -> RolOut:
    """Edita un rol y/o reemplaza sus permisos. Requiere ``roles.gestionar``.

    Responde 400 sin cambios, 404 si no existe y 409 si el nombre choca o si se intenta
    alterar un rol protegido (renombrar un rol de sistema, desactivar o quitar permisos
    al administrador).
    """
    cambios = data.model_dump(exclude_unset=True)
    permisos = cambios.pop("permisos", None)
    if not cambios and permisos is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _obtener(conn, rol_id)  # 404 temprano
    try:
        if cambios:
            # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
            asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
            await conn.execute(
                text(f"update seguridad.rol set {asignaciones} where id = :id"),
                {**cambios, "id": rol_id},
            )
        if permisos is not None:
            await _asignar_permisos(conn, rol_id, permisos)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya existe un rol con ese nombre"
        ) from exc
    except DBAPIError as exc:
        regla = regla_de_negocio(exc)
        if regla is None:
            raise
        raise regla from exc
    return await _obtener(conn, rol_id)


@router.delete(
    "/roles/{rol_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("roles.gestionar"))],
)
async def eliminar(rol_id: UUID, conn: Conn) -> None:
    """Elimina un rol. Requiere ``roles.gestionar``.

    Responde 404 si no existe y 409 si es un rol de sistema o si aún tiene usuarios.
    """
    rol = await _obtener(conn, rol_id)
    if rol.usuarios:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El rol tiene {rol.usuarios} usuario(s) asignado(s); quítelo primero",
        )
    try:
        await conn.execute(text("delete from seguridad.rol where id = :id"), {"id": rol_id})
    except DBAPIError as exc:
        regla = regla_de_negocio(exc)
        if regla is None:
            raise
        raise regla from exc
