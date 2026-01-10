from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Risk Network Analyzer"
    debug: bool = False

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/risknetwork"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # NLP Model
    embedding_model: str = "all-MiniLM-L6-v2"

    # Clustering defaults
    min_cluster_size: int = 3
    similarity_threshold: float = 0.4

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
