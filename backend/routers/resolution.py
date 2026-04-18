from fastapi import APIRouter, HTTPException
from models.schemas import ResolutionRequest, ResolutionResponse
from llm.chains import get_resolution_chain

router = APIRouter()


@router.post("/api/resolution", response_model=ResolutionResponse)
async def generate_resolution(req: ResolutionRequest):
    """Generate resolution summary using LangChain chain."""
    if not req.actions.strip():
        raise HTTPException(400, "Vui lòng nhập các actions đã thực hiện")

    try:
        chain = get_resolution_chain(req.provider)
        result = await chain.ainvoke({
            "summary": req.summary or "N/A",
            "actions": req.actions,
            "outcome": req.outcome,
        })
        return ResolutionResponse(resolution=result)
    except Exception as e:
        raise HTTPException(500, f"Resolution error: {str(e)}")
