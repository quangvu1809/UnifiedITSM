import uuid
from datetime import datetime
from typing import Dict, Any, Optional

# Global in-memory store for demo
MOCK_TICKETS: Dict[str, Dict[str, Any]] = {
    "TKT-001": {
        "id": "TKT-001",
        "title": "VPN not connecting from home",
        "status": "Open",
        "priority": "High",
        "assignee": "Network Team",
        "created": "2026-04-01",
        "description": "User cannot connect to VPN from home network.",
    },
    "TKT-002": {
        "id": "TKT-002",
        "title": "Outlook keeps crashing",
        "status": "In Progress",
        "priority": "Medium",
        "assignee": "Desktop Support",
        "created": "2026-04-02",
        "description": "Outlook crashes when opening attachments.",
    },
    "TKT-003": {
        "id": "TKT-003",
        "title": "Need Adobe Acrobat license",
        "status": "Pending Approval",
        "priority": "Low",
        "assignee": "Software Team",
        "created": "2026-04-02",
        "description": "User needs Adobe Acrobat Pro for PDF editing.",
    },
    "TKT-004": {
        "id": "TKT-004",
        "title": "Printer on 3rd floor not working",
        "status": "Resolved",
        "priority": "Medium",
        "assignee": "Hardware Team",
        "created": "2026-03-28",
        "description": "Printer HP-3F-01 is offline and not responding.",
    },
    "TKT-005": {
        "id": "TKT-005",
        "title": "Cannot access shared drive \\\\fileserver\\marketing",
        "status": "Open",
        "priority": "High",
        "assignee": "Network Team",
        "created": "2026-04-03",
        "description": "Marketing team cannot access shared drive after server migration.",
    },
}

def get_ticket(ticket_id: str) -> Optional[Dict[str, Any]]:
    return MOCK_TICKETS.get(ticket_id.upper())

def list_tickets() -> Dict[str, Dict[str, Any]]:
    return MOCK_TICKETS

def create_new_ticket(title: str, description: str, priority: str = "Medium") -> str:
    ticket_id = f"TKT-{uuid.uuid4().hex[:6].upper()}"
    new_ticket = {
        "id": ticket_id,
        "title": title,
        "status": "Open",
        "priority": priority,
        "assignee": "Unassigned",
        "created": datetime.now().strftime("%Y-%m-%d"),
        "description": description,
    }
    MOCK_TICKETS[ticket_id] = new_ticket
    return ticket_id
