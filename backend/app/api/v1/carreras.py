"""Módulo de carreras: listado, alta, edición y baja.

La baja puede ser lógica (``activo = false``, siempre posible) o física (DELETE), que solo
procede si la carrera no tiene mallas ni promociones asociadas.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.api.v1.common import Conn, Entrada, rechazar_nulos, traducir_error
from app.core.security import require_permission

router = APIRouter(prefix="/carreras", tags=["carreras"])

_DUPLICADA = "Ya existe una carrera con ese código o nombre en la facultad"
_SIN_FACULTAD = "La facultad indicada no existe"


class CarreraIn(Entrada):
    """Datos para crear una carrera."""

    facultad_id: UUID
    codigo: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=200)
    titulo_otorgado: str | None = Field(default=None, max_length=200)
    duracion_semestres: int | None = Field(default=None, ge=1, le=20)
    activo: bool = True


class CarreraUpdate(Entrada):
    """Datos para editar una carrera. Solo se actualizan los campos enviados."""

    facultad_id: UUID | None = None
    codigo: str | None = Field(default=None, min_length=1, max_length=30)
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    titulo_otorgado: str | None = Field(default=None, max_length=200)
    duracion_semestres: int | None = Field(default=None, ge=1, le=20)
    activo: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        # El título y la duración sí pueden quedar vacíos (null); el resto no.
        return rechazar_nulos(data, {"facultad_id", "codigo", "nombre", "activo"})


class CarreraOut(BaseModel):
    id: UUID
    facultad_id: UUID
    facultad: str
    codigo: str
    nombre: str
    titulo_otorgado: str | None
    duracion_semestres: int | None
    activo: bool


_SELECT = """
    select c.id, c.facultad_id, f.nombre as facultad, c.codigo, c.nombre,
           c.titulo_otorgado, c.duracion_semestres, c.activo
    from academico.carrera c
    join academico.facultad f on f.id = c.facultad_id
"""


async def _obtener(conn: AsyncConnection, carrera_id: UUID) -> CarreraOut:
    row = (await conn.execute(text(_SELECT + " where c.id = :id"), {"id": carrera_id})).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Carrera no encontrada")
    return CarreraOut(**row._mapping)


@router.get(
    "",
    response_model=list[CarreraOut],
    dependencies=[Depends(require_permission("carreras.leer"))],
)
async def listar(conn: Conn) -> list[CarreraOut]:
    """Lista las carreras ordenadas por facultad y nombre. Requiere ``carreras.leer``."""
    rows = await conn.execute(text(_SELECT + " order by f.nombre, c.nombre"))
    return [CarreraOut(**r._mapping) for r in rows]


@router.post(
    "",
    response_model=CarreraOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("carreras.gestionar"))],
)
async def crear(data: CarreraIn, conn: Conn) -> CarreraOut:
    """Crea una carrera. Requiere ``carreras.gestionar``.

    Responde 409 si el código o el nombre ya existen en la facultad y 422 si la facultad
    no existe.
    """
    try:
        carrera_id = (
            await conn.execute(
                text(
                    "insert into academico.carrera "
                    "(facultad_id, codigo, nombre, titulo_otorgado, duracion_semestres, activo) "
                    "values (:facultad_id, :codigo, :nombre, :titulo_otorgado, "
                    ":duracion_semestres, :activo) returning id"
                ),
                data.model_dump(),
            )
        ).scalar_one()
    except DBAPIError as exc:
        traducir_error(exc, unico=_DUPLICADA, referencia=_SIN_FACULTAD)
    return await _obtener(conn, carrera_id)


@router.patch(
    "/{carrera_id}",
    response_model=CarreraOut,
    dependencies=[Depends(require_permission("carreras.gestionar"))],
)
async def actualizar(carrera_id: UUID, data: CarreraUpdate, conn: Conn) -> CarreraOut:
    """Edita parcialmente una carrera. Requiere ``carreras.gestionar``.

    Responde 400 sin cambios, 404 si no existe, 409 si el código o nombre chocan con otra
    carrera de la facultad y 422 si la facultad no existe.
    """
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _obtener(conn, carrera_id)  # 404 temprano
    # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
    asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
    try:
        await conn.execute(
            text(f"update academico.carrera set {asignaciones} where id = :id"),
            {**cambios, "id": carrera_id},
        )
    except DBAPIError as exc:
        traducir_error(exc, unico=_DUPLICADA, referencia=_SIN_FACULTAD)
    return await _obtener(conn, carrera_id)


@router.delete(
    "/{carrera_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("carreras.gestionar"))],
)
async def eliminar(carrera_id: UUID, conn: Conn) -> None:
    """Elimina una carrera. Requiere ``carreras.gestionar``.

    Responde 404 si no existe y 409 si tiene mallas o promociones (en ese caso conviene
    desactivarla en lugar de borrarla).
    """
    await _obtener(conn, carrera_id)
    try:
        await conn.execute(text("delete from academico.carrera where id = :id"), {"id": carrera_id})
    except DBAPIError as exc:
        traducir_error(
            exc,
            referencia="La carrera tiene mallas o promociones asociadas; desactívela en su lugar",
            referencia_status=status.HTTP_409_CONFLICT,
        )
