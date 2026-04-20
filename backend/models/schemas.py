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
    suggested_resolution: Optional[str] = None
    confidence: float = 0.0


class TriageResponse(BaseModel):
    triage: TriageResult
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
    id: str
    to: str
    cc: str = ""
    urgency: str = "High"
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
    number: Optional[str] = None
    caller: Optional[str] = None
    description: str
    impact: str = ""
    priority: str = ""
    category: str = ""
    subcategory: Optional[str] = None
    suggested_team: str = ""
    resolution: Optional[str] = None
    state: str = "New"


class ResolveRequest(BaseModel):
    number: str
    description: str
    resolution: str = ""
    category: Optional[str] = None
    subcategory: Optional[str] = None
    priority: Optional[str] = None
    state: str = "New"
    save_to_kb: bool = True


class HealthResponse(BaseModel):
    status: str
    providers: dict
