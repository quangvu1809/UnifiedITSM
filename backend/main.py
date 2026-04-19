from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from llm.providers import check_providers
from routers import triage, rca, resolution, escalation, workflow, incidents, auth, chatbot

settings = get_settings()

app = FastAPI(
    title="IT Incident Assistant API",
    description="Python backend with LangChain, LangGraph, RAG, Pinecone, HuggingFace",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "https://it-incident-assistant.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(triage.router)
app.include_router(rca.router)
app.include_router(resolution.router)
app.include_router(escalation.router)
app.include_router(workflow.router)
app.include_router(incidents.router)
app.include_router(chatbot.router)


@app.get("/api/health")
async def health_check():
    """Health check with provider status."""
    providers = await check_providers()
    return {
        "status": "ok",
        "providers": providers,
        "tech_stack": {
            "framework": "FastAPI",
            "llm": "LangChain + OpenAI / Azure / Ollama",
            "embeddings": "HuggingFace sentence-transformers",
            "vector_db": "Pinecone",
            "rag": "Custom RAG pipeline",
            "workflow": "LangGraph StateGraph",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
