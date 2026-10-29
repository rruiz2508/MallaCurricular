"""Configuración de la aplicación, leída de variables de entorno o del archivo ``.env``."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Valores configurables. Los nombres coinciden con las variables de entorno
    (sin distinguir mayúsculas), p. ej. ``DATABASE_URL`` -> ``database_url``."""

    # extra="ignore": variables desconocidas del .env no provocan error.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Conexión a Postgres con driver asíncrono (postgresql+asyncpg://...).
    database_url: str = ""
    # URL base del proyecto Supabase; de ella se derivan el JWKS y el emisor del JWT.
    supabase_url: str = ""
    # Orígenes autorizados por CORS, separados por coma.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        """Los orígenes CORS como lista, ignorando espacios y entradas vacías."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        """``database_url`` con el driver asíncrono (asyncpg) que usa la aplicación.

        Supabase entrega la cadena como ``postgresql://...``; aquí se convierte para que
        pueda pegarse tal cual en el .env sin tener que agregar ``+asyncpg``.
        """
        url = self.database_url
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url[len(prefix) :]
        return url

    @property
    def jwks_url(self) -> str:
        """Dirección pública con las claves que firman los JWT del proyecto."""
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def jwt_issuer(self) -> str:
        """Valor esperado en la reclamación ``iss`` de los JWT de este proyecto."""
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


@lru_cache
def get_settings() -> Settings:
    """Devuelve la configuración, creada una sola vez y compartida por toda la app."""
    return Settings()
