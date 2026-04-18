from fastapi import APIRouter, HTTPException
from models.schemas import EscalationRequest, EscalationResponse
from llm.chains import get_escalation_chain

router = APIRouter()


@router.post("/api/escalation", response_model=EscalationResponse)
async def draft_escalation(req: EscalationRequest):
    """Draft escalation email using LangChain chain."""
    if not req.summary.strip():
        raise HTTPException(400, "Vui lòng nhập thông tin incident")

    try:
        chain = get_escalation_chain(req.provider)
        result = await chain.ainvoke({
            "id": req.id or "N/A",
            "summary": req.summary,
            "to": req.to,
            "urgency": req.urgency,
            "done": req.done or "N/A",
            "ask": req.ask or "N/A",
        })
        return EscalationResponse(email=result)
    except Exception as e:
        raise HTTPException(500, f"Escalation error: {str(e)}")
