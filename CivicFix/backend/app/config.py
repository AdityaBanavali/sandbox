import json
from functools import lru_cache
from pathlib import Path
from typing import Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    MAX_GPS_DISTANCE_M: float = 25.0
    MAX_UPLOAD_MB: int = 10
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"]
    FIXTURES_DIR: Path = Path(__file__).resolve().parent / "fixtures"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str):
            trimmed = v.strip()
            if trimmed.startswith("[") and trimmed.endswith("]"):
                try:
                    parsed = json.loads(trimmed)
                    if isinstance(parsed, list):
                        return [str(item) for item in parsed]
                except Exception:
                    pass
            return [item.strip() for item in trimmed.split(",") if item.strip()]
        if isinstance(v, list):
            return [str(item) for item in v]
        return ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
