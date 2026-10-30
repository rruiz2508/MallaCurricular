"""Pruebas de validación de los esquemas de roles y usuarios (sin base de datos)."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.v1.roles import RolIn, RolUpdate
from app.api.v1.usuarios import PasswordIn, UsuarioIn, UsuarioUpdate


def test_rol_normaliza_permisos() -> None:
    rol = RolIn(nombre="  Auditor ", permisos=["a.leer", " a.leer ", "", "b.leer"])
    assert rol.nombre == "Auditor"
    assert rol.permisos == ["a.leer", "b.leer"]


def test_rol_update_acepta_descripcion_nula_pero_no_nombre_nulo() -> None:
    assert RolUpdate(descripcion=None).model_dump(exclude_unset=True) == {"descripcion": None}
    with pytest.raises(ValidationError):
        RolUpdate(nombre=None)
    with pytest.raises(ValidationError):
        RolUpdate(permisos=None)


def test_rol_update_solo_incluye_campos_enviados() -> None:
    assert RolUpdate(permisos=[]).model_dump(exclude_unset=True) == {"permisos": []}


def test_usuario_normaliza_email_y_conserva_password() -> None:
    usuario = UsuarioIn(email="Ana@Ejemplo.COM", password="  clave1234 ", nombre=" Ana ")
    assert usuario.email == "ana@ejemplo.com"
    assert usuario.password == "  clave1234 "
    assert usuario.nombre == "Ana"


@pytest.mark.parametrize("email", ["sin-arroba", "a@b", "a b@c.com", ""])
def test_usuario_rechaza_emails_invalidos(email: str) -> None:
    with pytest.raises(ValidationError):
        UsuarioIn(email=email, password="clave1234", nombre="Ana")


def test_password_longitud() -> None:
    with pytest.raises(ValidationError):
        PasswordIn(password="corta")
    with pytest.raises(ValidationError):
        PasswordIn(password="x" * 73)
    assert PasswordIn(password="x" * 8).password == "x" * 8


def test_usuario_update_rechaza_nulos() -> None:
    for campo in ("nombre", "apellido", "activo", "roles"):
        with pytest.raises(ValidationError):
            UsuarioUpdate(**{campo: None})
    assert UsuarioUpdate(roles=[uuid4()]).model_dump(exclude_unset=True).keys() == {"roles"}
