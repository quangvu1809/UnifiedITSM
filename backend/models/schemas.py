from pydantic import BaseModel
from typing import Optional


class TriageRequest(BaseModel):
    description: str
    impact: str = ""
    provider: str = "openai"


class TriageResult(BaseModel):
    priority: str = ""
    priority_reason: str = ""
    category: str = ""
    impact_assessment: dict = {}
    recommended_actions: list[str] = []
    suggested_team: str = ""
    confidence: float = 0.0


class TriageResponse(BaseModel):
    triage: dict
    similar_incidents: list[dict] = []


class RCARequest(BaseModel):
    symptoms: str
    logs: str = ""
    timeline: str = ""
    provider: str = "openai"


class RCAResponse(BaseModel):
    analysis: str


class ResolutionRequest(BaseModel):
    summary: str = ""
    actions: str
    outcome: str = "Resolved"
    provider: str = "openai"


class ResolutionResponse(BaseModel):
    resolution: str


class EscalationRequest(BaseModel):
    id: str = ""
    summary: str
    to: str = "L2 Support"
    urgency: str = "High"
    done: str = ""
    ask: str = ""
    provider: str = "openai"


class EscalationResponse(BaseModel):
    email: str


class WorkflowRequest(BaseModel):
    description: str
    impact: str = ""
    mode: str = "full"
    provider: str = "openai"


class WorkflowResponse(BaseModel):
    triage_result: Optional[dict] = None
    similar_incidents: list[dict] = []
    rca_result: Optional[str] = None
    resolution_draft: Optional[str] = None


class IncidentStore(BaseModel):
    description: str
    impact: str = ""
    priority: str = ""
    category: str = ""
    suggested_team: str = ""


class HealthResponse(BaseModel):
    status: str
    providers: dict
