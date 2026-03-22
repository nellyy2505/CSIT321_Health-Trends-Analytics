from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # JWT auth (Azure / backend auth)
    SECRET_KEY: str = "change-me-in-production-use-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Azure Table Storage (optional; if not set, in-memory store is used for dev)
    AZURE_STORAGE_CONNECTION_STRING: str | None = None

    # OpenAI (for Health Scan / ChatGPT Vision)
    OPENAI_API_KEY: str | None = None

    # Voice Biomarker
    VOICE_UPLOAD_DIR: str = "voice_uploads"
    VOICE_LINK_EXPIRY_HOURS: int = 168  # 7 days
    VOICE_LINK_BASE_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
