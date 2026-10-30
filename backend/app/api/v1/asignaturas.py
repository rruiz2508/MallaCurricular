"""Módulo de asignaturas: catálogo de materias y sus equivalencias.

La asignatura es independiente de las mallas: una misma materia puede formar parte de
varias mallas (o versiones). Su baja es lógica (``estado``) o física (DELETE) si no está
en ninguna malla. Las equivalencias son simétricas: se guardan una sola vez por par.
"""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.api.v1.common import Conn, Entrada, rechazar_nulos, traducir_error
from app.core.security import require_permission

router = APIRouter(tags=["asignaturas"])

Estado = Literal["activa", "inactiva", "en_revision"]
_DUPLICADA = "Ya existe una asignatura con ese código o código de sistema"


class AsignaturaIn(Entrada):
    """Datos para crear una asignatura."""

    codigo: str = Field(min_length=1, max_length=30)
    codigo_sistema: str | None = Field(default=None, max_length=30)
    nombre: str = Field(min_length=1, max_length=250)
    descripcion: str | None = Field(default=None, max_length=1000)
    carga_horaria_total: int = Field(ge=1, le=5000)
    horas_teoricas: int | None = Field(default=None, ge=0, le=5000)
    horas_practicas: int | None = Field(default=None, ge=0, le=5000)
    estado: Estado = "activa"

    @model_validator(mode="after")
    def _horas_coherentes(self) -> "AsignaturaIn":
        """Las horas teóricas y prácticas no pueden superar la carga horaria total."""
        suma = (self.horas_teoricas or 0) + (self.horas_practicas or 0)
        if suma > self.carga_horaria_total:
            raise ValueError("Las horas teóricas y prácticas superan la carga horaria total")
        return self


class AsignaturaUpdate(Entrada):
    """Datos para editar una asignatura. Solo se actualizan los campos enviados."""

    codigo: str | None = Field(default=None, min_length=1, max_length=30)
    codigo_sistema: str | None = Field(default=None, max_length=30)
    nombre: str | None = Field(default=None, min_length=1, max_length=250)
    descripcion: str | None = Field(default=None, max_length=1000)
    carga_horaria_total: int | None = Field(default=None, ge=1, le=5000)
    horas_teoricas: int | None = Field(default=None, ge=0, le=5000)
    horas_practicas: int | None = Field(default=None, ge=0, le=5000)
    estado: Estado | None = None

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        """Rechaza ``null`` en los campos obligatorios; la descripción, el código de sistema y las horas sí pueden vaciarse."""
        return rechazar_nulos(data, {"codigo", "nombre", "carga_horaria_total", "estado"})


class AsignaturaOut(BaseModel):
    """Asignatura tal como se devuelve al cliente."""

    id: UUID
    codigo: str
    codigo_sistema: str | None
    nombre: str
    descripcion: str | None
    carga_horaria_total: int
    horas_teoricas: int | None
    horas_practicas: int | None
    estado: str


_COLUMNAS = (
    "id, codigo, codigo_sistema, nombre, descripcion, carga_horaria_total, "
    "horas_teoricas, horas_practicas, estado"
)


async def _obtener(conn: AsyncConnection, asignatura_id: UUID) -> AsignaturaOut:
    """Devuelve la asignatura o responde 404 si no existe."""
    row = (
        await conn.execute(
            text(f"select {_COLUMNAS} from academico.asignatura where id = :id"),
            {"id": asignatura_id},
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asignatura no encontrada"
        )
    return AsignaturaOut(**row._mapping)


@router.get(
    "/asignaturas",
    response_model=list[AsignaturaOut],
    dependencies=[Depends(require_permission("asignaturas.leer"))],
)
async def listar(conn: Conn) -> list[AsignaturaOut]:
    """Lista el catálogo ordenado por código. Requiere ``asignaturas.leer``."""
    rows = await conn.execute(text(f"select {_COLUMNAS} from academico.asignatura order by codigo"))
    return [AsignaturaOut(**r._mapping) for r in rows]


@router.post(
    "/asignaturas",
    response_model=AsignaturaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("asignaturas.gestionar"))],
)
async def crear(data: AsignaturaIn, conn: Conn) -> AsignaturaOut:
    """Crea una asignatura. Requiere ``asignaturas.gestionar``.

    Responde 409 si el código o el código de sistema ya existen.
    """
    try:
        asignatura_id = (
            await conn.execute(
                text(
                    "insert into academico.asignatura (codigo, codigo_sistema, nombre, "
                    "descripcion, carga_horaria_total, horas_teoricas, horas_practicas, estado) "
                    "values (:codigo, :codigo_sistema, :nombre, :descripcion, "
                    ":carga_horaria_total, :horas_teoricas, :horas_practicas, :estado) "
                    "returning id"
                ),
                data.model_dump(),
            )
        ).scalar_one()
    except DBAPIError as exc:
        traducir_error(exc, unico=_DUPLICADA)
    return await _obtener(conn, asignatura_id)


@router.patch(
    "/asignaturas/{asignatura_id}",
    response_model=AsignaturaOut,
    dependencies=[Depends(require_permission("asignaturas.gestionar"))],
)
async def actualizar(asignatura_id: UUID, data: AsignaturaUpdate, conn: Conn) -> AsignaturaOut:
    """Edita parcialmente una asignatura. Requiere ``asignaturas.gestionar``.

    Responde 400 sin cambios, 404 si no existe, 409 si el código choca con otra y 422 si
    las horas no son coherentes con la carga horaria total.
    """
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _obtener(conn, asignatura_id)  # 404 temprano
    # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
    asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
    try:
        await conn.execute(
            text(f"update academico.asignatura set {asignaciones} where id = :id"),
            {**cambios, "id": asignatura_id},
        )
    except DBAPIError as exc:
        traducir_error(exc, unico=_DUPLICADA)
    return await _obtener(conn, asignatura_id)


