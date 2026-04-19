import { useState, useCallback, useEffect, useRef } from "react";
import ChatAssistant from "./components/Chat/ChatAssistant";

// ============================================
// CONSTANTS
// ============================================
const MODULES = [
  { id: "chatbot", icon: "🧤", label: "AI Assistant", desc: "Troubleshooting & Support" },
  { id: "triage", icon: "🎫", label: "Incident Form", desc: "Standard IT Form" },
  { id: "rca", icon: "🔍", label: "Analysis", desc: "Root Cause Investigation" },
  { id: "resolution", icon: "✅", label: "Resolution", desc: "Finalize & Learn" },
  { id: "escalation", icon: "📧", label: "Escalation", desc: "Soạn email" },
  { id: "sla", icon: "⏱️", label: "SLA Timer", desc: "Tính thời gian SLA" },
  { id: "dashboard", icon: "📊", label: "Dashboard", desc: "Incident history" },
];

const SAMPLES = {
  triage: [
    { label: "Production Down", icon: "🔴", severity: "P1", tag: "Critical", description: "Production server không response từ 14:30. Users không thể login vào CRM. Error: Connection timeout to database.", impact: "500+ users, business critical", color: "#dc2626" },
    { label: "Performance", icon: "🟠", severity: "P2", tag: "High", description: "Website load chậm >10s. CPU 95%, memory leak suspected.", impact: "200 users, degraded", color: "#ea580c" },
    { label: "Integration", icon: "🟡", severity: "P3", tag: "Medium", description: "API sync SAP-Salesforce fail. Error 401 Unauthorized.", impact: "Order processing delay", color: "#ca8a04" },
  ],
  rca: [
    { label: "🗄️ DB Connection", symptoms: "App không connect được database", logs: "ERROR: Connection pool exhausted\nMax connections: 100\nActive: 100\nWaiting: 47", timeline: "14:30 - Alert triggered\n14:35 - Team notified\n14:40 - Investigation started" },
  ],
};

const AFFECTED_SYSTEMS = ["CRM", "Database", "API Gateway", "Email Server", "VPN", "Load Balancer", "Kubernetes", "Active Directory", "SAP", "Salesforce"];

const ESCALATE_TO = ["L2 Support", "L3 Support", "Dev Team", "DBA Team", "Network Team", "Security Team", "Vendor"];

const SLA_TARGETS = {
  P1: { hours: 1, label: "Critical - 1 giờ" },
  P2: { hours: 4, label: "High - 4 giờ" },
  P3: { hours: 8, label: "Medium - 8 giờ" },
  P4: { hours: 24, label: "Low - 24 giờ" },
};

// ============================================
// UTILITIES
// ============================================
const estimateTokens = (text) => text ? Math.ceil(text.length / 3.5) : 0;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const moderateInput = (text) => {
  const issues = [];
  const patterns = [
    { regex: /\b\d{3}-\d{2}-\d{4}\b/, type: "SSN detected" },
    { regex: /\b\d{16}\b/, type: "Card number detected" },
    { regex: /password\s*[:=]\s*\S+/i, type: "Password exposed" },
    { regex: /api[_-]?key\s*[:=]\s*\S+/i, type: "API key exposed" },
  ];
  patterns.forEach(({ regex, type }) => { if (regex.test(text)) issues.push(type); });
  if (text.trim().length < 10) issues.push("Too short");
  return { passed: issues.length === 0, issues, hasSensitive: issues.some(i => !i.includes("short")) };
};

const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      return res;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
  throw new Error("Max retries");
};

const API_BASE = import.meta.env.VITE_API_URL || "";

