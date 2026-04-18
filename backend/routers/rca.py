from fastapi import APIRouter, HTTPException
from models.schemas import RCARequest, RCAResponse
from llm.chains import get_rca_chain

router = APIRouter()


@router.post("/api/rca", response_model=RCAResponse)
async def analyze_root_cause(req: RCARequest):
    """Analyze root cause using LangChain chain."""
    if not req.symptoms.strip():
        raise HTTPException(400, "Vui lòng nhập triệu chứng")

    try:
        chain = get_rca_chain(req.provider)
        result = await chain.ainvoke({
            "symptoms": req.symptoms,
            "logs": req.logs or "Không có",
            "timeline": req.timeline or "Chưa rõ",
        })
        return RCAResponse(analysis=result)
    except Exception as e:
        raise HTTPException(500, f"RCA error: {str(e)}")
