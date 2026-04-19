from embeddings.service import query_similar, upsert_incident
from llm.chains import get_triage_chain


async def retrieve_and_triage(description: str, impact: str, provider: str = "openai") -> dict:
    """RAG pipeline: embed query → Pinecone search → augment prompt → triage chain."""

    # Step 1: Retrieve similar past incidents from Pinecone
    similar = query_similar(description, top_k=3)

    # Step 2: Format retrieved incidents as context
    context_parts = []
    for inc in similar:
        meta = inc["metadata"]
        res = meta.get("resolution")
        res_text = f"\n  - Resolution: {res}" if res else ""
        context_parts.append(
            f"- [{meta.get('priority', '?')}] {meta.get('description', '')} "
            f"(Category: {meta.get('category', '?')}, Team: {meta.get('suggested_team', '?')}, "
            f"Score: {inc['score']:.0%}){res_text}"
        )
    rag_context = "\n".join(context_parts) if context_parts else "Không có incident tương tự trước đây."

    # Step 3: Run triage chain with RAG-augmented context
    chain = get_triage_chain(provider)
    triage_result = await chain.ainvoke({
        "rag_context": rag_context,
        "description": description,
        "impact": impact or "Chưa rõ",
    })

    # Step 4: Store this incident in Pinecone for future RAG retrieval
    upsert_incident(description, {
        "description": description,
        "impact": impact,
        "priority": triage_result.get("priority", ""),
        "category": triage_result.get("category", ""),
        "suggested_team": triage_result.get("suggested_team", ""),
    })

    return {
        "triage": triage_result,
        "similar_incidents": similar,
    }
