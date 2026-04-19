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


def upsert_incident(text: str, metadata: dict, namespace: str = None, vector_id: str = None) -> str:
    """Store incident embedding in Pinecone. If vector_id is provided, it replaces/updates existing."""
    settings = get_settings()
    index = get_pinecone_index()
    if index is None:
        return ""

    incident_id = vector_id or f"inc-{uuid4().hex[:12]}"
    vector = embed_text(text)
    metadata["timestamp"] = datetime.utcnow().isoformat()

    target_namespace = namespace or settings.INC_NAMESPACE
    index.upsert(
        vectors=[{"id": incident_id, "values": vector, "metadata": metadata}],
        namespace=target_namespace,
    )
    return incident_id


def query_similar(text: str, top_k: int = 5, namespace: str = None) -> list[dict]:
    """Search Pinecone for similar items in a specific namespace."""
    settings = get_settings()
    index = get_pinecone_index()
    if index is None:
        return []

    target_namespace = namespace or settings.INC_NAMESPACE
    vector = embed_text(text)
    results = index.query(
        vector=vector,
        top_k=top_k,
        namespace=target_namespace,
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


def get_by_id(item_id: str, namespace: str = None) -> list[dict]:
    """Fetch a specific record from Pinecone by ID or Number metadata."""
    settings = get_settings()
    index = get_pinecone_index()
    if index is None:
        return []

    target_namespace = namespace or settings.INC_NAMESPACE
    try:
        # 1. Try exact ID fetch (if the input is the actual vector ID)
        results = index.fetch(ids=[item_id], namespace=target_namespace)
        if results and results.vectors and item_id in results.vectors:
            vec = results.vectors[item_id]
            return [{"id": vec.id, "metadata": vec.metadata}]

        # 2. Try searching by 'number' metadata field (for INC numbers)
        # We query with a zero vector and a filter
        # The dimension is 384 (all-MiniLM-L6-v2)
        dummy_vector = [0.0] * 384
        query_resp = index.query(
            vector=dummy_vector,
            filter={"number": {"$eq": item_id}},
            top_k=1,
            namespace=target_namespace,
            include_metadata=True
        )
        
        if query_resp and query_resp.matches:
            match = query_resp.matches[0]
            # Since it's an exact search by number, we check if the score is relevant 
            # (though with a zero vector, similarity score is meaningless, but metadata filter is definitive)
            return [{
                "id": match.id,
                "metadata": match.metadata
            }]
            
        return []
    except Exception as e:
        print(f"Error in get_by_id: {e}")
        return []
def delete_incident_by_id(item_id: str, namespace: Optional[str] = None):
    """Delete an incident from Pinecone by its manual ID (e.g. INCXXXXX)."""
    settings = get_settings()
    target_namespace = namespace or settings.KB_NAMESPACE
    try:
        index = pc.Index(settings.PINECONE_INDEX)
        # We need to find the internal Pinecone ID first if manually provided number differs,
        # but in our current setup, we use the INC number as the vector ID.
        index.delete(ids=[item_id], namespace=target_namespace)
        return True
    except Exception as e:
        print(f"Error in delete_incident_by_id: {e}")
        return False


def seed_sample_incidents():
    """Seed Pinecone with sample incidents for demo."""
    settings = get_settings()
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
        vector = embed_text(sample["text"])
        meta = sample["metadata"]
        meta["timestamp"] = datetime.utcnow().isoformat()
        index.upsert(
            vectors=[{"id": f"seed-{uuid4().hex[:8]}", "values": vector, "metadata": meta}],
            namespace=settings.INC_NAMESPACE,
        )

    return len(samples)


def seed_kb_articles():
    """Seed Pinecone with knowledge base articles from ChatBot project."""
    settings = get_settings()
    KB_ARTICLES = [
        {"id": "KB001", "title": "VPN Connection Troubleshooting", "content": "If VPN fails to connect: 1) Restart the VPN client. 2) Check internet connectivity. 3) Verify VPN credentials are correct. 4) Try connecting to a different VPN server. 5) Disable firewall temporarily to test. 6) Reinstall the VPN client if issues persist. Contact IT if none of these steps work."},
        {"id": "KB002", "title": "Outlook Email Not Syncing", "content": "If Outlook is not syncing emails: 1) Check internet connection. 2) Restart Outlook. 3) Clear Outlook cache (File > Account Settings > Data Files). 4) Remove and re-add the email account. 5) Check if Outlook is in offline mode (Send/Receive tab). 6) Run the Microsoft Support and Recovery Assistant tool."},
        {"id": "KB003", "title": "Printer Not Working", "content": "If the printer is not working: 1) Check if the printer is powered on and connected. 2) Restart the print spooler service (services.msc). 3) Remove and re-add the printer. 4) Update or reinstall printer drivers. 5) Check for paper jams or low ink/toner. 6) Try printing a test page from printer properties."},
        {"id": "KB004", "title": "Shared Drive Access Issues", "content": "If you cannot access a shared drive: 1) Verify you have the correct permissions. 2) Check network connectivity. 3) Try accessing via IP address instead of hostname. 4) Clear cached credentials (Control Panel > Credential Manager). 5) Disconnect and remap the network drive. 6) Contact IT to verify your AD group membership."},
        {"id": "KB005", "title": "WiFi Connectivity Problems", "content": "If WiFi is not connecting: 1) Toggle WiFi off and on. 2) Forget the network and reconnect. 3) Restart your device. 4) Run the network troubleshooter (Settings > Network > Troubleshoot). 5) Update WiFi drivers. 6) Check if other devices can connect to the same network. 7) Reset network settings if needed."},
        {"id": "KB006", "title": "Password Reset Procedure", "content": "To reset your password: 1) Go to the self-service password reset portal at https://passwordreset.company.com. 2) Verify your identity with security questions or MFA. 3) Create a new password following policy (min 12 chars, uppercase, lowercase, number, special char). 4) Update saved passwords on all devices. 5) If locked out, contact IT helpdesk for manual reset."},
        {"id": "KB007", "title": "Software Installation Request", "content": "To request new software: 1) Submit a request through the IT Service Portal. 2) Provide business justification. 3) IT will verify licensing compliance. 4) Approved software will be deployed via SCCM within 24-48 hours. 5) For urgent requests, contact IT helpdesk directly. Note: Only approved software from the company catalog can be installed."},
        {"id": "KB008", "title": "Email Account Setup on Mobile", "content": "To set up your company email on mobile: 1) Open Settings > Accounts > Add Account. 2) Select Exchange or Microsoft 365. 3) Enter your company email and password. 4) Accept any security policies. 5) Configure sync settings (email, calendar, contacts). For iPhone: use the built-in Mail app. For Android: use Outlook app for best compatibility."},
        {"id": "KB009", "title": "Monitor Display Issues", "content": "If your monitor has display issues: 1) Check cable connections (HDMI, DisplayPort, VGA). 2) Try a different cable. 3) Update graphics drivers. 4) Adjust display resolution (right-click desktop > Display Settings). 5) Test with another monitor to isolate the issue. 6) For dual monitor setup: ensure correct display mode (extend/duplicate) in Display Settings."},
        {"id": "KB010", "title": "Keyboard and Mouse Not Responding", "content": "If keyboard or mouse is not responding: 1) Check USB connections or replace batteries for wireless devices. 2) Try a different USB port. 3) Restart the computer. 4) Update HID drivers in Device Manager. 5) Test with another keyboard/mouse. 6) For Bluetooth devices: remove pairing and re-pair. 7) Check if the USB ports are enabled in BIOS."},
        {"id": "KB011", "title": "Software License Activation", "content": "For software license issues: 1) Verify your license key is entered correctly. 2) Check if the license has expired. 3) Ensure the software version matches the license type. 4) Deactivate license on old device before activating on new one. 5) Contact IT for volume license keys. 6) For Microsoft Office: sign in with your company Microsoft 365 account."},
        {"id": "KB012", "title": "Data Backup and Recovery", "content": "For data backup and recovery: 1) Company data is automatically backed up to OneDrive. 2) Check OneDrive sync status in the system tray. 3) To recover deleted files: check OneDrive recycle bin (retained 93 days). 4) For local backup: use Windows File History. 5) For critical data loss: contact IT immediately - server backups are retained for 30 days. 6) Never store important files only on local C: drive."},
        {"id": "KB013", "title": "Network Drive Mapping", "content": "To map a network drive: 1) Open File Explorer > This PC > Map Network Drive. 2) Choose a drive letter. 3) Enter the path (e.g., \\\\server\\share). 4) Check 'Reconnect at sign-in'. 5) Enter credentials if prompted. 6) Common paths: \\\\fileserver\\departments for department shares, \\\\fileserver\\users\\username for personal drives. Contact IT if you don't know your share path."},
        {"id": "KB014", "title": "Two-Factor Authentication Setup", "content": "To set up 2FA: 1) Install Microsoft Authenticator app on your phone. 2) Go to https://mysignins.microsoft.com/security-info. 3) Click 'Add sign-in method' > 'Authenticator app'. 4) Scan the QR code with the app. 5) Enter the verification code to confirm. 6) Save backup codes in a secure location. 7) Contact IT if you lose access to your authenticator device."},
        {"id": "KB015", "title": "Remote Desktop Connection", "content": "To use Remote Desktop: 1) Ensure Remote Desktop is enabled on the target PC (System > Remote Desktop). 2) Note the PC name or IP address. 3) Open Remote Desktop Connection (mstsc). 4) Enter the PC name/IP and click Connect. 5) Use your company credentials to log in. 6) For remote access from outside: connect to VPN first. 7) Performance tips: reduce display quality for slow connections."},
    ]

    index = get_pinecone_index()
    if index is None:
        return 0

    for article in KB_ARTICLES:
        text = f"{article['title']}: {article['content']}"
        vector = embed_text(text)
        index.upsert(
            vectors=[{"id": article["id"], "values": vector, "metadata": {"title": article["title"], "content": article["content"]}}],
            namespace=settings.KB_NAMESPACE,
        )

    return len(KB_ARTICLES)
