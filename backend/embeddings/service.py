from huggingface_hub import InferenceClient
from pinecone import Pinecone
from config import get_settings
from datetime import datetime
from uuid import uuid4

# Lazy-loaded globals
_index = None
_hf_client = None


def get_hf_client():
    global _hf_client
    if _hf_client is None:
        settings = get_settings()
        _hf_client = InferenceClient(token=settings.HF_API_TOKEN)
    return _hf_client


def get_pinecone_index():
    global _index
    if _index is None:
        settings = get_settings()
        if not settings.PINECONE_API_KEY:
            return None
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        _index = pc.Index(settings.PINECONE_INDEX_NAME)
    return _index


def embed_text(text: str) -> list[float]:
    """Encode text to vector using HuggingFace Inference API (sentence-transformers)."""
    settings = get_settings()
    client = get_hf_client()
    result = client.feature_extraction(text, model=settings.HF_EMBEDDING_MODEL)
    return result.tolist() if hasattr(result, 'tolist') else list(result)


def upsert_incident(text: str, metadata: dict) -> str:
    """Store incident embedding in Pinecone."""
    index = get_pinecone_index()
    if index is None:
        return ""

    incident_id = f"inc-{uuid4().hex[:12]}"
    vector = embed_text(text)
    metadata["timestamp"] = datetime.utcnow().isoformat()

    index.upsert(
        vectors=[{"id": incident_id, "values": vector, "metadata": metadata}],
        namespace="incidents",
    )
    return incident_id


def query_similar(text: str, top_k: int = 5) -> list[dict]:
    """Search Pinecone for similar incidents."""
    index = get_pinecone_index()
    if index is None:
        return []

    vector = embed_text(text)
    results = index.query(
        vector=vector,
        top_k=top_k,
        namespace="incidents",
        include_metadata=True,
    )

    return [
        {
            "id": match.id,
            "score": round(match.score, 3),
            "metadata": match.metadata,
        }
        for match in results.matches
    ]


def seed_sample_incidents():
    """Seed Pinecone with sample incidents for demo."""
    samples = [
        {
            "text": "Production server không response từ 14:30. Users không thể login vào CRM. Error: Connection timeout to database.",
            "metadata": {"description": "Production server down - CRM inaccessible", "impact": "500+ users", "priority": "P1", "category": "Database", "suggested_team": "DBA Team"},
        },
        {
            "text": "Website load chậm >10s. CPU 95%, memory leak suspected.",
            "metadata": {"description": "Website performance degradation - high CPU", "impact": "200 users", "priority": "P2", "category": "Performance", "suggested_team": "SRE Team"},
        },
        {
            "text": "API sync SAP-Salesforce fail. Error 401 Unauthorized.",
            "metadata": {"description": "SAP-Salesforce integration auth failure", "impact": "Order processing delay", "priority": "P3", "category": "Integration", "suggested_team": "Dev Team"},
        },
        {
            "text": "Email server không gửi được email. SMTP connection refused port 587.",
            "metadata": {"description": "Email server SMTP failure", "impact": "All employees", "priority": "P2", "category": "Infrastructure", "suggested_team": "Network Team"},
        },
        {
            "text": "User không login được VPN. Error: Certificate expired.",
            "metadata": {"description": "VPN certificate expiration", "impact": "Remote workers", "priority": "P3", "category": "Security", "suggested_team": "Security Team"},
        },
        {
            "text": "Database replication lag > 30 minutes. Slave không sync với master.",
            "metadata": {"description": "DB replication lag", "impact": "Reporting delayed", "priority": "P2", "category": "Database", "suggested_team": "DBA Team"},
        },
        {
            "text": "Kubernetes pod CrashLoopBackOff. OOMKilled - container memory limit exceeded.",
            "metadata": {"description": "K8s pod OOM crash loop", "impact": "Microservice down", "priority": "P1", "category": "Infrastructure", "suggested_team": "DevOps Team"},
        },
        {
            "text": "SSL certificate hết hạn trên load balancer. Browser hiện warning không an toàn.",
            "metadata": {"description": "SSL cert expired on LB", "impact": "All web users", "priority": "P1", "category": "Security", "suggested_team": "Network Team"},
        },
    ]

    index = get_pinecone_index()
    if index is None:
        return 0

    for sample in samples:
        upsert_incident(sample["text"], sample["metadata"])

    return len(samples)
