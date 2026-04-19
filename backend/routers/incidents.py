from fastapi import APIRouter, HTTPException, Query
from models.schemas import IncidentStore, ResolveRequest
from embeddings.service import upsert_incident, query_similar, seed_sample_incidents, delete_incident_by_id
from config import get_settings

router = APIRouter()


@router.post("/api/incidents/resolve")
async def resolve_incident(req: ResolveRequest):
    """Resolve or update an incident and learn from its status."""
    # Resolution is only required if the state is final
    if req.state in ["Resolved", "Closed"] and not req.resolution.strip():
        raise HTTPException(400, "Resolution notes required for final state")

    # If save_to_kb is enabled, we upsert it to Pinecone
    if req.save_to_kb:
        from config import get_settings
        from embeddings.service import get_by_id
        import json
        from datetime import datetime
        settings = get_settings()
        
        # 1. Check for existing history
        existing = get_by_id(req.number, namespace=settings.KB_NAMESPACE)
        history = []
        if existing and "history" in existing[0]["metadata"]:
            try:
                history = json.loads(existing[0]["metadata"]["history"])
            except:
                history = []
        
        # 2. Add new history entry
        new_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": f"Status: {req.state}",
            "notes": req.resolution or "No notes provided",
            "category": req.category,
            "priority": req.priority
        }
        history.append(new_entry)

        # 3. Upsert with INC Number as ID
        upsert_incident(
            f"{req.description}: {req.resolution}", 
            {
                "number": req.number,
                "title": f"Incident Resolution: {req.number}",
                "description": req.description,
                "content": f"Description: {req.description}\nResolution: {req.resolution}",
                "resolution": req.resolution,
                "category": req.category,
                "priority": req.priority,
                "type": "kb_entry",
                "history": json.dumps(history)
            },
            namespace=settings.KB_NAMESPACE,
            vector_id=req.number
        )

    return {"status": "resolved", "number": req.number}


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
    """Search Pinecone for similar items across both Incidents and KB namespaces."""
    from config import get_settings
    settings = get_settings()
    
    # Query Incidents namespace
    inc_results = query_similar(q, top_k=k, namespace=settings.INC_NAMESPACE)
    
    # Query Knowledge Base namespace
    kb_results = query_similar(q, top_k=k, namespace=settings.KB_NAMESPACE)
    
    # Merge and sort by score
    combined = inc_results + kb_results
    combined.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    # Return top K from the combined list
    final_results = combined[:k]
    
    return {"incidents": final_results, "count": len(final_results)}


@router.post("/api/incidents/seed")
async def seed_all():
    """Seed Pinecone with both sample incidents and KB articles."""
    from embeddings.service import seed_kb_articles
    inc_count = seed_sample_incidents()
    kb_count = seed_kb_articles()
    return {
        "status": "seeded",
        "incidents_count": inc_count,
        "kb_articles_count": kb_count
    }


@router.get("/api/incidents/search")
async def search_incidents(q: str = Query(..., min_length=2)):
    """Search for incidents by ID (Exact) or Description (Semantic)."""
    from embeddings.service import get_by_id, query_similar
    from config import get_settings
    settings = get_settings()

    # Determine if it's an ID search (starts with INC or KB)
    query_upper = q.upper().strip()
    is_id_search = query_upper.startswith("INC") or query_upper.startswith("KB")

    if is_id_search:
        # Try finding in both namespaces
        results = get_by_id(query_upper, namespace=settings.KB_NAMESPACE)
        if not results:
            results = get_by_id(query_upper, namespace=settings.INC_NAMESPACE)
        
        if not results:
            return {"status": "not_found", "message": f"Incident {query_upper} not found in Knowledge Base.", "results": []}
        
        return {"status": "success", "type": "exact", "results": results}
    else:
        # Semantic search in KB namespace
        results = query_similar(q, top_k=5, namespace=settings.KB_NAMESPACE)
        return {"status": "success", "type": "semantic", "results": results}
@router.delete("/api/incidents/{number}")
async def delete_incident(number: str):
    """Delete an incident from the Knowledge Base."""
    settings = get_settings()
    # Try deleting from both KB and INC namespaces if they exist
    success_kb = delete_incident_by_id(number, namespace=settings.KB_NAMESPACE)
    success_inc = delete_incident_by_id(number, namespace=settings.INC_NAMESPACE)
    
    if success_kb or success_inc:
        return {"message": f"Incident {number} deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to delete incident {number}")
