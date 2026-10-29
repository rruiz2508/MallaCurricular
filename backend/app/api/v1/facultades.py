from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.db import get_connection
from app.core.security import require_permission

router = APIRouter(prefix="/facultades", tags=["facultades"])

Conn = Annotated[AsyncConnection, Depends(get_connection)]


class FacultadIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=200)
    activo: bool = True


class FacultadUpdate(BaseModel):
    codigo: str | None = Field(default=None, min_length=1, max_length=30)
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    activo: bool | None = None


class FacultadOut(BaseModel):
    id: UUID
    codigo: str
    nombre: str
    activo: bool


_COLUMNS = "id, codigo, nombre, activo"


@router.get(
    "",
    response_model=list[FacultadOut],
    dependencies=[Depends(require_permission("facultades.leer"))],
)
async def listar(conn: Conn) -> list[FacultadOut]:
    rows = await conn.execute(text(f"select {_COLUMNS} from academico.facultad order by nombre"))
    return [FacultadOut(**r._mapping) for r in rows]


@router.post(
    "",
    response_model=FacultadOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("facultades.gestionar"))],
)
async def crear(data: FacultadIn, conn: Conn) -> FacultadOut:
    try:
        row = (
            await conn.execute(
                text(
                    "insert into academico.facultad (codigo, nombre, activo) "
                    f"values (:codigo, :nombre, :activo) returning {_COLUMNS}"
                ),
                data.model_dump(),
            )
        ).one()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una facultad con ese código o nombre",
        ) from exc
    return FacultadOut(**row._mapping)


@router.patch(
    "/{facultad_id}",
    response_model=FacultadOut,
    dependencies=[Depends(require_permission("facultades.gestionar"))],
)
async def actualizar(facultad_id: UUID, data: FacultadUpdate, conn: Conn) -> FacultadOut:
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    # Los nombres de columna provienen del esquema Pydantic, nunca del cliente.
    assignments = ", ".join(f"{col} = :{col}" for col in changes)
    try:
        row = (
            await conn.execute(
                text(
                    f"update academico.facultad set {assignments} "
                    f"where id = :id returning {_COLUMNS}"
                ),
                {**changes, "id": facultad_id},
            )
        ).first()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una facultad con ese código o nombre",
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facultad no encontrada")
    return FacultadOut(**row._mapping)
