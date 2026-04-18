import { useState, useCallback, useEffect, useRef } from "react";

// ============================================
// CONSTANTS
// ============================================
const MODULES = [
  { id: "triage", icon: "🎯", label: "Triage", desc: "Phân loại Priority" },
  { id: "rca", icon: "🔍", label: "Root Cause", desc: "Phân tích nguyên nhân" },
  { id: "resolution", icon: "✅", label: "Resolution", desc: "Tóm tắt giải pháp" },
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

  const [activeModule, setActiveModule] = useState("triage");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState({ provider: "openai", showStats: true, moderation: true });
  
  // Stats
  const [stats, setStats] = useState({ inTokens: 0, outTokens: 0, latency: 0, retries: 0 });
  
  // Forms
  const [triageForm, setTriageForm] = useState({ description: "", impact: "", severity: "", systems: [] });
  const [rcaForm, setRcaForm] = useState({ symptoms: "", logs: "", timeline: "" });
  const [resForm, setResForm] = useState({ summary: "", actions: "", outcome: "Resolved" });
  const [escForm, setEscForm] = useState({ id: "", summary: "", to: "L2 Support", urgency: "High", done: "", ask: "" });

  // SLA Timer
  const [slaForm, setSlaForm] = useState({ priority: "P1", startTime: "" });
  const [slaRemaining, setSlaRemaining] = useState(null);
  const [slaTotalMs, setSlaTotalMs] = useState(null);
  const slaIntervalRef = useRef(null);

  // Similar incidents
  const [similarIncidents, setSimilarIncidents] = useState([]);

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
    if (!triageForm.description.trim()) { setError("Vui lòng nhập mô tả incident"); return; }
    const data = await callEndpoint("/api/triage", { description: triageForm.description, impact: triageForm.impact });
    if (data) {
      setResult({ type: "json", data: data.triage });
      setSimilarIncidents(data.similar_incidents || []);
      setLoading(false);
    }
  };

  const handleRCA = async () => {
    if (!rcaForm.symptoms.trim()) { setError("Vui lòng nhập triệu chứng"); return; }
    const data = await callEndpoint("/api/rca", { symptoms: rcaForm.symptoms, logs: rcaForm.logs, timeline: rcaForm.timeline });
    if (data) { setResult({ type: "text", data: data.analysis }); setLoading(false); }
  };

  const handleResolution = async () => {
    if (!resForm.actions.trim()) { setError("Vui lòng nhập các actions đã thực hiện"); return; }
    const data = await callEndpoint("/api/resolution", { summary: resForm.summary, actions: resForm.actions, outcome: resForm.outcome });
    if (data) { setResult({ type: "text", data: data.resolution }); setLoading(false); }
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
        {/* TRIAGE */}
        {activeModule === "triage" && (
          <>
            {/* Sample Cards */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: darkMode ? "#6ee7b7" : "#065f46", fontWeight: 700 }}>Quick Templates</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Click to load</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }} className="esc-grid">
                {SAMPLES.triage.map((s, i) => (
                  <button key={i} onClick={() => loadSample("triage", i)} className="tpl-card" style={{
                    padding: "14px 12px", borderRadius: 12, border: `1.5px solid ${darkMode ? "#065f46" : "#d1fae5"}`,
                    background: darkMode ? "#022c22" : "#fff", cursor: "pointer", textAlign: "left",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: s.color + "18", color: s.color }}>{s.tag}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e5e7eb" : "#1f2937", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{s.description.slice(0, 60)}...</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity + Systems Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }} className="esc-grid">
              <div>
                <label style={styles.label}>Severity Level</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { val: "P1", label: "P1 Critical", color: "#fff", bg: "#ef4444", border: "#ef4444" },
                    { val: "P2", label: "P2 High", color: "#fff", bg: "#f97316", border: "#f97316" },
                    { val: "P3", label: "P3 Medium", color: "#fff", bg: "#eab308", border: "#eab308" },
                    { val: "P4", label: "P4 Low", color: "#fff", bg: "#6b7280", border: "#6b7280" },
                  ].map(p => (
                    <button key={p.val} onClick={() => setTriageForm(f => ({ ...f, severity: f.severity === p.val ? "" : p.val }))} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, border: `2px solid ${triageForm.severity === p.val ? p.border : darkMode ? "#065f46" : "#e5e7eb"}`,
                      background: triageForm.severity === p.val ? p.bg : "transparent",
                      color: triageForm.severity === p.val ? p.color : darkMode ? "#9ca3af" : "#6b7280",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                      boxShadow: triageForm.severity === p.val ? `0 2px 8px ${p.bg}40` : "none",
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={styles.label}>Affected Systems</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {AFFECTED_SYSTEMS.slice(0, 6).map(sys => (
                    <button key={sys} onClick={() => setTriageForm(f => ({ ...f, systems: f.systems.includes(sys) ? f.systems.filter(s => s !== sys) : [...f.systems, sys] }))} style={{
                      padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer",
                      border: `1px solid ${triageForm.systems.includes(sys) ? "#059669" : darkMode ? "#065f46" : "#d1fae5"}`,
                      background: triageForm.systems.includes(sys) ? (darkMode ? "#064e3b" : "#ecfdf5") : "transparent",
                      color: triageForm.systems.includes(sys) ? (darkMode ? "#34d399" : "#059669") : darkMode ? "#9ca3af" : "#6b7280",
                      transition: "all 0.15s",
                    }}>{sys}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ ...styles.label, marginBottom: 0 }}>Incident Description *</label>
                <span style={{ fontSize: 11, color: triageForm.description.length > 500 ? "#dc2626" : "#9ca3af", fontWeight: 500 }}>
                  {triageForm.description.length}/500
                </span>
              </div>
              <textarea
                value={triageForm.description}
                onChange={e => setTriageForm(f => ({ ...f, description: e.target.value.slice(0, 500) }))}
                placeholder="Mô tả chi tiết incident: thời gian xảy ra, triệu chứng, error message..."
                style={{ ...styles.textarea, minHeight: 100 }}
              />
            </div>

            {/* Impact */}
            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>Business Impact</label>
              <input value={triageForm.impact} onChange={e => setTriageForm(f => ({ ...f, impact: e.target.value }))} placeholder="VD: 500 users affected, revenue loss $10K/hour..." style={styles.input} />
            </div>

            {/* Quick Stats */}
            {dashboardData.length > 0 && (
              <div style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 10, background: darkMode ? "#022c22" : "#f0fdf4", border: `1px solid ${darkMode ? "#065f46" : "#d1fae5"}`, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: darkMode ? "#6ee7b7" : "#065f46" }}>
                  <span style={{ fontWeight: 700 }}>{dashboardData.length}</span> incidents stored
                </div>
                <div style={{ width: 1, background: darkMode ? "#065f46" : "#a7f3d0" }} />
                <div style={{ fontSize: 11, color: darkMode ? "#6ee7b7" : "#065f46" }}>
                  <span style={{ fontWeight: 700 }}>{dashboardData.filter(i => i.metadata?.priority === "P1").length}</span> P1 critical
                </div>
                <div style={{ width: 1, background: darkMode ? "#065f46" : "#a7f3d0" }} />
                <div style={{ fontSize: 11, color: darkMode ? "#6ee7b7" : "#065f46" }}>
                  Powered by <span style={{ fontWeight: 700 }}>Pinecone RAG</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* RCA */}
        {activeModule === "rca" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>📌 Samples:</span>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {SAMPLES.rca.map((s, i) => (
                  <button key={i} onClick={() => loadSample("rca", i)} style={styles.chip(false)}>{s.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>🤒 Triệu chứng *</label>
              <textarea value={rcaForm.symptoms} onChange={e => setRcaForm(f => ({ ...f, symptoms: e.target.value }))} placeholder="VD: App không connect được database..." style={styles.textarea} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>📋 Error Logs</label>
              <textarea value={rcaForm.logs} onChange={e => setRcaForm(f => ({ ...f, logs: e.target.value }))} placeholder="Paste error logs here..." style={{ ...styles.textarea, fontFamily: "monospace", fontSize: 12 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>⏱️ Timeline</label>
              <textarea value={rcaForm.timeline} onChange={e => setRcaForm(f => ({ ...f, timeline: e.target.value }))} placeholder="14:30 - Alert triggered&#10;14:35 - Team notified..." style={styles.textarea} rows={3} />
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
              <div style={{ display: "flex", gap: 8 }}>
                {["Resolved", "Workaround", "Escalated", "Pending"].map(o => (
                  <button key={o} onClick={() => setResForm(f => ({ ...f, outcome: o }))} style={styles.chip(resForm.outcome === o)}>{o}</button>
                ))}
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
                  <div key={inc.id || i} style={{ padding: 14, borderRadius: 10, background: darkMode ? "#1a1b2e" : "#f9fafb", border: `1px solid ${darkMode ? "#3a3b5c" : "#e5e7eb"}` }}>
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
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        Score: {Math.round((inc.score || 0) * 100)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? "#e5e7eb" : "#374151" }}>
                      {inc.metadata?.description || "No description"}
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
        {activeModule !== "dashboard" && <div style={{ display: "flex", gap: 10 }} className="btn-group">
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
