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
                "subcategory": req.subcategory,
                "priority": req.priority,
                "state": req.state,
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
        "number": req.number,
        "caller": req.caller,
        "description": req.description,
        "impact": req.impact,
        "priority": req.priority,
        "category": req.category,
        "subcategory": req.subcategory,
        "state": req.state,
        "suggested_team": req.suggested_team,
    }, vector_id=req.number)

    return {"id": incident_id, "status": "stored"}


@router.get("/api/incidents/similar")
async def find_similar(
    q: str = Query(..., min_length=1), 
    k: int = Query(5, ge=1, le=20),
    priority: str = Query(None),
    subcategory: str = Query(None),
    state: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    kb_only: bool = Query(False)
):
    """Search Pinecone for similar items with optional metadata filtering."""
    from config import get_settings
    settings = get_settings()
    
    # 1. Detect if query is an INC number for exact match logic
    query_upper = q.upper().strip()
    if query_upper.startswith("INC") or query_upper.startswith("KB"):
        from embeddings.service import get_by_id
        results = get_by_id(query_upper, namespace=settings.INC_NAMESPACE)
        if not results:
            results = get_by_id(query_upper, namespace=settings.KB_NAMESPACE)
        if results:
            # Format results to match search output
            formatted = [{"id": r["id"], "score": 1.0, "metadata": r["metadata"]} for r in results]
            return {"incidents": formatted, "count": len(formatted)}

    filters = {}
    if priority and priority != "all":
        filters["priority"] = {"$eq": priority}
    if subcategory and subcategory != "all":
        filters["subcategory"] = {"$eq": subcategory}
    
    if state and state != "all":
        filters["state"] = {"$eq": state}
    
    if start_date or end_date:
        time_filter = {}
        if start_date:
            time_filter["$gte"] = start_date
        if end_date:
            time_filter["$lte"] = end_date
        filters["timestamp"] = time_filter

    # 3. Query Namespaces
    kb_results = query_similar(q, top_k=k, namespace=settings.KB_NAMESPACE, metadata=filters)
    
    if kb_only:
        combined = kb_results
    else:
        inc_results = query_similar(q, top_k=k, namespace=settings.INC_NAMESPACE, metadata=filters)
        combined = inc_results + kb_results
        
    combined.sort(key=lambda x: x.get("score", 0), reverse=True)
    
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
@router.post("/api/incidents/cleanup")
async def cleanup_incidents():
    """Wipe all temporary incidents and KB articles for a fresh start."""
    from embeddings.service import delete_namespace
    from config import get_settings
    settings = get_settings()
    
    # Attempt to clear both namespaces
    res_inc = delete_namespace(settings.INC_NAMESPACE)
    res_kb = delete_namespace(settings.KB_NAMESPACE)
    
    return {
        "status": "success", 
        "message": "Cleanup attempt completed.",
        "details": {
            "incidents": "Cleared" if res_inc else "Already empty or error",
            "kb": "Cleared" if res_kb else "Already empty or error"
        }
    }


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
