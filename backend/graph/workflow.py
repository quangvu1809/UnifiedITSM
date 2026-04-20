from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from embeddings.service import query_similar, upsert_incident
from llm.chains import get_triage_chain, get_rca_chain, get_resolution_chain


class IncidentState(TypedDict):
    description: str
    impact: str
    provider: str
    mode: str  # "full" | "triage_only"
    triage_result: Optional[dict]
    similar_incidents: list
    rca_result: Optional[str]
    resolution_draft: Optional[str]


def classify_node(state: IncidentState) -> dict:
    """Determine if incident needs full workflow or triage only."""
    return {"mode": state.get("mode", "full")}


def triage_node(state: IncidentState) -> dict:
    """Run RAG-augmented triage (Pinecone + HuggingFace + LangChain)."""
    provider = state.get("provider", "openai")
    description = state["description"]
    impact = state.get("impact", "")

    # RAG: retrieve similar incidents from Pinecone
    similar = query_similar(description, top_k=3)
    context_parts = []
    for inc in similar:
        meta = inc["metadata"]
        context_parts.append(
            f"- [{meta.get('priority', '?')}] {meta.get('description', '')} "
            f"(Category: {meta.get('category', '?')}, Score: {inc['score']:.0%})"
        )
    rag_context = "\n".join(context_parts) if context_parts else "Không có incident tương tự."

    # LangChain: run triage chain (sync invoke)
    chain = get_triage_chain(provider)
    triage_result = chain.invoke({
        "rag_context": rag_context,
        "description": description,
        "impact": impact or "Chưa rõ",
    })

    return {
        "triage_result": triage_result,
        "similar_incidents": similar,
    }


def rca_node(state: IncidentState) -> dict:
    """Auto-suggest RCA based on triage output."""
    chain = get_rca_chain(state.get("provider", "openai"))
    triage = state.get("triage_result", {})
    result = chain.invoke({
        "symptoms": state["description"],
        "logs": f"Triage: {triage.get('priority', 'N/A')} - {triage.get('category', 'N/A')}",
        "timeline": "Auto-generated from workflow",
    })
    return {"rca_result": result}


def resolution_node(state: IncidentState) -> dict:
    """Draft resolution template based on triage + RCA."""
    chain = get_resolution_chain(state.get("provider", "openai"))
    rca = state.get("rca_result", "")
    result = chain.invoke({
        "summary": state["description"],
        "actions": f"Based on RCA: {rca[:300] if rca else 'N/A'}",
        "outcome": "Pending",
    })
    return {"resolution_draft": result}


def route_after_triage(state: IncidentState) -> str:
    """Conditional edge: full workflow continues to RCA, triage_only stops."""
    if state.get("mode") == "full":
        return "rca_node"
    return END


# Build the LangGraph StateGraph
def build_workflow():
    graph = StateGraph(IncidentState)

    # Add nodes
    graph.add_node("classify", classify_node)
    graph.add_node("triage_node", triage_node)
    graph.add_node("rca_node", rca_node)
    graph.add_node("resolution_node", resolution_node)

    # Set entry point
    graph.set_entry_point("classify")

    # Add edges
    graph.add_edge("classify", "triage_node")
    graph.add_conditional_edges("triage_node", route_after_triage)
    graph.add_edge("rca_node", "resolution_node")
    graph.add_edge("resolution_node", END)

    return graph.compile()


# Compiled workflow app
incident_workflow = build_workflow()