// ============================================
// STYLES
// ============================================
const getStyles = (dark) => ({
  // Layout
  wrapper: { minHeight: "100vh", paddingTop: 72 },
  container: { maxWidth: 960, margin: "0 auto", padding: "16px 20px" },

  // Navbar
  navbar: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: dark ? "#0f2920" : "#fff", borderBottom: `1px solid ${dark ? "#065f46" : "#d1fae5"}`, padding: "0 20px", height: 56, display: "flex", alignItems: "center" },
  navInner: { maxWidth: 960, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 12 },
  navBrand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 },
  navTitle: { fontSize: 16, fontWeight: 700, color: dark ? "#34d399" : "#059669" },
  navRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 },

  // Tabs
  tabs: { display: "flex", gap: 4, marginBottom: 20, justifyContent: "center", background: dark ? "#0f2920" : "#f0fdf4", borderRadius: 12, padding: 4, flexWrap: "wrap" },
  tab: (active) => ({ padding: "10px 18px", borderRadius: 8, border: "none", background: active ? (dark ? "#059669" : "#fff") : "transparent", color: active ? (dark ? "#fff" : "#059669") : dark ? "#6ee7b7" : "#065f46", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", boxShadow: active ? (dark ? "0 2px 8px rgba(5,150,105,0.3)" : "0 2px 8px rgba(5,150,105,0.12)") : "none" }),

  // Cards
  card: { background: dark ? "#0f2920" : "#fff", borderRadius: 16, boxShadow: dark ? "0 2px 16px rgba(0,0,0,0.3)" : "0 2px 16px rgba(5,150,105,0.06)", padding: 24, marginBottom: 20, border: `1px solid ${dark ? "#065f46" : "#d1fae5"}` },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: dark ? "#a7f3d0" : "#065f46", marginBottom: 6 },
  input: { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${dark ? "#065f46" : "#a7f3d0"}`, fontSize: 14, outline: "none", transition: "border 0.2s, box-shadow 0.2s", background: dark ? "#022c22" : "#fff", color: dark ? "#e5e7eb" : "#1f2937" },
  textarea: { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${dark ? "#065f46" : "#a7f3d0"}`, fontSize: 14, outline: "none", resize: "vertical", minHeight: 80, lineHeight: 1.6, background: dark ? "#022c22" : "#fff", color: dark ? "#e5e7eb" : "#1f2937", transition: "border 0.2s" },

  // Buttons
  btn: (primary, disabled) => ({ padding: "12px 22px", borderRadius: 10, border: "none", background: disabled ? (dark ? "#065f46" : "#bbf7d0") : primary ? "linear-gradient(135deg, #059669, #10b981)" : dark ? "#065f46" : "#ecfdf5", color: primary ? "#fff" : dark ? "#a7f3d0" : "#065f46", fontWeight: 600, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", boxShadow: primary && !disabled ? "0 4px 14px rgba(5,150,105,0.35)" : "none", transition: "transform 0.1s" }),
  chip: (active) => ({ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${active ? "#059669" : dark ? "#065f46" : "#a7f3d0"}`, background: active ? (dark ? "#064e3b" : "#ecfdf5") : dark ? "#0f2920" : "#fff", color: active ? (dark ? "#34d399" : "#059669") : dark ? "#6ee7b7" : "#065f46", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }),

  // Result
  result: { background: dark ? "#0f2920" : "#fff", borderRadius: 16, overflow: "hidden", boxShadow: dark ? "0 4px 24px rgba(0,0,0,0.3)" : "0 2px 16px rgba(5,150,105,0.08)", border: `1px solid ${dark ? "#065f46" : "#d1fae5"}` },
  resultHeader: { background: "linear-gradient(135deg, #059669, #10b981)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  resultBody: { padding: 20, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8, color: dark ? "#e5e7eb" : "#1f2937" },

  // Badges
  badge: (color) => ({ display: "inline-block", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: color === "red" ? (dark ? "#451a1a" : "#fef2f2") : color === "orange" ? (dark ? "#451a00" : "#fff7ed") : color === "yellow" ? (dark ? "#453a00" : "#fefce8") : (dark ? "#052e16" : "#f0fdf4"), color: color === "red" ? "#dc2626" : color === "orange" ? "#ea580c" : color === "yellow" ? "#ca8a04" : "#16a34a" }),

  // Misc
  error: { background: dark ? "#451a1a" : "#fef2f2", border: `1px solid ${dark ? "#dc2626" : "#fca5a5"}`, borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 12 },
  disclaimer: { background: dark ? "#064e3b" : "#ecfdf5", border: `1px solid ${dark ? "#059669" : "#a7f3d0"}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: dark ? "#6ee7b7" : "#065f46", marginTop: 12, display: "flex", alignItems: "center", gap: 6 },
  
  // ServiceNow Form Styles
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px", marginBottom: 24 },
  formGroup: { display: "flex", flexDirection: "column" },
  formRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  fieldLabel: { width: 120, fontSize: 13, fontWeight: 600, color: dark ? "#9ca3af" : "#64748b", flexShrink: 0 },
});

// ============================================
// MAIN APP
// ============================================
export default function App() {
  // Auth
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("auth");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authForm, setAuthForm] = useState({ username: "", password: "", name: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = authMode === "login"
        ? { username: authForm.username, password: authForm.password }
        : { username: authForm.username, password: authForm.password, name: authForm.name };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.detail || "Lỗi đăng nhập"); setAuthLoading(false); return; }
      localStorage.setItem("auth", JSON.stringify(data));
      setUser(data);
      setAuthForm({ username: "", password: "", name: "" });
    } catch {
      setAuthError("Không thể kết nối server");
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("auth");
    setUser(null);
    setAuthForm({ username: "", password: "", name: "" });
    setActiveModule("triage");
    setResult(null);
    setError("");
    setSimilarIncidents([]);
    setDashboardData([]);
  };

  const [activeModule, setActiveModule] = useState("chatbot");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState({ provider: "openai", showStats: true, moderation: true });
  
  // Stats
  const [stats, setStats] = useState({ inTokens: 0, outTokens: 0, latency: 0, retries: 0 });
  
  // Forms
  const [triageForm, setTriageForm] = useState({ 
    number: `INC${Math.floor(Math.random() * 9000000 + 1000000)}`,
    caller: user?.user?.name || "System",
    state: "New",
    category: "Software",
    subcategory: "",
    assignmentGroup: "Service Desk",
    description: "", 
    impact: "", 
    severity: "", 
    systems: [],
    resolution: ""
  });
  const [rcaForm, setRcaForm] = useState({ symptoms: "", logs: "", timeline: "" });
  const [resForm, setResForm] = useState({ summary: "", actions: "", outcome: "Resolved", saveToKB: true });
  const [escForm, setEscForm] = useState({ id: "", summary: "", to: "L2 Support", urgency: "High", done: "", ask: "" });
  const [suggestedResolution, setSuggestedResolution] = useState(null);

  // SLA Timer
  const [slaForm, setSlaForm] = useState({ priority: "P1", startTime: "" });
  const [slaRemaining, setSlaRemaining] = useState(null);
  const [slaTotalMs, setSlaTotalMs] = useState(null);
  const slaIntervalRef = useRef(null);

  // Similar incidents
  const [similarIncidents, setSimilarIncidents] = useState([]);

  // Analysis Search
  const [analysisSearchQuery, setAnalysisSearchQuery] = useState("");
  const [analysisSearchResults, setAnalysisSearchResults] = useState(null);
  const [selectedAnalysisItem, setSelectedAnalysisItem] = useState(null);

  // History state
  const [incidentHistory, setIncidentHistory] = useState([]);

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("darkMode") === "true"; } catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const styles = getStyles(darkMode);

  // Generic API call to Python backend
  const callEndpoint = useCallback(async (endpoint, body) => {
    setLoading(true);
    setError("");
    setResult(null);
    const start = Date.now();

    try {
      const provider = settings.provider === "openai" ? "openai" : settings.provider === "ollama" ? "ollama" : "azure";
      if (settings.moderation) {
        const mod = moderateInput(JSON.stringify(body));
        if (mod.hasSensitive && provider === "openai") {
          setError("⚠️ Phát hiện dữ liệu nhạy cảm. Chuyển sang Ollama Local hoặc xóa dữ liệu nhạy cảm.");
          setLoading(false);
          return;
        }
      }

      const res = await fetchWithRetry(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, provider }),
      });

      const data = await res.json();
      if (data.detail) {
        setError(`Error: ${typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)}`);
        setLoading(false);
        return;
      }

      setStats(s => ({ ...s, latency: Date.now() - start }));
      return data;

    } catch (e) {
      setError("Lỗi kết nối backend. Kiểm tra Python server đang chạy.");
    }
    setLoading(false);
    return null;
  }, [settings.provider, settings.moderation]);

  // Module handlers - call Python backend endpoints
  const handleTriage = async () => {
    const res = await callEndpoint("/api/triage", { 
      description: triageForm.description, 
      impact: triageForm.impact 
    });
    if (res && res.triage) {
      setTriageForm(f => ({ 
        ...f, 
        severity: res.triage.priority, 
        category: res.triage.category || f.category,
        assignmentGroup: res.triage.suggested_team || f.assignmentGroup
      }));
      setSuggestedResolution(res.triage.suggested_resolution);
    }
  };

  const handleSaveKB = async () => {
    // Only require resolution notes if the state is Resolved or Closed
    const isFinalState = triageForm.state === "Resolved" || triageForm.state === "Closed";
    if (isFinalState && !triageForm.resolution.trim()) {
      setError("Please provide resolution notes before saving to Knowledge Base.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/incidents/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          number: triageForm.number,
          description: triageForm.description,
          resolution: triageForm.resolution,
          category: triageForm.category,
          subcategory: triageForm.subcategory,
          priority: triageForm.severity,
          state: triageForm.state,
          caller: triageForm.caller,
          assignmentGroup: triageForm.assignmentGroup,
          save_to_kb: true
        }),
      });
      if (res.ok) {
        setResult({ type: "text", data: "Incident successfully saved to Knowledge Base! The chatbot can now search and suggest this resolution for future cases." });
        setTriageForm(f => ({ ...f, state: "Resolved" }));
        loadDashboard("incident"); // Auto-refresh dashboard
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to save to knowledge base.");
      }
    } catch {
      setError("Network error. Please check backend connection.");
    }
    setLoading(false);
  };

  const handleRCA = async () => {
    if (!rcaForm.symptoms.trim()) { setError("Vui lòng nhập triệu chứng"); return; }
    const res = await callEndpoint("/api/rca", rcaForm);
    if (res) {
      setResult({ type: "text", data: res.analysis });
    }
  };

  const handleAnalysisSearch = async () => {
    if (!analysisSearchQuery.trim()) return;
    setLoading(true);
    setAnalysisSearchResults(null);
    setSelectedAnalysisItem(null);
    try {
      const resp = await fetch(`${API_BASE}/api/incidents/search?q=${encodeURIComponent(analysisSearchQuery)}`);
      const data = await resp.json();
      setAnalysisSearchResults(data);
    } catch {
      setError("Search failed.");
    }
    setLoading(false);
  };

  const handleSelectIncident = async (number) => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/incidents/search?q=${encodeURIComponent(number)}`);
      const data = await resp.json();
      if (data.status === "success" && data.results.length > 0) {
        const inc = data.results[0].metadata;
        setTriageForm({
          number: inc.number,
          caller: inc.caller || "System",
          severity: inc.priority,
          category: inc.category,
          subcategory: inc.subcategory || "",
          state: inc.state || "In Progress",
          description: inc.description || inc.content,
          assignmentGroup: inc.assignmentGroup || "L1 Support",
          resolution: inc.resolution || ""
        });
        setResForm({
          summary: inc.title || "",
          actions: inc.resolution || "",
          outcome: inc.state || "Resolved",
          saveToKB: true
        });
        if (inc.history) {
          try { setIncidentHistory(JSON.parse(inc.history)); } catch { setIncidentHistory([]); }
        } else {
          setIncidentHistory([]);
        }
        setActiveModule("triage");
      }
    } catch (e) {
      setError("Failed to load incident details.");
    }
    setLoading(false);
  };

  const handleResolution = async () => {
    if (!resForm.actions.trim()) { setError("Vui lòng nhập các actions đã thực hiện"); return; }
    const data = await callEndpoint("/api/resolution", { summary: resForm.summary, actions: resForm.actions, outcome: resForm.outcome });
    if (data) { 
      setResult({ type: "text", data: data.resolution }); 
      setLoading(false); 
      
      // Learn from resolution if it's a final resolution
      if (resForm.outcome === "Resolved") {
        await fetch(`${API_BASE}/api/incidents/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: triageForm.number,
            description: triageForm.description,
            resolution: data.resolution,
            category: triageForm.category,
            subcategory: triageForm.subcategory,
            priority: triageForm.priority,
            save_to_kb: resForm.saveToKB
          })
        });
      }
    }
  };

  const handleEscalation = async () => {
    if (!escForm.summary.trim()) { setError("Vui lòng nhập thông tin incident"); return; }
    const data = await callEndpoint("/api/escalation", { id: escForm.id, summary: escForm.summary, to: escForm.to, urgency: escForm.urgency, done: escForm.done, ask: escForm.ask });
    if (data) { setResult({ type: "text", data: data.email }); setLoading(false); }
  };

  // LangGraph full workflow
  const handleWorkflow = async () => {
    if (!triageForm.description.trim()) { setError("Vui lòng nhập mô tả incident"); return; }
    const data = await callEndpoint("/api/workflow", { description: triageForm.description, impact: triageForm.impact, mode: "full" });
    if (data) {
      setResult({ type: "workflow", data });
      setSimilarIncidents(data.similar_incidents || []);
      setLoading(false);
    }
  };

  // Dashboard
  const [dashboardData, setDashboardData] = useState([]);
  const [dashSearch, setDashSearch] = useState("");
  const [dashLoading, setDashLoading] = useState(false);
  const [dashFilter, setDashFilter] = useState("all");

  const loadDashboard = async (query) => {
    setDashLoading(true);
    try {
      const q = query || "incident";
      const res = await fetch(`${API_BASE}/api/incidents/similar?q=${encodeURIComponent(q)}&k=20`);
      const data = await res.json();
      setDashboardData(data.incidents || []);
    } catch {
      setError("Không thể tải dashboard data");
    }
    setDashLoading(false);
  };

  const handleDeleteIncident = async (number) => {
    if (!window.confirm(`Are you sure you want to delete incident ${number} from the Knowledge Base? This action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${number}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setResult({ type: "text", data: `Incident ${number} was successfully deleted.` });
        loadDashboard(dashSearch || "incident");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to delete incident.");
      }
    } catch {
      setError("Network error. Please check backend connection.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeModule === "dashboard" && dashboardData.length === 0) {
      loadDashboard("incident server error database");
    }
  }, [activeModule]);

  const filteredDashboard = dashFilter === "all"
    ? dashboardData
    : dashboardData.filter(inc => inc.metadata?.priority === dashFilter);

  const dashStats = {
    total: dashboardData.length,
    p1: dashboardData.filter(i => i.metadata?.priority === "P1").length,
    p2: dashboardData.filter(i => i.metadata?.priority === "P2").length,
    p3: dashboardData.filter(i => i.metadata?.priority === "P3").length,
    p4: dashboardData.filter(i => i.metadata?.priority === "P4").length,
  };

  const loadSample = (type, idx) => {
    const s = SAMPLES[type]?.[idx];
    if (!s) return;
    if (type === "triage") setTriageForm({ description: s.description, impact: s.impact, severity: s.severity || "", systems: [] });
    if (type === "rca") setRcaForm({ symptoms: s.symptoms, logs: s.logs, timeline: s.timeline });
    setResult(null);
  };

  const copyResult = () => {
    const text = result?.type === "json" ? JSON.stringify(result.data, null, 2) : result?.data;
    navigator.clipboard.writeText(text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setTriageForm({ description: "", impact: "", severity: "", systems: [] });
    setRcaForm({ symptoms: "", logs: "", timeline: "" });
    setResForm({ summary: "", actions: "", outcome: "Resolved" });
    setEscForm({ id: "", summary: "", to: "L2 Support", urgency: "High", done: "", ask: "" });
    setResult(null);
    setError("");
  };

  // SLA Timer logic
  const startSlaTimer = () => {
    if (!slaForm.startTime) { setError("Vui lòng chọn thời gian bắt đầu incident"); return; }
    clearInterval(slaIntervalRef.current);
    const startMs = new Date(slaForm.startTime).getTime();
    const totalMs = SLA_TARGETS[slaForm.priority].hours * 3600000;
    const breachTime = startMs + totalMs;
    setSlaTotalMs(totalMs);
    const tick = () => setSlaRemaining(breachTime - Date.now());
    tick();
    slaIntervalRef.current = setInterval(tick, 1000);
  };

  const stopSlaTimer = () => {
    clearInterval(slaIntervalRef.current);
    setSlaRemaining(null);
    setSlaTotalMs(null);
  };

  useEffect(() => () => clearInterval(slaIntervalRef.current), []);

  const formatRemaining = (ms) => {
    if (ms <= 0) return "SLA BREACHED!";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const getSlaColor = (ms, totalMs) => {
    if (ms <= 0) return "#dc2626";
    const ratio = ms / totalMs;
    if (ratio < 0.25) return "#dc2626";
    if (ratio < 0.5) return "#f59e0b";
    return "#16a34a";
  };

  // Similar incidents now returned from Python backend (Pinecone + HuggingFace RAG)

  // PDF Export
  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const exportPDF = async () => {
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
      const element = document.getElementById("resolution-result");
      if (!element) return;
      window.html2pdf().set({
        margin: [10, 10],
        filename: `resolution-summary-${new Date().toISOString().slice(0, 10)}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(element).save();
    } catch {
      setError("Không thể export PDF. Vui lòng thử lại.");
    }
  };

  // Render JSON result
  const renderTriageResult = (data) => (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={styles.badge(data.priority === "P1" ? "red" : data.priority === "P2" ? "orange" : data.priority === "P3" ? "yellow" : "green")}>
          {data.priority}
        </span>
        <span style={{ ...styles.badge("green"), background: "#ede9fe", color: "#7c3aed" }}>{data.category}</span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>→ {data.suggested_team}</span>
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>Lý do:</strong>
        <p style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>{data.priority_reason}</p>
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>Impact:</strong>
        <p style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
          {data.impact_assessment?.users_affected} • Business: {data.impact_assessment?.business_impact}
        </p>
      </div>
      <div>
        <strong style={{ fontSize: 13 }}>Recommended Actions:</strong>
        <ul style={{ marginTop: 6, paddingLeft: 20 }}>
          {data.recommended_actions?.map((a, i) => <li key={i} style={{ fontSize: 14, color: "#4b5563", marginBottom: 4 }}>{a}</li>)}
        </ul>
      </div>
      {data.confidence && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Confidence:</span>
          <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, maxWidth: 200 }}>
            <div style={{ width: `${data.confidence * 100}%`, height: "100%", background: data.confidence > 0.8 ? "#10b981" : data.confidence > 0.5 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{Math.round(data.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );

  // Login screen
  if (!user) {
    return (
      <div key="login" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
        <div style={{ ...styles.card, maxWidth: 400, width: "100%", textAlign: "center" }} className="login-card">
          <img src="/logo-greenai.svg" alt="GreenAI" style={{ width: 64, height: 64, margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: darkMode ? "#34d399" : "#059669", marginBottom: 4 }}>IT Incident Assistant</h2>
          <p style={{ fontSize: 13, color: darkMode ? "#6ee7b7" : "#065f46", marginBottom: 24 }}>GreenAI Team • {authMode === "login" ? "Đăng nhập" : "Đăng ký"}</p>

          {authError && <div style={styles.error}>{authError}</div>}

          {authMode === "register" && (
            <div style={{ marginBottom: 12, textAlign: "left" }}>
              <label style={styles.label}>Họ tên</label>
              <input value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Nguyen Van A" style={styles.input} />
            </div>
          )}
          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <label style={styles.label}>Username</label>
            <input value={authForm.username} onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))} placeholder="Nhập username" style={styles.input} onKeyDown={e => e.key === "Enter" && handleAuth()} />
          </div>
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <label style={styles.label}>Password</label>
            <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} placeholder="Nhập password" style={styles.input} onKeyDown={e => e.key === "Enter" && handleAuth()} />
          </div>

          <button onClick={handleAuth} disabled={authLoading} style={{ ...styles.btn(true, authLoading), width: "100%", marginBottom: 12 }}>
            {authLoading ? <><span className="spinner" style={{ marginRight: 8 }} /> Đang xử lý...</> : authMode === "login" ? "🔐 Đăng nhập" : "✨ Đăng ký"}
          </button>

          <p style={{ fontSize: 12, color: darkMode ? "#6ee7b7" : "#065f46" }}>
            {authMode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
            <span onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }} style={{ fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              {authMode === "login" ? "Đăng ký" : "Đăng nhập"}
            </span>
          </p>

          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: darkMode ? "#064e3b" : "#ecfdf5", fontSize: 11, color: darkMode ? "#6ee7b7" : "#065f46", textAlign: "left" }}>
            <strong>Demo accounts:</strong><br />
            admin / admin123 (Admin)<br />
            analyst / analyst123 (Analyst)<br />
            demo / demo (Viewer)
          </div>

          <button onClick={() => setDarkMode(d => !d)} style={{ ...styles.chip(false), marginTop: 12, fontSize: 11 }}>
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div key="app" style={styles.wrapper}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navInner}>
          <div style={styles.navBrand}>
            <img src="/logo-greenai.svg" alt="GreenAI" style={{ width: 36, height: 36 }} />
            <div>
              <div style={styles.navTitle}>IT Incident Assistant</div>
              <div style={{ fontSize: 10, color: darkMode ? "#6ee7b7" : "#9ca3af", marginTop: -1 }}>GreenAI Team</div>
            </div>
          </div>
          <div style={styles.navRight}>
            <button onClick={() => setSettings(s => ({ ...s, provider: s.provider === "openai" ? "ollama" : s.provider === "ollama" ? "azure" : "openai" }))} style={{ ...styles.chip(false), fontSize: 11, padding: "5px 10px" }}>
              {settings.provider === "openai" ? "☁️ OpenAI" : settings.provider === "ollama" ? "🏠 Ollama" : "🔷 Azure"}
            </button>
            <button onClick={() => setDarkMode(d => !d)} style={{ ...styles.chip(false), fontSize: 11, padding: "5px 8px" }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <div style={{ width: 1, height: 24, background: darkMode ? "#065f46" : "#d1fae5" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 8, background: darkMode ? "#064e3b" : "#ecfdf5" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #059669, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>
                {(user?.user?.name || "U")[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: darkMode ? "#6ee7b7" : "#065f46", fontWeight: 600 }}>
                {user?.user?.name || user?.user?.username}
              </span>
              <button onClick={handleLogout} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: darkMode ? "#6ee7b7" : "#9ca3af", padding: 0 }} title="Logout">
                ⏻
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div style={styles.container} className="container">
      {/* Tabs */}
      <div style={styles.tabs} className="tabs-wrap">
        {MODULES.map(m => (
          <button key={m.id} onClick={() => { setActiveModule(m.id); setResult(null); setError(""); setSimilarIncidents([]); }} className="tab-item" style={styles.tab(activeModule === m.id)}>
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Loading Progress Bar */}
      {loading && <div className="progress-bar" style={{ marginBottom: 4 }} />}

      {/* Module Forms */}
      <div style={styles.card} className={`card ${loading ? "loading-overlay" : ""}`}>
        {/* CHATBOT */}
        {activeModule === "chatbot" && (
          <ChatAssistant dark={darkMode} apiBase={API_BASE} />
        )}

        {/* INCIDENT FORM (ServiceNow Style) */}
        {activeModule === "triage" && (
          <>
            <div style={styles.formGrid}>
              {/* Left Column */}
              <div style={styles.formGroup}>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Number</label>
                  <input value={triageForm.number} readOnly style={{ ...styles.input, background: darkMode ? "#1a1b2e" : "#f1f5f9", fontWeight: 700 }} />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Caller</label>
                  <input value={triageForm.caller} onChange={e => setTriageForm(f => ({...f, caller: e.target.value}))} style={styles.input} />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Category</label>
                  <select value={triageForm.category} onChange={e => setTriageForm(f => ({...f, category: e.target.value}))} style={styles.input}>
                    {["Software", "Hardware", "Network", "Database", "Access", "Inquiry"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Subcategory</label>
                  <input value={triageForm.subcategory} onChange={e => setTriageForm(f => ({...f, subcategory: e.target.value}))} placeholder="e.g. Email, VPN, Login..." style={styles.input} />
                </div>
              </div>

              {/* Right Column */}
              <div style={styles.formGroup}>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Priority</label>
                  <select 
                    value={triageForm.severity} 
                    onChange={e => setTriageForm(f => ({...f, severity: e.target.value}))} 
                    style={{ 
                      ...styles.input, 
                      color: triageForm.severity === "P1" ? "#dc2626" : triageForm.severity === "P2" ? "#ea580c" : triageForm.severity === "P3" ? "#ca8a04" : "#16a34a",
                      fontWeight: 700 
                    }}
                  >
                    <option value="">-- Select --</option>
                    <option value="P1">P1 - Critical</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>
                </div>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>State</label>
                  <select value={triageForm.state} onChange={e => setTriageForm(f => ({...f, state: e.target.value}))} style={styles.input}>
                    {["New", "In Progress", "On Hold", "Resolved", "Closed"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Assignment Group</label>
                  <select value={triageForm.assignmentGroup} onChange={e => setTriageForm(f => ({...f, assignmentGroup: e.target.value}))} style={styles.input}>
                    {["Service Desk", "L2 Support", "DBA Team", "Network Team", "DevOps Team"].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div style={styles.formRow}>
                  <label style={styles.fieldLabel}>Assigned to</label>
                  <input value={user?.user?.name || ""} readOnly style={{ ...styles.input, background: darkMode ? "#1a1b2e" : "#f1f5f9" }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Short description</label>
              <input 
                value={triageForm.impact} 
                onChange={e => setTriageForm(f => ({ ...f, impact: e.target.value }))} 
                placeholder="Brief summary of the issue" 
                style={styles.input} 
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Description</label>
              <textarea
                value={triageForm.description}
                onChange={e => setTriageForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Full details of the incident..."
                style={{ ...styles.textarea, minHeight: 120 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>
                {(triageForm.state === "Resolved" || triageForm.state === "Closed") 
                  ? "Resolution Notes (Required to Save)" 
                  : "Update Notes / Progress (Optional)"}
              </label>
              <textarea
                value={triageForm.resolution}
                onChange={e => setTriageForm(f => ({ ...f, resolution: e.target.value }))}
                placeholder="How was this incident resolved?"
                style={{ ...styles.textarea, minHeight: 80, borderColor: triageForm.resolution.trim() ? "#10b981" : undefined }}
              />
            </div>

            {/* AI Recommendation Highlight */}
            {suggestedResolution && (
              <div style={{ 
                margin: "20px 0", padding: "16px", background: darkMode ? "#064e3b" : "#f0fdf4", 
                border: `2px solid ${darkMode ? "#059669" : "#a7f3d0"}`, borderRadius: 12,
                boxShadow: "0 4px 12px rgba(5,150,105,0.1)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>💡</span>
                  <strong style={{ color: darkMode ? "#34d399" : "#059669", fontSize: 14 }}>AI Suggested Resolution (Based on History)</strong>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: darkMode ? "#e5e7eb" : "#374151", margin: 0 }}>
                  {suggestedResolution}
                </p>
                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <button 
                    onClick={() => {
                      setResForm(f => ({ ...f, actions: suggestedResolution }));
                      setActiveModule("resolution");
                    }} 
                    style={{ ...styles.btn(true), padding: "6px 14px", fontSize: 12 }}
                  >
                    Apply this resolution
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button onClick={resetForm} style={styles.btn(false)}>Reset</button>
              <button 
                onClick={handleSaveKB} 
                disabled={loading} 
                style={{ ...styles.btn(false), border: "1px solid #059669", color: "#059669" }}
              >
                💾 Save to Knowledge (Update History)
              </button>
              <button 
                onClick={handleTriage} 
                disabled={loading} 
                style={styles.btn(true, loading)}
              >
                {loading ? "Analyzing..." : "✨ AI Analyze Incident"}
              </button>
            </div>

            {/* History Timeline */}
            {incidentHistory.length > 0 && (
              <div style={{ marginTop: 40, borderTop: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`, paddingTop: 24 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: darkMode ? "#9ca3af" : "#4b5563" }}>🕰️ Incident History (Audit Log)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[...incidentHistory].reverse().map((h, i) => (
                    <div key={i} style={{ display: "flex", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#4f46e5", zIndex: 1 }} />
                        {i < incidentHistory.length - 1 && <div style={{ flex: 1, width: 2, background: darkMode ? "#374151" : "#e2e8f0" }} />}
                      </div>
                      <div style={{ paddingBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: darkMode ? "#e5e7eb" : "#374151" }}>{h.action} - {new Date(h.timestamp).toLocaleString("vi-VN")}</div>
                        <div style={{ fontSize: 13, color: darkMode ? "#9ca3af" : "#4b5563", marginTop: 4, fontStyle: "italic" }}>"{h.notes}"</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, display: "flex", gap: 8 }}>
                          <span>Priority: {h.priority}</span> | <span>Category: {h.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ANALYSIS (RAG) */}
        {activeModule === "rca" && (
          <>
            {/* KB Search Section */}
            <div style={{ 
              marginBottom: 24, padding: 20, borderRadius: 16, 
              background: darkMode ? "#111827" : "#f8fafc",
              border: `1px solid ${darkMode ? "#374151" : "#e2e8f0"}`
            }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🔍 Discovery & RCA</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>Search historical data to find root causes and fixes.</p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <input 
                  value={analysisSearchQuery} 
                  onChange={e => setAnalysisSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAnalysisSearch()}
                  placeholder="Describe issue or enter INC#..." 
                  style={{ ...styles.input, flex: 1, fontSize: 15 }} 
                />
                <button onClick={handleAnalysisSearch} disabled={loading} style={{ ...styles.btn(true), width: "auto", padding: "0 24px" }}>
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Search Results */}
              {analysisSearchResults && (
                <div style={{ marginTop: 24 }}>
                  {analysisSearchResults.status === "not_found" ? (
                    <div style={{ color: "#ef4444", fontSize: 14, fontWeight: 500, textAlign: "center", padding: 20 }}>❌ {analysisSearchResults.message}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {analysisSearchResults.results.map((res, i) => (
                        <div key={i} 
                          onClick={() => setSelectedAnalysisItem(res)}
                          style={{ 
                            padding: 16, borderRadius: 12, background: darkMode ? "#1f2937" : "#fff", 
                            border: `1px solid ${darkMode ? "#374151" : "#f1f5f9"}`,
                            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <strong style={{ fontSize: 14, color: darkMode ? "#34d399" : "#4f46e5" }}>
                              {res.metadata.number || res.id}
                            </strong>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>Match Score: {Math.round(res.score * 100)}%</span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{res.metadata.title || "Incident Recovery"}</div>
                          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {res.metadata.content || res.metadata.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Item Modal/Detail View */}
              {selectedAnalysisItem && (
                <div style={{ 
                  marginTop: 24, padding: 20, borderRadius: 12, 
                  background: darkMode ? "#0f172a" : "#fff",
                  border: `2px solid #4f46e5`, animation: "fadeIn 0.3s ease"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18 }}>{selectedAnalysisItem.metadata.number} Details</h2>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>Saved to Knowledge Base</div>
                    </div>
                    <button onClick={() => setSelectedAnalysisItem(null)} style={{ border: "none", background: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ background: darkMode ? "#1e293b" : "#f1f5f9", padding: 10, borderRadius: 8 }}>
                      <label style={{ fontSize: 11, color: "#9ca3af", display: "block" }}>Priority</label>
                      <span style={{ fontWeight: 700 }}>{selectedAnalysisItem.metadata.priority}</span>
                    </div>
                    <div style={{ background: darkMode ? "#1e293b" : "#f1f5f9", padding: 10, borderRadius: 8 }}>
                      <label style={{ fontSize: 11, color: "#9ca3af", display: "block" }}>Category</label>
                      <span style={{ fontWeight: 700 }}>{selectedAnalysisItem.metadata.category}</span>
                    </div>
                  </div>

                  <label style={{ fontSize: 12, fontWeight: 700 }}>Description</label>
                  <p style={{ fontSize: 13, marginBottom: 16 }}>{selectedAnalysisItem.metadata.description || selectedAnalysisItem.metadata.content}</p>

                  <label style={{ fontSize: 12, fontWeight: 700 }}>Resolution</label>
                  <p style={{ fontSize: 13, background: darkMode ? "#064e3b" : "#f0fdf4", padding: 12, borderRadius: 8, color: darkMode ? "#34d399" : "#065f46", border: `1px solid ${darkMode ? "#065f46" : "#bbf7d0"}` }}>
                    {selectedAnalysisItem.metadata.resolution}
                  </p>

                  <button 
                    onClick={() => handleSelectIncident(selectedAnalysisItem.metadata.number)}
                    style={{ ...styles.btn(true), marginTop: 12 }}
                  >
                    Open in Incident Form
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* RESOLUTION */}
        {activeModule === "resolution" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>📄 Tóm tắt Incident</label>
              <input value={resForm.summary} onChange={e => setResForm(f => ({ ...f, summary: e.target.value }))} placeholder="VD: Database connection issue on production..." style={styles.input} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>🔧 Actions đã thực hiện *</label>
              <textarea value={resForm.actions} onChange={e => setResForm(f => ({ ...f, actions: e.target.value }))} placeholder="VD: Restarted connection pool, increased max connections..." style={styles.textarea} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>✅ Kết quả</label>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Resolved", "Workaround", "Escalated", "Pending"].map(o => (
                    <button key={o} onClick={() => setResForm(f => ({ ...f, outcome: o }))} style={styles.chip(resForm.outcome === o)}>{o}</button>
                  ))}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: darkMode ? "#6ee7b7" : "#059669", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={resForm.saveToKB} 
                    onChange={e => setResForm(f => ({ ...f, saveToKB: e.target.checked }))} 
                  />
                  Save to Knowledge Base
                </label>
              </div>
            </div>
          </>
        )}

        {/* ESCALATION */}
        {activeModule === "escalation" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="esc-grid">
              <div>
                <label style={styles.label}>🎫 Incident ID</label>
                <input value={escForm.id} onChange={e => setEscForm(f => ({ ...f, id: e.target.value }))} placeholder="INC0012345" style={styles.input} />
              </div>
              <div>
                <label style={styles.label}>📤 Escalate to</label>
                <select value={escForm.to} onChange={e => setEscForm(f => ({ ...f, to: e.target.value }))} style={styles.input}>
                  {ESCALATE_TO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>📝 Summary *</label>
              <textarea value={escForm.summary} onChange={e => setEscForm(f => ({ ...f, summary: e.target.value }))} placeholder="Mô tả ngắn gọn incident và tình trạng hiện tại..." style={styles.textarea} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>⚡ Urgency</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Critical", "High", "Medium", "Low"].map(u => (
                  <button key={u} onClick={() => setEscForm(f => ({ ...f, urgency: u }))} style={styles.chip(escForm.urgency === u)}>{u}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>✅ Actions đã làm</label>
              <textarea value={escForm.done} onChange={e => setEscForm(f => ({ ...f, done: e.target.value }))} placeholder="Các bước đã troubleshoot..." style={styles.textarea} rows={2} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>🙏 Request</label>
              <input value={escForm.ask} onChange={e => setEscForm(f => ({ ...f, ask: e.target.value }))} placeholder="VD: Cần support check database performance..." style={styles.input} />
            </div>
          </>
        )}

        {/* SLA TIMER */}
        {activeModule === "sla" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>🎯 Priority Level</label>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(SLA_TARGETS).map(([key, val]) => (
                  <button key={key} onClick={() => setSlaForm(f => ({ ...f, priority: key }))} style={styles.chip(slaForm.priority === key)}>
                    {key} - {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>🕐 Thời gian bắt đầu Incident</label>
              <input type="datetime-local" value={slaForm.startTime} onChange={e => setSlaForm(f => ({ ...f, startTime: e.target.value }))} style={styles.input} />
            </div>
            {slaRemaining !== null && (
              <div style={{ textAlign: "center", padding: 24, background: darkMode ? "#1a1b2e" : "#f9fafb", borderRadius: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                  {slaForm.priority} SLA Countdown
                </div>
                <div className="sla-countdown" style={{ fontSize: 48, fontWeight: 800, color: getSlaColor(slaRemaining, slaTotalMs), fontVariantNumeric: "tabular-nums" }}>
                  {formatRemaining(slaRemaining)}
                </div>
                <div style={{ marginTop: 12, height: 8, background: darkMode ? "#3a3b5c" : "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, (slaRemaining / slaTotalMs) * 100))}%`,
                    height: "100%",
                    background: getSlaColor(slaRemaining, slaTotalMs),
                    borderRadius: 4,
                    transition: "width 1s linear",
                  }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
                  Target: {SLA_TARGETS[slaForm.priority].hours} giờ từ khi bắt đầu
                </div>
              </div>
            )}
          </>
        )}

        {/* DASHBOARD */}
        {activeModule === "dashboard" && (
          <>
            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>🔍 Tìm kiếm Incident (semantic search via Pinecone)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={dashSearch}
                  onChange={e => setDashSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadDashboard(dashSearch)}
                  placeholder="VD: database connection timeout, server down..."
                  style={{ ...styles.input, flex: 1 }}
                />
                <button onClick={() => loadDashboard(dashSearch)} disabled={dashLoading} style={styles.btn(true, dashLoading)}>
                  {dashLoading ? "⏳" : "🔍 Search"}
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }} className="stats-grid">
              {[
                { label: "Total", value: dashStats.total, color: "#4f46e5" },
                { label: "P1 Critical", value: dashStats.p1, color: "#dc2626" },
                { label: "P2 High", value: dashStats.p2, color: "#ea580c" },
                { label: "P3 Medium", value: dashStats.p3, color: "#ca8a04" },
                { label: "P4 Low", value: dashStats.p4, color: "#16a34a" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", padding: 12, borderRadius: 10, background: darkMode ? "#1a1b2e" : "#f9fafb", border: `1.5px solid ${darkMode ? "#3a3b5c" : "#e5e7eb"}` }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            {dashboardData.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="charts-grid">
                {/* Bar Chart - Priority Distribution */}
                <div style={{ padding: 16, borderRadius: 12, background: darkMode ? "#1a1b2e" : "#f9fafb", border: `1.5px solid ${darkMode ? "#3a3b5c" : "#e5e7eb"}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: darkMode ? "#e5e7eb" : "#374151" }}>Priority Distribution</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "P1 Critical", value: dashStats.p1, color: "#dc2626" },
                      { label: "P2 High", value: dashStats.p2, color: "#ea580c" },
                      { label: "P3 Medium", value: dashStats.p3, color: "#ca8a04" },
                      { label: "P4 Low", value: dashStats.p4, color: "#16a34a" },
                    ].map(bar => (
                      <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#9ca3af", width: 70, textAlign: "right" }}>{bar.label}</span>
                        <div style={{ flex: 1, height: 20, background: darkMode ? "#252640" : "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{
                            width: `${dashStats.total ? (bar.value / dashStats.total) * 100 : 0}%`,
                            height: "100%",
                            background: bar.color,
                            borderRadius: 4,
                            transition: "width 0.5s ease",
                            minWidth: bar.value > 0 ? 20 : 0,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: bar.color, width: 24, textAlign: "right" }}>{bar.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut Chart - Category Breakdown */}
                <div style={{ padding: 16, borderRadius: 12, background: darkMode ? "#1a1b2e" : "#f9fafb", border: `1.5px solid ${darkMode ? "#3a3b5c" : "#e5e7eb"}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: darkMode ? "#e5e7eb" : "#374151" }}>Category Breakdown</div>
                  {(() => {
                    const cats = {};
                    dashboardData.forEach(inc => {
                      const c = inc.metadata?.category || "Unknown";
                      cats[c] = (cats[c] || 0) + 1;
                    });
                    const catColors = { Database: "#dc2626", Performance: "#ea580c", Infrastructure: "#ca8a04", Security: "#7c3aed", Integration: "#2563eb", Application: "#0891b2", Network: "#059669", Unknown: "#9ca3af" };
                    const total = dashboardData.length;
                    let accumulated = 0;
                    const segments = Object.entries(cats).map(([name, count]) => {
                      const pct = (count / total) * 100;
                      const start = accumulated;
                      accumulated += pct;
                      return { name, count, pct, start, color: catColors[name] || "#6b7280" };
                    });
                    const gradient = segments.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                          width: 100, height: 100, borderRadius: "50%",
                          background: `conic-gradient(${gradient})`,
                          position: "relative", flexShrink: 0,
                        }}>
                          <div style={{
                            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                            width: 50, height: 50, borderRadius: "50%",
                            background: darkMode ? "#1a1b2e" : "#f9fafb",
                          }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                          {segments.map(s => (
                            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                              <span style={{ color: darkMode ? "#e5e7eb" : "#374151" }}>{s.name}</span>
                              <span style={{ marginLeft: "auto", color: "#9ca3af", fontWeight: 600 }}>{s.count} ({Math.round(s.pct)}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["all", "P1", "P2", "P3", "P4"].map(f => (
                <button key={f} onClick={() => setDashFilter(f)} style={styles.chip(dashFilter === f)}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
              <button onClick={() => loadDashboard(dashSearch || "incident")} style={{ ...styles.chip(false), marginLeft: "auto" }}>
                🔄 Refresh
              </button>
            </div>

            {/* Incident List */}
            {filteredDashboard.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredDashboard.map((inc, i) => (
                  <div 
                    key={inc.id || i} 
                    onClick={() => handleSelectIncident(inc.metadata?.number || inc.id)}
                    style={{ 
                      padding: 14, 
                      borderRadius: 10, 
                      background: darkMode ? "#1a1b2e" : "#f9fafb", 
                      border: `1px solid ${darkMode ? "#3a3b5c" : "#e5e7eb"}`,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    className="dashboard-item"
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "#4f46e5"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = darkMode ? "#3a3b5c" : "#e5e7eb"}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {inc.metadata?.priority && (
                          <span style={styles.badge(inc.metadata.priority === "P1" ? "red" : inc.metadata.priority === "P2" ? "orange" : inc.metadata.priority === "P3" ? "yellow" : "green")}>
                            {inc.metadata.priority}
                          </span>
                        )}
                        {inc.metadata?.category && (
                          <span style={{ ...styles.badge("green"), background: darkMode ? "#312e81" : "#ede9fe", color: darkMode ? "#a5b4fc" : "#7c3aed" }}>
                            {inc.metadata.category}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          Score: {Math.round((inc.score || 0) * 100)}%
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteIncident(inc.metadata?.number || inc.id); }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "14px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            color: "#ef4444",
                            zIndex: 2
                          }}
                          title="Delete Incident"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e5e7eb" : "#374151" }}>
                      <span style={{ color: "#4f46e5", marginRight: 8, textDecoration: "underline" }}>
                        {inc.metadata?.number || inc.id}
                      </span>
                      {inc.metadata?.description || inc.metadata?.title || "No description"}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, display: "flex", gap: 12 }}>
                      {inc.metadata?.suggested_team && <span>👥 {inc.metadata.suggested_team}</span>}
                      {inc.metadata?.impact && <span>💥 {inc.metadata.impact}</span>}
                      {inc.metadata?.timestamp && <span>📅 {new Date(inc.metadata.timestamp).toLocaleDateString("vi-VN")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                {dashLoading ? "⏳ Đang tải..." : "Không có incident. Hãy tìm kiếm hoặc tạo incident qua Triage."}
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Buttons */}
        {activeModule !== "dashboard" && activeModule !== "chatbot" && <div style={{ display: "flex", gap: 10 }} className="btn-group">
          {activeModule === "sla" ? (
            <>
              <button onClick={startSlaTimer} style={styles.btn(true, false)}>⏱️ Start Timer</button>
              {slaRemaining !== null && <button onClick={stopSlaTimer} style={styles.btn(false, false)}>⏹️ Stop</button>}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (activeModule === "triage") handleTriage();
                  else if (activeModule === "rca") handleRCA();
                  else if (activeModule === "resolution") handleResolution();
                  else handleEscalation();
                }}
                disabled={loading}
                style={{ ...styles.btn(true, loading), padding: "14px 28px", fontSize: 15, borderRadius: 12, display: "flex", alignItems: "center", gap: 8 }}
              >
                {loading ? <><span className="spinner" /> Analyzing...</> : <><span style={{ fontSize: 18 }}>✨</span> {activeModule === "triage" ? "Analyze Incident" : activeModule === "rca" ? "Find Root Cause" : activeModule === "resolution" ? "Generate Summary" : "Draft Email"}</>}
              </button>
              {activeModule === "triage" && (
                <button onClick={handleWorkflow} disabled={loading} style={{ ...styles.btn(false, loading), background: loading ? undefined : darkMode ? "#064e3b" : "#ecfdf5", color: darkMode ? "#34d399" : "#059669", border: `1.5px solid ${darkMode ? "#065f46" : "#a7f3d0"}`, display: "flex", alignItems: "center", gap: 8 }}>
                  {loading ? <><span className="spinner" style={{ borderColor: "rgba(5,150,105,0.3)", borderTopColor: "#059669" }} /> Processing...</> : <><span style={{ fontSize: 16 }}>🔄</span> Full Workflow</>}
                </button>
              )}
              <button onClick={resetForm} style={styles.btn(false, false)}>🔄 Reset</button>
            </>
          )}
        </div>}
      </div>

      {/* Loading Skeleton */}
      {loading && !result && (
        <div style={{ ...styles.card, padding: 20 }} className="fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div className="loading-dots"><span /><span /><span /></div>
            <span style={{ fontSize: 13, color: darkMode ? "#6ee7b7" : "#059669", fontWeight: 600 }}>
              AI đang phân tích{activeModule === "triage" ? " & tìm incident tương tự từ Pinecone" : ""}...
            </span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div className="skeleton" style={{ height: 18, width: "85%" }} />
            <div className="skeleton" style={{ height: 18, width: "70%" }} />
            <div className="skeleton" style={{ height: 18, width: "55%" }} />
            <div className="skeleton" style={{ height: 18, width: "75%" }} />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={styles.result} className="fade-in">
          <div style={styles.resultHeader} className="result-header">
            <span style={{ color: "#fff", fontWeight: 600 }}>
              {result.type === "workflow" ? "🔄 Full Workflow Result" : activeModule === "triage" ? "🎯 Triage Result" : activeModule === "rca" ? "🔍 Root Cause Analysis" : activeModule === "resolution" ? "✅ Resolution Summary" : "📧 Email Draft"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {activeModule === "resolution" && (
                <button onClick={exportPDF} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  📄 Export PDF
                </button>
              )}
              <button onClick={copyResult} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: copied ? "#10b981" : "rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>
          </div>
          <div id={activeModule === "resolution" ? "resolution-result" : undefined} style={styles.resultBody}>
            {result.type === "workflow" ? (
              <div style={{ display: "grid", gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🎯 Triage</h3>
                  {result.data.triage_result && renderTriageResult(result.data.triage_result)}
                </div>
                {result.data.rca_result && (
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🔍 Root Cause Analysis</h3>
                    <div style={{ whiteSpace: "pre-wrap" }}>{result.data.rca_result}</div>
                  </div>
                )}
                {result.data.resolution_draft && (
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>✅ Resolution Draft</h3>
                    <div style={{ whiteSpace: "pre-wrap" }}>{result.data.resolution_draft}</div>
                  </div>
                )}
              </div>
            ) : result.type === "json" && activeModule === "triage" ? renderTriageResult(result.data) : result.data}
          </div>
          
          {/* AI Ethics Disclaimer */}
          <div style={styles.disclaimer}>
            <span>🤖</span>
            <span>AI-generated content. Please review before using. Human verification recommended for critical decisions.</span>
          </div>
        </div>
      )}

      {/* Similar Incidents */}
      {activeModule === "triage" && similarIncidents.length > 0 && (
        <div style={{ ...styles.card, marginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: darkMode ? "#e5e7eb" : "#374151" }}>📂 Incident tương tự trước đây</h3>
          {similarIncidents.map((inc, i) => (
            <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? `1px solid ${darkMode ? "#3a3b5c" : "#e5e7eb"}` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? "#e5e7eb" : "#374151" }}>
                {(inc.metadata?.description || "").length > 100 ? inc.metadata.description.slice(0, 100) + "..." : inc.metadata?.description}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <span>Score: {Math.round((inc.score || 0) * 100)}%</span>
                {inc.metadata?.priority && (
                  <span style={styles.badge(inc.metadata.priority === "P1" ? "red" : inc.metadata.priority === "P2" ? "orange" : "green")}>
                    {inc.metadata.priority}
                  </span>
                )}
                {inc.metadata?.category && <span>• {inc.metadata.category}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p style={{ textAlign: "center", color: darkMode ? "#4b5563" : "#d1d5db", fontSize: 11, marginTop: 32, paddingBottom: 20 }}>
        IT Incident Assistant • GreenAI Team • FSoft Academy
      </p>
      </div>
    </div>
  );
}
