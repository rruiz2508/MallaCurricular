"""Módulo de mallas curriculares: versiones, composición por semestre y prerrequisitos.

Ciclo de vida de una versión: ``borrador`` -> ``publicada`` -> ``archivada``. Solo un
borrador se puede modificar (composición, prerrequisitos, duración) o eliminar; para
cambiar una malla publicada se crea una nueva versión copiándola (``/clonar``).
Las reglas de consistencia viven en la base (triggers) y aquí se traducen a respuestas 409.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.api.v1.common import Conn, Entrada, rechazar_nulos, traducir_error
from app.core.security import require_permission

router = APIRouter(prefix="/mallas", tags=["mallas"])

Tipo = Literal["obligatoria", "electiva", "complementaria", "trabajo_final"]
# Las actividades complementarias y el trabajo final no se cursan en un semestre.
_SIN_SEMESTRE: set[str] = {"complementaria", "trabajo_final"}


# ------------------------------------------------------------------ esquemas


class MallaIn(Entrada):
    """Datos para crear una malla (siempre nace como borrador, con versión automática)."""

    carrera_id: UUID
    nombre: str = Field(min_length=1, max_length=200)
    resolucion: str | None = Field(default=None, max_length=200)
    duracion_semestres: int = Field(ge=1, le=20)
    horas_por_credito: int = Field(default=15, ge=1, le=100)


class MallaUpdate(Entrada):
    """Datos para editar una malla. La carrera y la versión no cambian."""

    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    resolucion: str | None = Field(default=None, max_length=200)
    duracion_semestres: int | None = Field(default=None, ge=1, le=20)
    horas_por_credito: int | None = Field(default=None, ge=1, le=100)

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        return rechazar_nulos(data, {"nombre", "duracion_semestres", "horas_por_credito"})


class MallaAsignaturaIn(Entrada):
    """Agrega una asignatura a la malla."""

    asignatura_id: UUID
    semestre: int | None = Field(default=None, ge=1, le=20)
    tipo: Tipo = "obligatoria"
    orden: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _semestre_segun_tipo(self) -> "MallaAsignaturaIn":
        if (self.tipo in _SIN_SEMESTRE) != (self.semestre is None):
            raise ValueError(
                "Las actividades complementarias y el trabajo final no llevan semestre; "
                "las demás asignaturas sí"
            )
        return self


class MallaAsignaturaUpdate(Entrada):
    """Cambia el semestre, el tipo o el orden de una asignatura de la malla."""

    semestre: int | None = Field(default=None, ge=1, le=20)
    tipo: Tipo | None = None
    orden: int | None = Field(default=None, ge=0)

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        # El semestre sí puede quedar en null (al pasar a complementaria/trabajo final).
        return rechazar_nulos(data, {"tipo"})


class RelacionIn(Entrada):
    """Declara que ``asignatura_id`` requiere ``relacionada_id``."""

    asignatura_id: UUID
    relacionada_id: UUID
    tipo: Literal["prerrequisito", "correlativa"] = "prerrequisito"

    @model_validator(mode="after")
    def _distintas(self) -> "RelacionIn":
        if self.asignatura_id == self.relacionada_id:
            raise ValueError("Una asignatura no puede requerirse a sí misma")
        return self


class MallaOut(BaseModel):
    id: UUID
    carrera_id: UUID
    carrera_codigo: str
    carrera: str
    version: int
    nombre: str
    resolucion: str | None
    duracion_semestres: int
    horas_por_credito: int
    estado: str
    publicada_at: datetime | None
    archivada_at: datetime | None
    cantidad_asignaturas: int
    cantidad_promociones: int


class RelacionOut(BaseModel):
    id: UUID
    relacionada_id: UUID
    codigo: str
    nombre: str
    tipo: str


class MallaAsignaturaOut(BaseModel):
    asignatura_id: UUID
    codigo: str
    codigo_sistema: str | None
    nombre: str
    semestre: int | None
    tipo: str
    orden: int | None
    horas: int
    creditos_teoricos: float
    creditos_practicos: float
    prerrequisitos: list[RelacionOut]


class MallaDetalleOut(MallaOut):
    asignaturas: list[MallaAsignaturaOut]


# ------------------------------------------------------------------ consultas

_SELECT = """
    select m.id, m.carrera_id, c.codigo as carrera_codigo, c.nombre as carrera, m.version,
           m.nombre, m.resolucion, m.duracion_semestres, m.horas_por_credito, m.estado,
           m.publicada_at, m.archivada_at,
           (select count(*) from academico.malla_asignatura ma where ma.malla_id = m.id)
             as cantidad_asignaturas,
           (select count(*) from academico.promocion p where p.malla_id = m.id)
             as cantidad_promociones
    from academico.malla_curricular m
    join academico.carrera c on c.id = m.carrera_id
