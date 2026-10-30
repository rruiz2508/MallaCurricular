"""Piezas compartidas por los routers de la API v1."""

from typing import Annotated, NoReturn

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.db import get_connection

# Conexión a la base, con transacción por petición (ver app.core.db.get_connection).
Conn = Annotated[AsyncConnection, Depends(get_connection)]

# SQLSTATE de ``raise exception`` en PL/pgSQL: lo usan los triggers que protegen reglas
# de negocio (roles de sistema, rol administrador, etc.).
_SQLSTATE_RAISE = "P0001"


class Entrada(BaseModel):
    """Base de los esquemas de entrada.

    ``str_strip_whitespace`` recorta los textos antes de validar, de modo que un valor
    con solo espacios no pase la restricción de longitud mínima.
    """

    model_config = ConfigDict(str_strip_whitespace=True)


def rechazar_nulos(data: object, campos: set[str]) -> object:
    """Rechaza con 422 los ``campos`` enviados como ``null`` en un PATCH.

    Un campo que no admite null no se puede guardar y tampoco debe ignorarse en silencio.
    """
    if isinstance(data, dict):
        nulos = sorted(str(c) for c, v in data.items() if v is None and c in campos)
        if nulos:
            raise ValueError(f"Los campos no admiten null: {', '.join(nulos)}")
    return data


def _causa(exc: DBAPIError) -> object | None:
    """Excepción original de asyncpg, que trae el SQLSTATE y el mensaje de Postgres."""
    return exc.orig.__cause__ if exc.orig is not None else None


def regla_de_negocio(exc: DBAPIError) -> HTTPException | None:
    """Traduce el error de un trigger de la base a un 409 con su mensaje.

    Devuelve ``None`` si el error no proviene de un ``raise exception`` de la base, para
    que quien llama lo propague tal cual.
    """
    causa = _causa(exc)
    if getattr(causa, "sqlstate", None) != _SQLSTATE_RAISE:
        return None
    mensaje = getattr(causa, "message", None) or "Operación no permitida"
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(mensaje))


def traducir_error(
    exc: DBAPIError,
    *,
    unico: str = "Ya existe un registro con esos datos",
    referencia: str = "Hay un dato relacionado que no existe",
    referencia_status: int = 422,
) -> NoReturn:
    """Convierte un error de la base en la respuesta HTTP que corresponde y la lanza.

    * clave única (23505) -> 409 con el mensaje ``unico``;
    * clave foránea (23503) -> ``referencia_status`` con el mensaje ``referencia``: 422 si
      se intenta apuntar a algo que no existe, 409 si se intenta borrar algo en uso;
    * restricción CHECK (23514) -> 422;
    * ``raise exception`` de un trigger -> 409 con su mensaje.

    Cualquier otro error se propaga sin cambios (será un 500: es un fallo real).
    """
    estado = getattr(_causa(exc), "sqlstate", None)
    if estado == "23505":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=unico) from exc
    if estado == "23503":
        raise HTTPException(status_code=referencia_status, detail=referencia) from exc
    if estado == "23514":
        raise HTTPException(
            status_code=422,
            detail="Los datos no cumplen las reglas de validación",
        ) from exc
    regla = regla_de_negocio(exc)
    if regla is not None:
        raise regla from exc
    raise exc
