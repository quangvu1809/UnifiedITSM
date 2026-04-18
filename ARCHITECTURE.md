# IT Incident Assistant - Architecture & Knowledge Map

## 1. Project Structure

```
it-incident-assistant/
├── src/                              # FRONTEND (React)
│   ├── App.jsx                       # Main UI component (~700 lines)
│   ├── main.jsx                      # React entry point
│   ├── index.css                     # Global CSS + dark mode
│   └── App.test.jsx                  # Frontend tests
│
├── backend/                          # BACKEND (Python FastAPI)
│   ├── main.py                       # FastAPI app + CORS + routers
│   ├── config.py                     # Settings (pydantic-settings)
│   ├── requirements.txt              # Python dependencies
│   ├── .env                          # Backend secrets (KHÔNG commit!)
│   │
│   ├── llm/                          # LLM Integration
│   │   ├── providers.py              # ChatOpenAI / AzureChatOpenAI / ChatOllama
│   │   └── chains.py                 # LangChain LCEL chains (4 modules)
│   │
│   ├── embeddings/                   # HuggingFace + Pinecone
│   │   └── service.py                # sentence-transformers + vector DB ops
│   │
│   ├── rag/                          # RAG Pipeline
│   │   └── retriever.py              # embed → Pinecone search → augment prompt
│   │
│   ├── graph/                        # LangGraph
│   │   └── workflow.py               # StateGraph: classify → triage → RCA → resolution
│   │
│   ├── routers/                      # API Endpoints
│   │   ├── triage.py                 # POST /api/triage (RAG-augmented)
│   │   ├── rca.py                    # POST /api/rca
│   │   ├── resolution.py             # POST /api/resolution
│   │   ├── escalation.py             # POST /api/escalation
│   │   ├── workflow.py               # POST /api/workflow (LangGraph)
│   │   └── incidents.py              # Pinecone CRUD + similarity search
│   │
│   └── models/
│       └── schemas.py                # Pydantic request/response models
│
├── api/chat.js                       # Legacy Vercel serverless (backup)
├── vercel.json                       # Frontend deploy config
└── vite.config.js                    # Vite + dev proxy → Python backend
```

## 2. Course Technology Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                  COURSE REQUIREMENTS                         │
│                                                              │
│  ┌──────────┐   File: backend/llm/providers.py               │
│  │ OpenAI   │   ChatOpenAI(base_url=stu-platform)            │
│  │ API      │   → Primary LLM for all AI modules             │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/llm/providers.py               │
│  │ Llama3   │   ChatOllama(model="llama3")                   │
│  │ (Ollama) │   → Sensitive data routing (PII detected)      │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/llm/providers.py               │
│  │ Azure AI │   AzureChatOpenAI(azure_endpoint=...)          │
│  │          │   → Alternative cloud provider                  │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/llm/chains.py                  │
│  │ LangChain│   PromptTemplate | LLM | OutputParser (LCEL)   │
│  │          │   → 4 chains: triage, rca, resolution, escal.  │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/embeddings/service.py          │
│  │HuggingFace   SentenceTransformer("all-MiniLM-L6-v2")     │
│  │Embeddings│   → Encode incidents to 384-dim vectors        │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/embeddings/service.py          │
│  │ Pinecone │   Index: "it-incidents", 384 dims, cosine      │
│  │          │   → Store & search past incident vectors        │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/rag/retriever.py               │
│  │   RAG    │   embed query → Pinecone top-k → augment prompt│
│  │          │   → Triage uses past incidents as context       │
│  └──────────┘                                                │
│                                                              │
│  ┌──────────┐   File: backend/graph/workflow.py              │
│  │ LangGraph│   StateGraph: classify → triage → RCA → resol. │
│  │          │   → Full incident workflow orchestration        │
│  └──────────┘                                                │
└─────────────────────────────────────────────────────────────┘
```

## 3. System Architecture

```
┌────────────────────────────────┐
│   React Frontend (Vercel)      │
│   - 5 tabs: Triage, RCA,      │
│     Resolution, Escalation,    │
│     SLA Timer                  │
│   - Dark mode, PDF export      │
│   - Provider toggle (OpenAI/   │
│     Ollama/Azure)              │
└───────────┬────────────────────┘
            │ fetch("/api/triage")
            │ fetch("/api/workflow")
            │ etc.
            ▼
