from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./research_resources.db"
    jwt_secret_key: str = "change-this-development-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cookie_secure: bool = False

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")


settings = Settings()
