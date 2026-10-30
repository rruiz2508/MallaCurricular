"""Módulo de facultades: listado, alta y edición.

Es el módulo de referencia: los demás (carreras, asignaturas, etc.) siguen el mismo
patrón de esquemas Pydantic + consultas SQL con parámetros + permisos por endpoint.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.db import get_connection
from app.core.security import require_permission

router = APIRouter(prefix="/facultades", tags=["facultades"])

# Conexión a la base, con transacción por petición (ver app.core.db.get_connection).
Conn = Annotated[AsyncConnection, Depends(get_connection)]


class _Entrada(BaseModel):
    """Base de los esquemas de entrada.

    ``str_strip_whitespace`` recorta los textos antes de validar, de modo que un
    código o nombre con solo espacios no pase la restricción de longitud mínima.
    """

    model_config = ConfigDict(str_strip_whitespace=True)


class FacultadIn(_Entrada):
    """Datos para crear una facultad."""

    codigo: str = Field(min_length=1, max_length=30)
    nombre: str = Field(min_length=1, max_length=200)
    activo: bool = True


class FacultadUpdate(_Entrada):
    """Datos para editar una facultad. Todos son opcionales: solo se actualizan los
    campos que el cliente envía (actualización parcial, PATCH)."""

    codigo: str | None = Field(default=None, min_length=1, max_length=30)
    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    activo: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def rechazar_nulos(cls, data: object) -> object:
        """Un campo enviado como ``null`` no se puede guardar (las columnas son NOT
        NULL) y tampoco debe ignorarse en silencio: se rechaza con 422."""
        if isinstance(data, dict):
            nulos = sorted(str(campo) for campo, valor in data.items() if valor is None)
            if nulos:
                raise ValueError(f"Los campos no admiten null: {', '.join(nulos)}")
        return data


class FacultadOut(BaseModel):
    """Facultad tal como se devuelve al cliente."""

    id: UUID
    codigo: str
    nombre: str
    activo: bool


# Columnas que se devuelven siempre; evita repetir la lista en cada consulta.
_COLUMNS = "id, codigo, nombre, activo"


@router.get(
    "",
    response_model=list[FacultadOut],
    dependencies=[Depends(require_permission("facultades.leer"))],
)
async def listar(conn: Conn) -> list[FacultadOut]:
    """Lista todas las facultades ordenadas por nombre. Requiere ``facultades.leer``."""
    rows = await conn.execute(text(f"select {_COLUMNS} from academico.facultad order by nombre"))
    return [FacultadOut(**r._mapping) for r in rows]


@router.post(
    "",
    response_model=FacultadOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("facultades.gestionar"))],
)
async def crear(data: FacultadIn, conn: Conn) -> FacultadOut:
    """Crea una facultad. Requiere ``facultades.gestionar``.

    Responde 409 si el código o el nombre ya existen (restricciones únicas de la base).
    """
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
    """Edita parcialmente una facultad. Requiere ``facultades.gestionar``.

    Responde 400 si no se envía ningún campo, 404 si no existe y 409 si el nuevo código
    o nombre chocan con otra facultad.
    """
    # exclude_unset: solo los campos que el cliente realmente envió.
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin cambios")
    # Los nombres de columna provienen del esquema Pydantic, nunca del cliente, así que
    # armar el SET dinámicamente es seguro; los valores siempre viajan como parámetros.
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