┌────────────────────────────────┐
│   Python Backend (Railway)     │
│   FastAPI + uvicorn            │
│                                │
│   ┌──────────────────────┐     │
│   │  LangChain Chains    │     │     ┌──────────────┐
│   │  (triage/rca/res/esc)│────────→  │ OpenAI API   │
│   └──────────────────────┘     │     │ (GPT-4o-mini)│
│                                │     └──────────────┘
│   ┌──────────────────────┐     │     ┌──────────────┐
│   │  LangGraph Workflow  │     │     │ Ollama Local │
│   │  (StateGraph)        │────────→  │ (Llama3)     │
│   └──────────────────────┘     │     └──────────────┘
│                                │     ┌──────────────┐
│   ┌──────────────────────┐     │     │ Azure AI     │
│   │  RAG Pipeline        │────────→  │ (optional)   │
│   │  embed → search →    │     │     └──────────────┘
│   │  augment             │     │
│   └──────────┬───────────┘     │
│              │                 │
│   ┌──────────▼───────────┐     │     ┌──────────────┐
│   │  HuggingFace         │     │     │  Pinecone    │
│   │  sentence-transformers│────────→ │  Vector DB   │
│   │  (all-MiniLM-L6-v2)  │     │     │  384 dims    │
│   └──────────────────────┘     │     └──────────────┘
└────────────────────────────────┘
```

## 4. API Endpoints

| Method | Endpoint | Input | Output | Tech Stack |
|--------|----------|-------|--------|------------|
| POST | `/api/triage` | description, impact | triage JSON + similar incidents | **RAG + Pinecone + HuggingFace + LangChain** |
| POST | `/api/rca` | symptoms, logs, timeline | markdown analysis | **LangChain** chain |
| POST | `/api/resolution` | summary, actions, outcome | markdown resolution | **LangChain** chain |
| POST | `/api/escalation` | id, summary, to, urgency | email draft | **LangChain** chain |
| POST | `/api/workflow` | description, impact, mode | triage + RCA + resolution | **LangGraph** StateGraph |
| GET | `/api/incidents/similar?q=` | query text | similar incidents list | **Pinecone + HuggingFace** |
| POST | `/api/incidents/seed` | none | seed count | **Pinecone** sample data |
| GET | `/api/health` | none | provider status | Health check |

## 5. Data Flow: Triage with RAG

```
User types incident description
        │
        ▼
Frontend: POST /api/triage { description, impact, provider }
        │
        ▼
backend/routers/triage.py
        │
        ▼
backend/rag/retriever.py: retrieve_and_triage()
  │
  ├─① HuggingFace: embed_text(description)
  │     └── SentenceTransformer("all-MiniLM-L6-v2")
  │         → 384-dimensional vector
  │
  ├─② Pinecone: query_similar(vector, top_k=3)
  │     └── Cosine similarity search
  │         → Top 3 similar past incidents
  │
  ├─③ Format RAG context:
  │     "- [P1] Server down (Category: Database, Score: 92%)"
  │     "- [P2] Performance issue (Category: Infra, Score: 78%)"
  │
  ├─④ LangChain: triage_chain.ainvoke({
  │     rag_context, description, impact })
  │     └── PromptTemplate | ChatOpenAI | JsonOutputParser
  │         → { priority, category, team, actions, confidence }
  │
  └─⑤ Pinecone: upsert_incident(description, metadata)
        └── Store this incident for future RAG
        │
        ▼
Response: { triage: {...}, similar_incidents: [...] }
        │
        ▼
Frontend renders: priority badge + actions + similar incidents
```

## 6. LangGraph Workflow

```
┌─────────────┐
│   START     │  Input: { description, impact, mode, provider }
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  classify   │  Determine: "full" or "triage_only"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   triage    │  RAG-augmented triage
│   + RAG     │  (Pinecone + HuggingFace + LangChain)
└──────┬──────┘
       │
  ┌────┴────┐
  │ mode?   │
  ├─full────┤
  │         ▼
  │  ┌──────────┐
  │  │   RCA    │  Auto-suggest root cause
  │  │  suggest │  based on triage output
  │  └────┬─────┘
  │       │
  │       ▼
  │  ┌──────────┐
  │  │resolution│  Draft resolution template
  │  │  draft   │  based on triage + RCA
  │  └────┬─────┘
  │       │
  └──┬────┘
     ▼
┌─────────────┐
│    END      │  Output: { triage_result, rca_result,
└─────────────┘           resolution_draft, similar_incidents }
```

## 7. Pinecone Vector DB Schema

- **Index:** `it-incidents`
- **Dimensions:** 384 (matches all-MiniLM-L6-v2)
- **Metric:** cosine
- **Namespace:** `incidents`

**Metadata per vector:**
```json
{
  "description": "Production server down...",
  "impact": "500+ users",
  "priority": "P1",
  "category": "Database",
  "suggested_team": "DBA Team",
  "timestamp": "2026-04-04T12:00:00"
}
```

## 8. Key Python Patterns

| Pattern | File | Explanation |
|---------|------|-------------|
| LCEL (LangChain Expression Language) | `chains.py` | `prompt \| llm \| parser` pipe syntax |
| Pydantic Settings | `config.py` | Type-safe env var loading |
| Dependency Injection | `providers.py` | `get_llm(provider)` factory pattern |
| Lazy Loading | `service.py` | Model loaded on first use, cached globally |
| StateGraph | `workflow.py` | LangGraph state machine with conditional edges |
| RAG Pipeline | `retriever.py` | Retrieve → Augment → Generate |

## 9. How to Run

```bash
# Backend (Terminal 1)
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000 (API docs: /docs)

# Frontend (Terminal 2)
npm run dev
# → http://localhost:5173 (auto-proxies /api to :8000)

# Seed Pinecone with sample data
curl -X POST http://localhost:8000/api/incidents/seed

# Health check
curl http://localhost:8000/api/health
```

## 10. Deploy

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel (free) | https://it-incident-assistant.vercel.app |
| Backend | Railway (free 500h/month) | https://your-backend.railway.app |

**Environment Variables (Railway):**
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`
- `FRONTEND_URL` (Vercel URL for CORS)

**Environment Variables (Vercel):**
- `VITE_API_URL` → Railway backend URL
