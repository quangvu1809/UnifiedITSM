from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI-compatible (stu-platform)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://aiportalapi.stu-platform.live/jpe/v1"
    OPENAI_MODEL: str = "GPT-4o-mini"

    # Azure AI (optional)
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_KEY: str = ""
    AZURE_DEPLOYMENT_NAME: str = ""
    AZURE_API_VERSION: str = "2024-02-15-preview"

    # Ollama (local)
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Pinecone
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "it-incidents"

    # HuggingFace
    HF_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    HF_API_TOKEN: str = ""

    # Default LLM provider
    LLM_PROVIDER: str = "openai"

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
