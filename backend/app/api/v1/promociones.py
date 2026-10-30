"""Módulo de promociones: cohortes de ingreso de una carrera asociadas a una malla.

La vigencia (fin regular y fin de vigencia) se calcula en la base a partir del año de
ingreso, la duración de la malla y los años de gracia (ver ``academico.v_promocion``).
Una promoción solo puede asociarse a una malla *publicada* de su misma carrera.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.api.v1.common import Conn, Entrada, rechazar_nulos, traducir_error
from app.core.security import require_permission

router = APIRouter(prefix="/promociones", tags=["promociones"])

_DUPLICADA = "Ya existe una promoción de esa carrera para ese año"
_MALLA_AJENA = "La malla indicada no existe o no pertenece a la carrera"


class PromocionIn(Entrada):
    """Datos para crear una promoción."""

    carrera_id: UUID
    anio: int = Field(ge=1900, le=2200)
    malla_id: UUID
    anios_gracia: int = Field(default=3, ge=0, le=20)


class PromocionUpdate(Entrada):
    """Datos para editar una promoción. La carrera y el año de ingreso no cambian: si se
    cargaron mal se elimina la promoción y se crea de nuevo."""

    malla_id: UUID | None = None
    anios_gracia: int | None = Field(default=None, ge=0, le=20)

    @model_validator(mode="before")
    @classmethod
    def _sin_nulos(cls, data: object) -> object:
        return rechazar_nulos(data, {"malla_id", "anios_gracia"})


class PromocionOut(BaseModel):
    id: UUID
    carrera_id: UUID
    carrera_codigo: str
    carrera: str
    anio: int
    malla_id: UUID
    malla_version: int
    malla_nombre: str
    anios_gracia: int
    anio_fin_regular: int
    anio_fin_vigencia: int
    vigente: bool


_SELECT = """
    select p.id, p.carrera_id, c.codigo as carrera_codigo, c.nombre as carrera, p.anio,
           p.malla_id, v.malla_version, m.nombre as malla_nombre, p.anios_gracia,
           v.anio_fin_regular, v.anio_fin_vigencia, v.vigente
    from academico.promocion p
    join academico.v_promocion v on v.id = p.id
    join academico.carrera c on c.id = p.carrera_id
    join academico.malla_curricular m on m.id = p.malla_id
"""


async def _obtener(conn: AsyncConnection, promocion_id: UUID) -> PromocionOut:
    row = (await conn.execute(text(_SELECT + " where p.id = :id"), {"id": promocion_id})).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promoción no encontrada")
    return PromocionOut(**row._mapping)


@router.get(
    "",
    response_model=list[PromocionOut],
    dependencies=[Depends(require_permission("promociones.leer"))],
)
async def listar(conn: Conn) -> list[PromocionOut]:
    """Lista las promociones, las más recientes primero. Requiere ``promociones.leer``."""
    rows = await conn.execute(text(_SELECT + " order by c.nombre, p.anio desc"))
    return [PromocionOut(**r._mapping) for r in rows]


@router.post(
    "",
    response_model=PromocionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("promociones.gestionar"))],
)
async def crear(data: PromocionIn, conn: Conn) -> PromocionOut:
    """Crea una promoción. Requiere ``promociones.gestionar``.

    Responde 409 si ya hay una promoción de la carrera para ese año o si la malla no está
    publicada, y 422 si la malla no pertenece a la carrera.
    """
    try:
        promocion_id = (
            await conn.execute(
                text(
                    "insert into academico.promocion (carrera_id, anio, malla_id, anios_gracia) "
                    "values (:carrera_id, :anio, :malla_id, :anios_gracia) returning id"
                ),
                data.model_dump(),
            )
        ).scalar_one()
    except DBAPIError as exc:
        traducir_error(exc, unico=_DUPLICADA, referencia=_MALLA_AJENA)
    return await _obtener(conn, promocion_id)


@router.patch(
    "/{promocion_id}",
    response_model=PromocionOut,
    dependencies=[Depends(require_permission("promociones.gestionar"))],
)
async def actualizar(promocion_id: UUID, data: PromocionUpdate, conn: Conn) -> PromocionOut:
    """Cambia la malla o los años de gracia. Requiere ``promociones.gestionar``.

    Responde 400 sin cambios, 404 si no existe, 409 si la malla nueva no está publicada y
    422 si no pertenece a la carrera.
    """
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    await _obtener(conn, promocion_id)  # 404 temprano
    # Los nombres de columna salen del esquema Pydantic, nunca del cliente.
    asignaciones = ", ".join(f"{col} = :{col}" for col in cambios)
    try:
        await conn.execute(
            text(f"update academico.promocion set {asignaciones} where id = :id"),
            {**cambios, "id": promocion_id},
        )
    except DBAPIError as exc:
        traducir_error(exc, unico=_DUPLICADA, referencia=_MALLA_AJENA)
    return await _obtener(conn, promocion_id)


@router.delete(
    "/{promocion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("promociones.gestionar"))],
)
async def eliminar(promocion_id: UUID, conn: Conn) -> None:
    """Elimina una promoción. Requiere ``promociones.gestionar``."""
    await _obtener(conn, promocion_id)
    await conn.execute(text("delete from academico.promocion where id = :id"), {"id": promocion_id})
