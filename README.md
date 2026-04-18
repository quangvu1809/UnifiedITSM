# IT Incident Assistant

AI-powered IT Incident Management tool with Python backend and React frontend.

## Features

- **Triage** - Phân loại Priority & Category tự động (RAG-augmented)
- **Root Cause** - Phân tích nguyên nhân từ logs/symptoms
- **Resolution** - Generate resolution summary (SFDC-ready) + PDF export
- **Escalation** - Soạn email escalate chuyên nghiệp
- **SLA Timer** - Countdown timer theo priority (P1-P4)
- **Full Workflow** - LangGraph orchestration: Triage → RCA → Resolution tự động
- **Dark Mode** - Toggle light/dark theme

## Course Technologies Applied

| Technology | Implementation | File |
|-----------|---------------|------|
| **Python** | FastAPI backend | `backend/main.py` |
| **OpenAI API** | ChatOpenAI (GPT-4o-mini) | `backend/llm/providers.py` |
| **Llama3** | ChatOllama for sensitive data | `backend/llm/providers.py` |
| **HuggingFace + Embeddings** | sentence-transformers (all-MiniLM-L6-v2) | `backend/embeddings/service.py` |
| **Pinecone** | Vector DB for incident storage/search | `backend/embeddings/service.py` |
| **LangChain** | LCEL chains (PromptTemplate \| LLM \| Parser) | `backend/llm/chains.py` |
| **RAG** | Embed → Pinecone search → Augment prompt | `backend/rag/retriever.py` |
| **LangGraph** | StateGraph: classify → triage → RCA → resolution | `backend/graph/workflow.py` |
| **Azure AI** | AzureChatOpenAI alternative provider | `backend/llm/providers.py` |

## Architecture

```
React Frontend (Vercel)
        │  /api/triage, /api/workflow, etc.
        ▼
Python Backend (FastAPI)
  ├── LangChain chains ──→ OpenAI API / Ollama / Azure
  ├── LangGraph workflow
  ├── RAG pipeline
  ├── HuggingFace embeddings ──→ Pinecone vector DB
  └── Input moderation (PII detection)
```

## Quick Start

### Backend (Terminal 1)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your API keys (OPENAI_API_KEY, PINECONE_API_KEY)

# Start
python main.py
# → http://localhost:8000 (API docs: http://localhost:8000/docs)

# Seed sample incidents in Pinecone
curl -X POST http://localhost:8000/api/incidents/seed
```

### Frontend (Terminal 2)

```bash
npm install
npm run dev
# → http://localhost:5173 (auto-proxies /api → backend)
```

## API Endpoints

| Method | Endpoint | Description | Tech |
|--------|----------|-------------|------|
| POST | `/api/triage` | Triage incident | RAG + Pinecone + HuggingFace + LangChain |
| POST | `/api/rca` | Root cause analysis | LangChain |
| POST | `/api/resolution` | Resolution summary | LangChain |
| POST | `/api/escalation` | Escalation email | LangChain |
| POST | `/api/workflow` | Full pipeline | LangGraph |
| GET | `/api/incidents/similar?q=` | Find similar incidents | Pinecone + HuggingFace |
| GET | `/api/health` | Health check | All providers |

## Project Structure

```
it-incident-assistant/
├── src/                          # React Frontend
│   ├── App.jsx                   # UI (5 tabs, dark mode, PDF export)
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Styles + dark mode
│
├── backend/                      # Python Backend
│   ├── main.py                   # FastAPI app
│   ├── config.py                 # Settings (pydantic-settings)
│   ├── llm/
│   │   ├── providers.py          # OpenAI + Ollama + Azure
│   │   └── chains.py             # 4 LangChain LCEL chains
│   ├── embeddings/
│   │   └── service.py            # HuggingFace + Pinecone
│   ├── rag/
│   │   └── retriever.py          # RAG pipeline
│   ├── graph/
│   │   └── workflow.py           # LangGraph StateGraph
│   ├── routers/                  # API endpoints
│   └── models/
│       └── schemas.py            # Pydantic models
│
├── ARCHITECTURE.md               # Detailed architecture & knowledge map
└── vite.config.js                # Vite + dev proxy to backend
```

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Python 3.12 + FastAPI
- **LLM**: LangChain + OpenAI / Ollama (Llama3) / Azure AI
- **Orchestration**: LangGraph StateGraph
- **Embeddings**: HuggingFace sentence-transformers
- **Vector DB**: Pinecone (384 dims, cosine)
- **RAG**: Custom pipeline (embed → search → augment)
- **Deploy**: Frontend on Vercel, Backend on Railway

## Deploy

### Frontend (Vercel)
```bash
vercel
# Set env: VITE_API_URL=https://your-backend.railway.app
```

### Backend (Railway)
```bash
# Set env vars: OPENAI_API_KEY, OPENAI_BASE_URL, PINECONE_API_KEY, FRONTEND_URL
# Procfile: web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

## For FSoft Academy

- `.env` files are NOT committed (in .gitignore)
- See `ARCHITECTURE.md` for detailed knowledge mapping
