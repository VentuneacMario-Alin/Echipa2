from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./research_resources.db"
    jwt_secret_key: str = "change-this-development-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:8000,http://127.0.0.1:8000"
    admin_email: str | None = None
    admin_password: str | None = None

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
