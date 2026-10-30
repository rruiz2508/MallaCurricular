"""Pruebas de validación de los esquemas del módulo de facultades (sin base de datos)."""

import pytest
from pydantic import ValidationError

from app.api.v1.facultades import FacultadIn, FacultadUpdate


def test_update_rechaza_campos_nulos() -> None:
    """Un PATCH con null no debe terminar en un 409 engañoso de "ya existe"."""
    with pytest.raises(ValidationError):
        FacultadUpdate(nombre=None)
    with pytest.raises(ValidationError):
        FacultadUpdate(activo=None)


def test_update_solo_incluye_campos_enviados() -> None:
    data = FacultadUpdate(activo=False)
    assert data.model_dump(exclude_unset=True) == {"activo": False}


def test_codigo_y_nombre_se_recortan() -> None:
    facultad = FacultadIn(codigo="  FCS  ", nombre="  Ciencias  ", activo=True)
    assert facultad.codigo == "FCS"
    assert facultad.nombre == "Ciencias"


def test_textos_en_blanco_se_rechazan() -> None:
    with pytest.raises(ValidationError):
        FacultadIn(codigo="   ", nombre="Ciencias", activo=True)
    with pytest.raises(ValidationError):
        FacultadUpdate(codigo="   ")
