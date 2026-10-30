"""Pruebas de la validación del JWT, sin red ni acceso a la base.

El cliente JWKS y la configuración se sustituyen por dobles de prueba: el token se
firma con una clave RSA generada en el propio test.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core import security

_ISSUER = "https://test.supabase.co/auth/v1"
_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_SUB = "3f1b0f0e-0000-4000-8000-000000000000"


class _Jwks:
    """Sustituto del cliente JWKS: siempre devuelve la clave pública de prueba."""

    def get_signing_key_from_jwt(self, _token: str) -> SimpleNamespace:
        return SimpleNamespace(key=_PRIVATE_KEY.public_key())


def _settings(supabase_url: str = "https://test.supabase.co") -> SimpleNamespace:
    return SimpleNamespace(
        supabase_url=supabase_url,
        jwks_url=f"{supabase_url}/auth/v1/.well-known/jwks.json",
        jwt_issuer=_ISSUER,
    )


def _token(claims: dict[str, object]) -> str:
    return jwt.encode(claims, _PRIVATE_KEY, algorithm="RS256", headers={"kid": "test"})


def _claims(**extra: object) -> dict[str, object]:
    claims: dict[str, object] = {
        "sub": _SUB,
        "aud": "authenticated",
        "iss": _ISSUER,
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    claims.update(extra)
    return claims


@pytest.fixture
def jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    """Evita descargar el JWKS real de Supabase."""
    monkeypatch.setattr(security, "_jwks_client", lambda: _Jwks())
    monkeypatch.setattr(security, "get_settings", lambda: _settings())


def test_token_valido(jwks: None) -> None:
    claims = security._decode_token(_token(_claims()))
    assert claims["sub"] == _SUB


def test_token_sin_vencimiento(jwks: None) -> None:
    claims = _claims()
    del claims["exp"]
    with pytest.raises(HTTPException) as exc:
        security._decode_token(_token(claims))
    assert exc.value.status_code == 401


def test_token_sin_usuario(jwks: None) -> None:
    claims = _claims()
    del claims["sub"]
    with pytest.raises(HTTPException) as exc:
        security._decode_token(_token(claims))
    assert exc.value.status_code == 401


def test_token_vencido(jwks: None) -> None:
    with pytest.raises(HTTPException) as exc:
        security._decode_token(_token(_claims(exp=datetime.now(UTC) - timedelta(minutes=1))))
    assert exc.value.status_code == 401


def test_token_de_otro_emisor(jwks: None) -> None:
    with pytest.raises(HTTPException) as exc:
        security._decode_token(_token(_claims(iss="https://otro.supabase.co/auth/v1")))
    assert exc.value.status_code == 401


async def test_sub_no_uuid_responde_401() -> None:
    with pytest.raises(HTTPException) as exc:
        await security.get_current_user({"sub": "no-es-un-uuid"}, object())  # type: ignore[arg-type]
    assert exc.value.status_code == 401


def test_jwks_sin_supabase_url_responde_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "get_settings", lambda: _settings(supabase_url=""))
    security._jwks_client.cache_clear()
    with pytest.raises(HTTPException) as exc:
        security._jwks_client()
    assert exc.value.status_code == 503