"""


async def _obtener(conn: AsyncConnection, malla_id: UUID) -> MallaOut:
    row = (await conn.execute(text(_SELECT + " where m.id = :id"), {"id": malla_id})).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Malla no encontrada")
    return MallaOut(**row._mapping)


async def _detalle(conn: AsyncConnection, malla_id: UUID) -> MallaDetalleOut:
    """La malla con sus asignaturas ordenadas (por semestre, orden y código) y, en cada
    una, sus prerrequisitos."""
    malla = await _obtener(conn, malla_id)
    asignaturas = (
        await conn.execute(
            text(
                """
                select ma.asignatura_id, a.codigo, a.codigo_sistema, a.nombre, ma.semestre,
                       ma.tipo, ma.orden, a.carga_horaria_total as horas,
                       round(coalesce(a.horas_teoricas,
                                      a.carga_horaria_total - coalesce(a.horas_practicas, 0))
                             / m.horas_por_credito::numeric, 2) as creditos_teoricos,
                       round(coalesce(a.horas_practicas, 0)
                             / m.horas_por_credito::numeric, 2) as creditos_practicos
                from academico.malla_asignatura ma
                join academico.malla_curricular m on m.id = ma.malla_id
                join academico.asignatura a on a.id = ma.asignatura_id
                where ma.malla_id = :id
                order by ma.semestre nulls last, ma.orden nulls last, a.codigo
                """
            ),
            {"id": malla_id},
        )
    ).all()
    relaciones = (
        await conn.execute(
            text(
                """
                select r.id, r.asignatura_id, r.relacionada_id, req.codigo, req.nombre, r.tipo
                from academico.malla_relacion r
                join academico.asignatura req on req.id = r.relacionada_id
                where r.malla_id = :id
                order by req.codigo
                """
            ),
            {"id": malla_id},
        )
    ).all()
    por_asignatura: dict[UUID, list[RelacionOut]] = {}
    for r in relaciones:
        por_asignatura.setdefault(r.asignatura_id, []).append(
            RelacionOut(
                id=r.id,
                relacionada_id=r.relacionada_id,
                codigo=r.codigo,
                nombre=r.nombre,
                tipo=r.tipo,
            )
        )
    return MallaDetalleOut(
        **malla.model_dump(),
        asignaturas=[
            MallaAsignaturaOut(**a._mapping, prerrequisitos=por_asignatura.get(a.asignatura_id, []))
            for a in asignaturas
        ],
    )


async def _en_borrador(conn: AsyncConnection, malla_id: UUID) -> MallaOut:
    """Devuelve la malla si existe y está en borrador (404 / 409 en otro caso)."""
    malla = await _obtener(conn, malla_id)
    if malla.estado != "borrador":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede modificar una malla en borrador; cree una nueva versión",
        )
    return malla


# ----------------------------------------------------------------- endpoints


@router.get(
    "",
    response_model=list[MallaOut],
    dependencies=[Depends(require_permission("mallas.leer"))],
)
async def listar(conn: Conn, carrera_id: UUID | None = None) -> list[MallaOut]:
    """Lista las mallas (opcionalmente de una carrera). Requiere ``mallas.leer``."""
    rows = await conn.execute(
        text(
            _SELECT
            + " where (cast(:carrera as uuid) is null or m.carrera_id = cast(:carrera as uuid))"
            + " order by c.nombre, m.version desc"
        ),
        {"carrera": carrera_id},
    )
    return [MallaOut(**r._mapping) for r in rows]


@router.post(
    "",
    response_model=MallaDetalleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def crear(data: MallaIn, conn: Conn) -> MallaDetalleOut:
    """Crea una malla en borrador con la siguiente versión de la carrera. Requiere
    ``mallas.gestionar``. Responde 422 si la carrera no existe."""
    try:
        malla_id = (
            await conn.execute(
                text(
                    "insert into academico.malla_curricular "
                    "(carrera_id, nombre, resolucion, duracion_semestres, horas_por_credito) "
                    "values (:carrera_id, :nombre, :resolucion, :duracion_semestres, "
                    ":horas_por_credito) returning id"
                ),
                data.model_dump(),
            )
        ).scalar_one()
    except DBAPIError as exc:
        traducir_error(exc, referencia="La carrera indicada no existe")
    return await _detalle(conn, malla_id)


@router.get(
    "/{malla_id}",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.leer"))],
)
async def obtener(malla_id: UUID, conn: Conn) -> MallaDetalleOut:
    """Detalle de una malla con sus asignaturas y prerrequisitos. Requiere ``mallas.leer``."""
    return await _detalle(conn, malla_id)


@router.patch(
    "/{malla_id}",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def actualizar(malla_id: UUID, data: MallaUpdate, conn: Conn) -> MallaDetalleOut:
    """Edita una malla en borrador. Requiere ``mallas.gestionar``.

    Responde 400 sin cambios, 404 si no existe y 409 si no es borrador o si la duración
    quedaría por debajo del semestre más alto ya cargado.
    """
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _en_borrador(conn, malla_id)
    # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
    asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
    try:
        await conn.execute(
            text(f"update academico.malla_curricular set {asignaciones} where id = :id"),
            {**cambios, "id": malla_id},
        )
    except DBAPIError as exc:
        traducir_error(exc)
    return await _detalle(conn, malla_id)


@router.delete(
    "/{malla_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def eliminar(malla_id: UUID, conn: Conn) -> None:
    """Elimina una malla en borrador (con su composición). Requiere ``mallas.gestionar``."""
    await _en_borrador(conn, malla_id)
    try:
        await conn.execute(
            text("delete from academico.malla_curricular where id = :id"), {"id": malla_id}
        )
    except DBAPIError as exc:
        traducir_error(exc)


@router.post(
    "/{malla_id}/publicar",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.publicar"))],
)
async def publicar(malla_id: UUID, conn: Conn) -> MallaDetalleOut:
    """Publica un borrador: desde entonces ya no se modifica. Requiere ``mallas.publicar``.
    Responde 409 si no es borrador o no tiene asignaturas."""
    await _cambiar_estado(conn, malla_id, desde="borrador", hacia="publicada")
    return await _detalle(conn, malla_id)


@router.post(
    "/{malla_id}/archivar",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.publicar"))],
)
async def archivar(malla_id: UUID, conn: Conn) -> MallaDetalleOut:
    """Archiva una malla publicada (queda como historial). Requiere ``mallas.publicar``.
    Responde 409 si no está publicada."""
    await _cambiar_estado(conn, malla_id, desde="publicada", hacia="archivada")
    return await _detalle(conn, malla_id)


async def _cambiar_estado(conn: AsyncConnection, malla_id: UUID, *, desde: str, hacia: str) -> None:
    """Pasa la malla de ``desde`` a ``hacia``. La base valida las transiciones, pero un
    cambio al mismo estado no es una transición y pasaría en silencio: se rechaza aquí."""
    malla = await _obtener(conn, malla_id)
    if malla.estado != desde:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se puede pasar a {hacia} una malla en estado {desde} "
            f"(la malla está {malla.estado})",
        )
    try:
        await conn.execute(
            text("update academico.malla_curricular set estado = :estado where id = :id"),
            {"estado": hacia, "id": malla_id},
        )
    except DBAPIError as exc:
        traducir_error(exc)


@router.post(
    "/{malla_id}/clonar",
    response_model=MallaDetalleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def clonar(malla_id: UUID, conn: Conn) -> MallaDetalleOut:
    """Crea una nueva versión en borrador copiando asignaturas y prerrequisitos de esta.
    Requiere ``mallas.gestionar``. Así se modifica una malla ya publicada."""
    await _obtener(conn, malla_id)
    try:
        nueva = (
            await conn.execute(
                text(
                    "insert into academico.malla_curricular "
                    "(carrera_id, nombre, resolucion, duracion_semestres, horas_por_credito) "
                    "select carrera_id, nombre, resolucion, duracion_semestres, horas_por_credito "
                    "from academico.malla_curricular where id = :id returning id"
                ),
                {"id": malla_id},
            )
        ).scalar_one()
        await conn.execute(
            text(
                "insert into academico.malla_asignatura (malla_id, asignatura_id, semestre, tipo, orden) "
                "select :nueva, asignatura_id, semestre, tipo, orden "
                "from academico.malla_asignatura where malla_id = :id"
            ),
            {"nueva": nueva, "id": malla_id},
        )
        await conn.execute(
            text(
                "insert into academico.malla_relacion (malla_id, asignatura_id, relacionada_id, tipo) "
                "select :nueva, asignatura_id, relacionada_id, tipo "
                "from academico.malla_relacion where malla_id = :id"
            ),
            {"nueva": nueva, "id": malla_id},
        )
    except DBAPIError as exc:
        traducir_error(exc)
    return await _detalle(conn, nueva)


# --------------------------------------------------------------- composición


@router.post(
    "/{malla_id}/asignaturas",
    response_model=MallaDetalleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def agregar_asignatura(
    malla_id: UUID, data: MallaAsignaturaIn, conn: Conn
) -> MallaDetalleOut:
    """Agrega una asignatura a un borrador. Requiere ``mallas.gestionar``.

    Responde 409 si ya está en la malla, si no es borrador o si el semestre supera la
    duración; 422 si la asignatura no existe. Sin ``orden`` queda al final del semestre.
    """
    await _en_borrador(conn, malla_id)
    try:
        await conn.execute(
            text(
                "insert into academico.malla_asignatura (malla_id, asignatura_id, semestre, tipo, orden) "
                "values (:malla_id, :asignatura_id, :semestre, :tipo, coalesce(:orden, ("
                "select coalesce(max(orden), -1) + 1 from academico.malla_asignatura "
                "where malla_id = :malla_id and semestre is not distinct from :semestre)))"
            ),
            {**data.model_dump(), "malla_id": malla_id},
        )
    except DBAPIError as exc:
        traducir_error(
            exc,
            unico="La asignatura ya forma parte de la malla",
            referencia="La asignatura indicada no existe",
        )
    return await _detalle(conn, malla_id)


@router.patch(
    "/{malla_id}/asignaturas/{asignatura_id}",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def actualizar_asignatura(
    malla_id: UUID, asignatura_id: UUID, data: MallaAsignaturaUpdate, conn: Conn
) -> MallaDetalleOut:
    """Cambia semestre, tipo u orden de una asignatura del borrador. Requiere
    ``mallas.gestionar``.

    Responde 404 si no está en la malla, 409 si el cambio contradice un prerrequisito o
    supera la duración, y 422 si tipo y semestre no son coherentes.
    """
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _en_borrador(conn, malla_id)
    # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
    asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
    try:
        resultado = await conn.execute(
            text(
                f"update academico.malla_asignatura set {asignaciones} "
                "where malla_id = :malla_id and asignatura_id = :asignatura_id"
            ),
            {**cambios, "malla_id": malla_id, "asignatura_id": asignatura_id},
        )
    except DBAPIError as exc:
        traducir_error(exc)
    if resultado.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="La asignatura no está en la malla"
        )
    return await _detalle(conn, malla_id)


@router.delete(
    "/{malla_id}/asignaturas/{asignatura_id}",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def quitar_asignatura(malla_id: UUID, asignatura_id: UUID, conn: Conn) -> MallaDetalleOut:
    """Quita una asignatura de un borrador junto con sus prerrequisitos (y los que la
    requieren a ella). Requiere ``mallas.gestionar``."""
    await _en_borrador(conn, malla_id)
    try:
        resultado = await conn.execute(
            text(
                "delete from academico.malla_asignatura "
                "where malla_id = :malla_id and asignatura_id = :asignatura_id"
            ),
            {"malla_id": malla_id, "asignatura_id": asignatura_id},
        )
    except DBAPIError as exc:
        traducir_error(exc)
    if resultado.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="La asignatura no está en la malla"
        )
    return await _detalle(conn, malla_id)


# ------------------------------------------------------------- prerrequisitos


@router.post(
    "/{malla_id}/relaciones",
    response_model=MallaDetalleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def agregar_relacion(malla_id: UUID, data: RelacionIn, conn: Conn) -> MallaDetalleOut:
    """Agrega un prerrequisito a un borrador. Requiere ``mallas.gestionar``.

    Responde 409 si ya existe o si la asignatura requerida no está en un semestre
    anterior, y 422 si alguna de las dos no pertenece a la malla.
    """
    await _en_borrador(conn, malla_id)
    # La base también lo exige (clave foránea), pero su trigger de semestres se evalúa
    # antes y daría un mensaje confuso para una asignatura que ni siquiera está en la malla.
    presentes = (
        await conn.execute(
            text(
                "select count(*) from academico.malla_asignatura "
                "where malla_id = :malla_id and asignatura_id in (:a, :r)"
            ),
            {"malla_id": malla_id, "a": data.asignatura_id, "r": data.relacionada_id},
        )
    ).scalar_one()
    if presentes != 2:
        raise HTTPException(
            status_code=422,
            detail="Ambas asignaturas deben pertenecer a la malla",
        )
    try:
        await conn.execute(
            text(
                "insert into academico.malla_relacion (malla_id, asignatura_id, relacionada_id, tipo) "
                "values (:malla_id, :asignatura_id, :relacionada_id, :tipo)"
            ),
            {**data.model_dump(), "malla_id": malla_id},
        )
    except DBAPIError as exc:
        traducir_error(
            exc,
            unico="Ese prerrequisito ya está registrado",
            referencia="Ambas asignaturas deben pertenecer a la malla",
        )
    return await _detalle(conn, malla_id)


@router.delete(
    "/{malla_id}/relaciones/{relacion_id}",
    response_model=MallaDetalleOut,
    dependencies=[Depends(require_permission("mallas.gestionar"))],
)
async def quitar_relacion(malla_id: UUID, relacion_id: UUID, conn: Conn) -> MallaDetalleOut:
    """Elimina un prerrequisito de un borrador. Requiere ``mallas.gestionar``."""
    await _en_borrador(conn, malla_id)
    try:
        resultado = await conn.execute(
            text("delete from academico.malla_relacion where id = :id and malla_id = :malla_id"),
            {"id": relacion_id, "malla_id": malla_id},
        )
    except DBAPIError as exc:
        traducir_error(exc)
    if resultado.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prerrequisito no encontrado"
        )
    return await _detalle(conn, malla_id)
