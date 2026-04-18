from fastapi import APIRouter, HTTPException
from models.schemas import WorkflowRequest, WorkflowResponse
from graph.workflow import incident_workflow

router = APIRouter()


@router.post("/api/workflow", response_model=WorkflowResponse)
async def run_workflow(req: WorkflowRequest):
    """Run full LangGraph incident workflow: classify → triage(+RAG) → RCA → resolution."""
    if not req.description.strip():
        raise HTTPException(400, "Vui lòng nhập mô tả incident")

    try:
        initial_state = {
            "description": req.description,
            "impact": req.impact,
            "provider": req.provider,
            "mode": req.mode,
            "triage_result": None,
            "similar_incidents": [],
            "rca_result": None,
            "resolution_draft": None,
        }

        result = await incident_workflow.ainvoke(initial_state)

        return WorkflowResponse(
            triage_result=result.get("triage_result"),
            similar_incidents=result.get("similar_incidents", []),
            rca_result=result.get("rca_result"),
            resolution_draft=result.get("resolution_draft"),
        )
    except Exception as e:
        raise HTTPException(500, f"Workflow error: {str(e)}")
