from fastapi import APIRouter, HTTPException, Query
from models.schemas import IncidentStore
from embeddings.service import upsert_incident, query_similar, seed_sample_incidents

router = APIRouter()


@router.post("/api/incidents")
async def store_incident(req: IncidentStore):
    """Store an incident in Pinecone vector DB."""
    if not req.description.strip():
        raise HTTPException(400, "Description required")

    incident_id = upsert_incident(req.description, {
        "description": req.description,
        "impact": req.impact,
        "priority": req.priority,
        "category": req.category,
        "suggested_team": req.suggested_team,
    })

    return {"id": incident_id, "status": "stored"}


@router.get("/api/incidents/similar")
async def find_similar(q: str = Query(..., min_length=5), k: int = Query(5, ge=1, le=20)):
    """Search Pinecone for similar past incidents using HuggingFace embeddings."""
    results = query_similar(q, top_k=k)
    return {"incidents": results, "count": len(results)}


@router.post("/api/incidents/seed")
async def seed_incidents():
    """Seed Pinecone with sample incidents for demo."""
    count = seed_sample_incidents()
    return {"status": "seeded", "count": count}
