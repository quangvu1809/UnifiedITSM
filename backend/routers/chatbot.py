import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain.tools import tool
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.prebuilt import create_react_agent

from config import get_settings
from services.tts import generate_speech
from services.ticket_store import get_ticket, create_new_ticket, list_tickets
from embeddings.service import query_similar, get_by_id
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

# ---------------------------------------------------------------------------
# Setup LLM & Agent
# ---------------------------------------------------------------------------
settings = get_settings()

llm = ChatOpenAI(
    base_url=settings.OPENAI_BASE_URL,
    api_key=settings.OPENAI_API_KEY,
    model=settings.OPENAI_MODEL,
    temperature=0.3,
)

# ---------------------------------------------------------------------------
# LangChain Tools
# ---------------------------------------------------------------------------

@tool
def search_knowledge_base(query: str) -> str:
    """Search the IT helpdesk knowledge base for solutions to technical issues.
    Use this when the user describes a technical problem or asks for help with IT issues.
    """
    settings = get_settings()
    results = query_similar(query, top_k=3, namespace=settings.KB_NAMESPACE)

    if not results:
        return "No relevant articles found in the knowledge base."

    articles = []
    for res in results:
        meta = res["metadata"]
        art = [
            f"ID: {meta.get('number', res['id'])}",
            f"Title: {meta.get('title', 'N/A')}",
            f"Description: {meta.get('description', 'N/A')}",
            f"Resolution: {meta.get('resolution', 'N/A')}",
            f"Category: {meta.get('category', 'N/A')}",
            f"Priority: {meta.get('priority', 'N/A')}",
            f"State: {meta.get('state', 'Resolved')}",
        ]
        if "history" in meta:
            art.append(f"Updates: {meta['history']}")
            
        articles.append("\n".join(art))
    return "\n\n---\n\n".join(articles)


@tool
def get_ticket_status(ticket_id: str) -> str:
    """Look up the status of an IT support ticket by its ID (e.g., TKT-123 or INC1234567)."""
    # 1. Try Mock Store first
    ticket = get_ticket(ticket_id)
    if ticket:
        return (
            f"Ticket: {ticket['id']}\n"
            f"Title: {ticket['title']}\n"
            f"Status: {ticket['status']}\n"
            f"Priority: {ticket['priority']}\n"
            f"Assignee: {ticket['assignee']}\n"
            f"Created: {ticket['created']}\n"
            f"Description: {ticket['description']}"
        )
    
    # 2. Try Pinecone KB
    settings = get_settings()
    kb_results = get_by_id(ticket_id, namespace=settings.KB_NAMESPACE)
    if not kb_results:
        # Also try INC namespace
        kb_results = get_by_id(ticket_id, namespace=settings.INC_NAMESPACE)

    if kb_results:
        inc = kb_results[0]["metadata"]
        res = [
            f"Incident: {inc.get('number', ticket_id)}",
            f"State: {inc.get('state', 'Unknown')}",
            f"Priority: {inc.get('priority', 'N/A')}",
            f"Category: {inc.get('category', 'N/A')}",
            f"Caller: {inc.get('caller', 'N/A')}",
            f"Description: {inc.get('description', 'N/A')}",
            f"Resolution: {inc.get('resolution', 'No resolution notes yet.')}"
        ]
        if inc.get("history"):
            try:
                hist = json.loads(inc["history"])
                res.append("\nUpdate History:")
                for entry in hist:
                    res.append(f"- {entry['timestamp']}: {entry['action']} - {entry['notes']}")
            except: pass
        return "\n".join(res)

    return f"Ticket or Incident {ticket_id} not found in our records."


@tool
def create_ticket(title: str, description: str, priority: str = "Medium") -> str:
    """Create a new IT support ticket."""
    ticket_id = create_new_ticket(title, description, priority)
    return (
        f"Ticket created successfully!\n"
        f"Ticket ID: {ticket_id}\n"
        f"Title: {title}\n"
        f"Priority: {priority}\n"
        f"Status: Open"
    )

SYSTEM_PROMPT = """You are an IT Helpdesk Assistant for a company. Your role is to help employees with technical issues, search the knowledge base for solutions, check ticket statuses, and create new support tickets.

Guidelines:
- Be professional, friendly, and concise.
- When a user describes a technical problem, search the knowledge base first.
- Provide step-by-step troubleshooting instructions from KB articles.
- If the issue cannot be resolved, offer to create a support ticket.
- Always confirm before creating a new ticket.
"""

chatbot_tools = [search_knowledge_base, get_ticket_status, create_ticket]
agent = create_react_agent(llm, chatbot_tools, prompt=SYSTEM_PROMPT)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]
    tts: Optional[bool] = False
    ttsLang: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    toolLog: list
    ticketData: Optional[dict] = None
    audio: Optional[str] = None
    ttsLang: Optional[str] = None

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Build messages for the agent
    messages = []
    for msg in req.history:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))

    try:
        # Invoke agent
        result = agent.invoke({"messages": messages})

        # Extract reply (last AI message)
        reply = ""
        tool_log = []
        ticket_data = None

        for msg in result["messages"]:
            if hasattr(msg, "type"):
                if msg.type == "ai" and msg.content:
                    reply = msg.content
                elif msg.type == "tool":
                    tool_log.append({
                        "name": msg.name,
                        "args": {},
                        "result": msg.content,
                    })

        # Extract tool call args from AI messages
        tool_call_idx = 0
        for msg in result["messages"]:
            if hasattr(msg, "type") and msg.type == "ai" and hasattr(msg, "tool_calls"):
                for tc in msg.tool_calls:
                    if tool_call_idx < len(tool_log):
                        tool_log[tool_call_idx]["args"] = tc.get("args", {})
                        tool_log[tool_call_idx]["name"] = tc.get("name", tool_log[tool_call_idx]["name"])
                    tool_call_idx += 1

        # Check if a ticket was created
        for entry in tool_log:
            if entry["name"] == "create_ticket" and "Ticket ID:" in entry.get("result", ""):
                tid = entry["result"].split("Ticket ID:")[1].split("\n")[0].strip()
                ticket_data = get_ticket(tid)

        # TTS
        audio_b64 = None
        tts_lang = None
        if req.tts and reply:
            audio_b64, tts_lang = generate_speech(reply, req.ttsLang)

        return ChatResponse(
            reply=reply,
            toolLog=tool_log,
            ticketData=ticket_data,
            audio=audio_b64 if audio_b64 else None,
            ttsLang=tts_lang if tts_lang else None,
        )
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        raise HTTPException(500, str(e))