@router.delete(
    "/asignaturas/{asignatura_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("asignaturas.gestionar"))],
)
async def eliminar(asignatura_id: UUID, conn: Conn) -> None:
    """Elimina una asignatura. Requiere ``asignaturas.gestionar``.

    Responde 404 si no existe y 409 si forma parte de alguna malla (conviene marcarla como
    inactiva). Sus equivalencias se eliminan junto con ella.
    """
    await _obtener(conn, asignatura_id)
    try:
        await conn.execute(
            text("delete from academico.asignatura where id = :id"), {"id": asignatura_id}
        )
    except DBAPIError as exc:
        traducir_error(
            exc,
            referencia="La asignatura forma parte de una malla; márquela como inactiva",
            referencia_status=status.HTTP_409_CONFLICT,
        )


# ------------------------------------------------------------- equivalencias


class EquivalenciaIn(Entrada):
    """Datos para declarar dos asignaturas como equivalentes."""

    asignatura_id: UUID
    equivalente_id: UUID
    observacion: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _distintas(self) -> "EquivalenciaIn":
        """Una asignatura no puede ser equivalente a sí misma."""
        if self.asignatura_id == self.equivalente_id:
            raise ValueError("Una asignatura no puede ser equivalente a sí misma")
        return self


class EquivalenciaUpdate(Entrada):
    """Datos para editar una equivalencia (solo su observación)."""

    observacion: str | None = Field(default=None, max_length=500)


class EquivalenciaOut(BaseModel):
    """Par de asignaturas equivalentes, con sus códigos y nombres."""

    asignatura_id: UUID
    asignatura_codigo: str
    asignatura_nombre: str
    equivalente_id: UUID
    equivalente_codigo: str
    equivalente_nombre: str
    observacion: str | None


_SELECT_EQ = """
    select e.asignatura_id, a.codigo as asignatura_codigo, a.nombre as asignatura_nombre,
           e.equivalente_id, b.codigo as equivalente_codigo, b.nombre as equivalente_nombre,
           e.observacion
    from academico.asignatura_equivalencia e
    join academico.asignatura a on a.id = e.asignatura_id
    join academico.asignatura b on b.id = e.equivalente_id
"""
# El par se guarda ordenado (asignatura_id < equivalente_id): se busca sin importar el
# orden en que lo envíe el cliente.
_PAR = "(e.asignatura_id, e.equivalente_id) = (least(cast(:a as uuid), cast(:b as uuid)), greatest(cast(:a as uuid), cast(:b as uuid)))"


async def _obtener_equivalencia(conn: AsyncConnection, a: UUID, b: UUID) -> EquivalenciaOut:
    """Devuelve el par (en cualquier orden) o responde 404 si no existe."""
    row = (await conn.execute(text(_SELECT_EQ + f" where {_PAR}"), {"a": a, "b": b})).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Equivalencia no encontrada"
        )
    return EquivalenciaOut(**row._mapping)


@router.get(
    "/equivalencias",
    response_model=list[EquivalenciaOut],
    dependencies=[Depends(require_permission("asignaturas.leer"))],
)
async def listar_equivalencias(conn: Conn) -> list[EquivalenciaOut]:
    """Lista los pares de asignaturas equivalentes. Requiere ``asignaturas.leer``."""
    rows = await conn.execute(text(_SELECT_EQ + " order by a.codigo, b.codigo"))
    return [EquivalenciaOut(**r._mapping) for r in rows]


@router.post(
    "/equivalencias",
    response_model=EquivalenciaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("asignaturas.gestionar"))],
)
async def crear_equivalencia(data: EquivalenciaIn, conn: Conn) -> EquivalenciaOut:
    """Declara dos asignaturas como equivalentes. Requiere ``asignaturas.gestionar``.

    Responde 409 si el par ya existe y 422 si alguna asignatura no existe.
    """
    try:
        await conn.execute(
            text(
                "insert into academico.asignatura_equivalencia "
                "(asignatura_id, equivalente_id, observacion) "
                "values (:asignatura_id, :equivalente_id, :observacion)"
            ),
            data.model_dump(),
        )
    except DBAPIError as exc:
        traducir_error(
            exc,
            unico="Esas asignaturas ya están registradas como equivalentes",
            referencia="Alguna de las asignaturas no existe",
        )
    return await _obtener_equivalencia(conn, data.asignatura_id, data.equivalente_id)


@router.patch(
    "/equivalencias/{a}/{b}",
    response_model=EquivalenciaOut,
    dependencies=[Depends(require_permission("asignaturas.gestionar"))],
)
async def actualizar_equivalencia(
    a: UUID, b: UUID, data: EquivalenciaUpdate, conn: Conn
) -> EquivalenciaOut:
    """Edita la observación de una equivalencia. Requiere ``asignaturas.gestionar``."""
    if not data.model_fields_set:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _obtener_equivalencia(conn, a, b)
    await conn.execute(
        text(
            "update academico.asignatura_equivalencia e set observacion = :observacion "
            f"where {_PAR}"
        ),
        {"a": a, "b": b, "observacion": data.observacion},
    )
    return await _obtener_equivalencia(conn, a, b)


@router.delete(
    "/equivalencias/{a}/{b}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("asignaturas.gestionar"))],
)
async def eliminar_equivalencia(a: UUID, b: UUID, conn: Conn) -> None:
    """Elimina una equivalencia. Requiere ``asignaturas.gestionar``."""
    await _obtener_equivalencia(conn, a, b)
    await conn.execute(
        text(f"delete from academico.asignatura_equivalencia e where {_PAR}"), {"a": a, "b": b}
    )
