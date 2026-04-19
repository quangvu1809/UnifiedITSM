import { useState, useRef, useEffect } from "react";

const SUGGESTIONS = [
  "I can't connect to VPN",
  "What's the status of TKT-001?",
  "Outlook keeps crashing",
  "WiFi keeps dropping",
  "How do I reset my password?",
  "Can't access shared drive",
];

const statusColors = { 
  Open: ["#FCEBEB", "#A32D2D"], 
  "In Progress": ["#FAEEDA", "#854F0B"], 
  Resolved: ["#E1F5EE", "#0F6E56"] 
};

function ToolBadge({ name, args, result, dark }) {
  const [open, setOpen] = useState(false);
  const icons = { get_ticket_status: "🎫", create_ticket: "➕", search_knowledge_base: "🔍" };
  const labels = { 
    get_ticket_status: "Looked up ticket", 
    create_ticket: "Created ticket", 
    search_knowledge_base: "KB Search (Pinecone RAG)" 
  };
  
  const bgColor = dark ? "#064e3b" : "#ecfdf5";
  const borderColor = dark ? "#059669" : "#a7f3d0";
  const textColor = dark ? "#34d399" : "#065f46";

  return (
    <div style={{ marginBottom: 4 }}>
      <button 
        onClick={() => setOpen(o => !o)} 
        style={{ 
          display: "inline-flex", alignItems: "center", gap: 6, 
          background: bgColor, border: `1px solid ${borderColor}`, 
          borderRadius: 8, padding: "3px 10px", cursor: "pointer", 
          fontSize: 12, color: textColor 
        }}
      >
        <span>{icons[name] || "⚙️"}</span>{labels[name] || name}<span style={{ fontSize: 9, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre style={{ 
          margin: "4px 0 0", padding: "8px 10px", 
          background: dark ? "#022c22" : "#f0fdf4", 
          border: `1px solid ${borderColor}`, 
          borderRadius: 8, fontSize: 11, whiteSpace: "pre-wrap", 
          wordBreak: "break-all", maxWidth: "100%", color: dark ? "#e5e7eb" : "#333"
        }}>
          {JSON.stringify({ args, result }, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TicketChip({ ticket, dark }) {
  const [bg, fg] = statusColors[ticket.status] || ["#f5f5f5", "#333"];
  return (
    <div style={{ 
      marginTop: 8, background: dark ? "#022c22" : "#f9f9f9", 
      border: `1px solid ${dark ? "#065f46" : "#eee"}`, 
      borderRadius: 10, padding: "10px 14px", fontSize: 13, maxWidth: 300 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: dark ? "#e5e7eb" : "#333" }}>{ticket.id}</span>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: bg, color: fg, fontWeight: 600 }}>{ticket.status}</span>
      </div>
      <div style={{ color: dark ? "#9ca3af" : "#555", marginBottom: 6, lineHeight: 1.4 }}>{ticket.title || ticket.description}</div>
      <div style={{ display: "flex", gap: 12 }}>
        <span style={{ fontSize: 11, color: "#888" }}>Priority: {ticket.priority}</span>
        <span style={{ fontSize: 11, color: "#888" }}>Asignee: {ticket.assignee}</span>
      </div>
    </div>
  );
}

function AudioPlayer({ audioBase64, lang, dark }) {
  if (!audioBase64) return null;
  const audioUrl = `data:audio/wav;base64,${audioBase64}`;
  const langLabel = lang === "vie" ? "Vietnamese" : "English";
  return (
    <div style={{ marginTop: 8 }}>
      <audio controls src={audioUrl} style={{ height: 32, width: "100%", maxWidth: 280 }} />
      <div style={{ fontSize: 10, color: dark ? "#34d399" : "#059669", marginTop: 4, fontWeight: 500 }}>
        🔊 AI Voice: {langLabel}
      </div>
    </div>
  );
}

function Bubble({ msg, dark }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ 
      display: "flex", flexDirection: "column", 
      alignItems: isUser ? "flex-end" : "flex-start", 
      marginBottom: 16 
    }}>
      {!isUser && msg.tools?.length > 0 && (
        <div style={{ marginBottom: 6, paddingLeft: 2 }}>
          {msg.tools.map((t, i) => <ToolBadge key={i} name={t.name} args={t.args} result={t.result} dark={dark} />)}
        </div>
      )}
      <div style={{ 
        maxWidth: "85%", padding: "12px 16px", 
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", 
        background: isUser ? (dark ? "#059669" : "#059669") : (dark ? "#064e3b" : "#f0fdf4"), 
        color: isUser ? "#fff" : (dark ? "#e5e7eb" : "#1f2937"), 
        fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", 
        border: isUser ? "none" : `1px solid ${dark ? "#065f46" : "#d1fae5"}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        {msg.content}
      </div>
      {!isUser && msg.ticket && <TicketChip ticket={msg.ticket} dark={dark} />}
      {!isUser && msg.audio && <AudioPlayer audioBase64={msg.audio} lang={msg.ttsLang} dark={dark} />}
    </div>
  );
}

export default function ChatAssistant({ dark, apiBase }) {
  // Session management
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("chat_sessions");
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("Failed to load sessions", e); }
    return [{ id: "default", title: "New Conversation", messages: [], history: [], createdAt: Date.now() }];
  });
  
  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      return localStorage.getItem("active_session_id") || "default";
    } catch { return "default"; }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsLang, setTtsLang] = useState("auto");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;
  const history = activeSession.history;

  useEffect(() => {
    localStorage.setItem("chat_sessions", JSON.stringify(sessions));
    localStorage.setItem("active_session_id", activeSessionId);
  }, [sessions, activeSessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const createNewSession = () => {
    const id = Date.now().toString();
    const newSess = { id, title: "New Conversation", messages: [], history: [], createdAt: Date.now() };
    setSessions(prev => [newSess, ...prev]);
    setActiveSessionId(id);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      setSessions([{ id: "default", title: "New Conversation", messages: [], history: [], createdAt: Date.now() }]);
      setActiveSessionId("default");
      return;
    }
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) setActiveSessionId(filtered[0].id);
  };

  const updateActiveSession = (newMsgs, newHist) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        // Auto-update title based on first message
        let title = s.title;
        if (s.messages.length === 0 && newMsgs.length > 0) {
          title = newMsgs[0].content.slice(0, 30) + (newMsgs[0].content.length > 30 ? "..." : "");
        }
        return { ...s, messages: newMsgs, history: newHist, title };
      }
      return s;
    }));
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    
    const userMsg = { role: "user", content: msg };
    const nextMessages = [...messages, userMsg];
    const nextHistory = [...history, userMsg];
    
    updateActiveSession(nextMessages, nextHistory);
    setLoading(true);
    setThinkingStep(1);

    const timers = [
      setTimeout(() => setThinkingStep(2), 800),
      setTimeout(() => setThinkingStep(3), 1800),
      setTimeout(() => setThinkingStep(4), 3500),
    ];

    try {
      const res = await fetch(`${apiBase}/api/chatbot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          history: nextHistory, 
          tts: ttsEnabled, 
          ttsLang: ttsLang === "auto" ? null : ttsLang 
        }),
      });
      
      const data = await res.json();
      timers.forEach(clearTimeout);
      if (!res.ok) throw new Error(data.detail || "Chat error");

      const assistantMsg = { 
        role: "assistant", 
        content: data.reply, 
        tools: data.toolLog, 
        ticket: data.ticketData, 
        audio: data.audio, 
        ttsLang: data.ttsLang 
      };
      
      updateActiveSession([...nextMessages, assistantMsg], [...nextHistory, { role: "assistant", content: data.reply }]);
    } catch (e) {
      timers.forEach(clearTimeout);
      updateActiveSession([...nextMessages, { role: "assistant", content: `❌ Error: ${e.message}` }], nextHistory);
    }
    setLoading(false);
    setThinkingStep(0);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div style={{ 
      display: "flex", height: "600px", 
      background: dark ? "#0f2920" : "#fff", 
      borderRadius: 16, overflow: "hidden", 
      border: `1px solid ${dark ? "#065f46" : "#d1fae5"}` 
    }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ 
          width: 260, borderRight: `1px solid ${dark ? "#065f46" : "#d1fae5"}`, 
          display: "flex", flexDirection: "column", background: dark ? "#0a1f18" : "#f9fcfb" 
        }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${dark ? "#065f46" : "#d1fae5"}` }}>
            <button 
              onClick={createNewSession}
              style={{ 
                width: "100%", padding: "10px", borderRadius: 10, 
                background: "linear-gradient(135deg, #059669, #10b981)", 
                color: "#fff", border: "none", fontWeight: 700, fontSize: 13, 
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 
              }}
            >
              <span>+</span> New Transaction
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {sessions.map(s => (
              <div 
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                style={{ 
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer", 
                  marginBottom: 4, position: "relative",
                  background: activeSessionId === s.id ? (dark ? "#064e3b" : "#ecfdf5") : "transparent",
                  border: `1px solid ${activeSessionId === s.id ? (dark ? "#059669" : "#a7f3d0") : "transparent"}`
                }}
                className="session-item"
              >
                <div style={{ 
                  fontSize: 13, fontWeight: activeSessionId === s.id ? 700 : 500, 
                  color: activeSessionId === s.id ? (dark ? "#34d399" : "#059669") : (dark ? "#9ca3af" : "#666"),
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 20
                }}>
                  {s.title}
                </div>
                <button 
                  onClick={(e) => deleteSession(s.id, e)}
                  style={{ 
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#ef4444", 
                    fontSize: 14, cursor: "pointer", opacity: 0.6 
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${dark ? "#065f46" : "#d1fae5"}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "#0f2920" : "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: dark ? "#34d399" : "#059669" }}
            >
              ☰
            </button>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: dark ? "#064e3b" : "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: dark ? "#34d399" : "#059669" }}>{activeSession.title}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>Multi-session Transaction Support</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button 
              onClick={() => setTtsEnabled(t => !t)} 
              style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 8, border: `1px solid ${ttsEnabled ? (dark ? "#059669" : "#059669") : (dark ? "#333" : "#ddd")}`, background: ttsEnabled ? (dark ? "#064e3b" : "#ecfdf5") : "transparent", color: ttsEnabled ? (dark ? "#34d399" : "#059669") : "#999", cursor: "pointer" }}
            >
              {ttsEnabled ? "🔊 Voice ON" : "🔇 Voice OFF"}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧤</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: dark ? "#34d399" : "#059669", marginBottom: 4 }}>How can I help you today?</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 24 }}>Ask me about IT troubleshooting, ticket status, or create a new request.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500, margin: "0 auto" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => send(s)} style={{ fontSize: 12, padding: "8px 16px", borderRadius: 20, color: dark ? "#34d399" : "#059669", background: dark ? "#064e3b" : "#ecfdf5", border: `1px solid ${dark ? "#059669" : "#a7f3d0"}`, cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"} onMouseOut={(e) => e.target.style.transform = "translateY(0)"}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => <Bubble key={i} msg={m} dark={dark} />)}
          {loading && (
            <div style={{ padding: "16px", background: dark ? "#064e3b" : "#f0fdf4", borderRadius: "16px 16px 16px 4px", border: `1px solid ${dark ? "#059669" : "#d1fae5"}`, maxWidth: 300, marginBottom: 16 }}>
              {[
                { step: 1, label: "Searching KB..." },
                { step: 2, label: "Reasoning..." },
                { step: 3, label: "Drafting..." },
                { step: 4, label: "Synthesizing..." },
              ].map(s => (
                <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 0", opacity: thinkingStep >= s.step ? 1 : 0.3 }}>
                  <span style={{ fontSize: 12 }}>{thinkingStep === s.step ? "⏳" : thinkingStep > s.step ? "✅" : "○"}</span>
                  <span style={{ fontSize: 12 }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ padding: "12px", borderTop: `1px solid ${dark ? "#065f46" : "#d1fae5"}`, background: dark ? "#0f2920" : "#fff", display: "flex", gap: 10, alignItems: "center" }}>
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={handleKey} 
            placeholder="Ask anything about ITSM..." 
            style={{ flex: 1, borderRadius: 12, padding: "12px 16px", fontSize: 14, border: `1.5px solid ${dark ? "#065f46" : "#a7f3d0"}`, outline: "none", background: dark ? "#022c22" : "#fff", color: dark ? "#e5e7eb" : "#1f2937" }} 
          />
          <button 
            onClick={() => send()} 
            disabled={loading || !input.trim()} 
            style={{ padding: "12px 20px", borderRadius: 12, background: input.trim() && !loading ? "#059669" : "#ccc", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
