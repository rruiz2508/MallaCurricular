"""Pruebas básicas de la API que no requieren base de datos."""

from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_health() -> None:
    """El endpoint de vida responde sin autenticación."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_me_requires_token() -> None:
    """Sin token, /me responde 401 sin necesidad de acceder a la base de datos."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/me")
    assert response.status_code == 401
