from fastapi import APIRouter, HTTPException
from models.schemas import TriageRequest, TriageResponse
from rag.retriever import retrieve_and_triage

router = APIRouter()


@router.post("/api/triage", response_model=TriageResponse)
async def triage_incident(req: TriageRequest):
    """Triage an incident using RAG + Pinecone + HuggingFace + LangChain."""
    if not req.description.strip():
        raise HTTPException(400, "Vui lòng nhập mô tả incident")

    try:
        result = await retrieve_and_triage(
            description=req.description,
            impact=req.impact,
            provider=req.provider,
        )
        return TriageResponse(
            triage=result["triage"],
            similar_incidents=result["similar_incidents"],
        )
    except Exception as e:
        raise HTTPException(500, f"Triage error: {str(e)}")
