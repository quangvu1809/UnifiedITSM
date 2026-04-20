from fastapi import APIRouter, HTTPException
from models.schemas import EscalationRequest, EscalationResponse
from llm.chains import get_escalation_chain

router = APIRouter()


@router.post("/api/escalation", response_model=EscalationResponse)
async def draft_escalation(req: EscalationRequest):
    """Draft escalation email using LangChain chain and Pinecone metadata."""
    if not req.id.strip():
        raise HTTPException(400, "Vui lòng nhập INC Number")
        
    from config import get_settings
    from embeddings.service import get_by_id
    import json
    
    settings = get_settings()
    
    # 1. Fetch Incident Details
    inc_id = req.id.strip().upper()
    results = get_by_id(inc_id, namespace=settings.INC_NAMESPACE)
    if not results:
        results = get_by_id(inc_id, namespace=settings.KB_NAMESPACE)
        
    if not results:
        incident_details = f"Incident {inc_id} not found in database. Xin hãy cung cấp fallback thông tin nếu cần thiết."
    else:
        meta = results[0]["metadata"]
        desc = meta.get("description", meta.get("content", "No description provided."))
        state = meta.get("state", "Unknown")
        resolution = meta.get("resolution", "None")
        
        history_str = "No history available."
        if "history" in meta:
            try:
                hist_arr = json.loads(meta["history"])
                history_str = "\n".join([f"- {h.get('timestamp', '')}: {h.get('action', '')} - {h.get('notes', '')}" for h in hist_arr])
            except:
                pass
                
        incident_details = f"Description:\n{desc}\n\nCurrent State: {state}\nLatest Options/Actions:\n{resolution}\n\nTimeline/History:\n{history_str}"

    try:
        chain = get_escalation_chain(req.provider)
        result = await chain.ainvoke({
            "id": req.id,
            "to": req.to,
            "cc": req.cc,
            "urgency": req.urgency,
            "incident_details": incident_details
        })
        return EscalationResponse(email=result)
    except Exception as e:
        raise HTTPException(500, f"Escalation error: {str(e)}")
