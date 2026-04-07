from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    anthropic_api_key: str
    voyage_api_key: str

    database_url: str
    session_secret: str
    encryption_key: str

    cors_origin: str = "http://localhost:5173"
    port: int = 8000
    node_env: str = "development"


settings = Settings()
