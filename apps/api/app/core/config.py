from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = next(
    (parent for parent in Path(__file__).resolve().parents if (parent / "compose.yaml").is_file()),
    Path(__file__).resolve().parents[2],
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", extra="ignore")
    environment: str = "development"
    database_url: str = "postgresql+psycopg://atlanta:atlanta@127.0.0.1:55432/atlanta"
    app_origin: str = "http://localhost:3000"
    secret_key: str = "local-development-only-change-before-deploy"
    google_client_id: str = ""
    google_client_secret: str = ""
    openai_api_key: str = ""
    openai_model: str = ""
    resend_api_key: str = ""
    mail_from: str = ""
    maptiler_key: str = ""
    maptiler_geocoding_key: str = ""  # Legacy; backend lookup no longer uses MapTiler.
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    geocoding_cache_path: str = str(PROJECT_ROOT / ".local/geocoding.sqlite")
    map_style_url: str = "https://tiles.openfreemap.org/styles/positron"
    ai_daily_limit: int = 100

    def assert_production(self):
        if self.environment == "production" and (
            len(self.secret_key) < 32 or self.secret_key.startswith("local-")
        ):
            raise ValueError("Set a unique SECRET_KEY of at least 32 characters in production")


settings = Settings()
settings.assert_production()
