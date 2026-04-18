import httpx
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_community.chat_models import ChatOllama
from config import get_settings


def get_llm(provider: str = "openai"):
    """Factory function to get the appropriate LLM based on provider."""
    settings = get_settings()

    if provider == "azure" and settings.AZURE_OPENAI_ENDPOINT:
        return AzureChatOpenAI(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_KEY,
            azure_deployment=settings.AZURE_DEPLOYMENT_NAME,
            api_version=settings.AZURE_API_VERSION,
            temperature=0.3,
        )
    elif provider == "ollama":
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model="llama3",
            temperature=0.3,
        )
    else:
        # Default: OpenAI-compatible (stu-platform)
        return ChatOpenAI(
            base_url=settings.OPENAI_BASE_URL,
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            temperature=0.3,
            max_tokens=2000,
        )


async def check_ollama() -> bool:
    """Check if Ollama is available."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            return res.status_code == 200
    except Exception:
        return False


async def check_providers() -> dict:
    """Check availability of all providers."""
    settings = get_settings()
    return {
        "openai": bool(settings.OPENAI_API_KEY),
        "azure": bool(settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_KEY),
        "ollama": await check_ollama(),
        "pinecone": bool(settings.PINECONE_API_KEY),
    }
