import React, { useState, useEffect, useCallback } from 'react';

const SlaMonitor = ({ darkMode, styles, apiBase, slaTargets, lang }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, breached, long-pending
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchPendingIncidents = useCallback(async () => {
    setLoading(true);
    try {
      // Query 'New' and 'In Progress' incidents. 
      // We use the search query 'incident' to get relevant results if no specific search is active.
      const res = await fetch(`${apiBase}/api/incidents/similar?q=incident&k=20&state=New`);
      const data = await res.json();
      
      const res2 = await fetch(`${apiBase}/api/incidents/similar?q=incident&k=20&state=In Progress`);
      const data2 = await res2.json();

      const combined = [...(data.incidents || []), ...(data2.incidents || [])];
      
      // Deduplicate by number
      const seen = new Set();
      const unique = combined.filter(inc => {
        const num = inc.metadata?.number || inc.id;
        if (seen.has(num)) return false;
        seen.add(num);
        return true;
      });

      setIncidents(unique);
    } catch (err) {
      console.error("Failed to fetch SLA data", err);
    }
    setLoading(false);
  }, [apiBase]);

  useEffect(() => {
    fetchPendingIncidents();
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 30000); // UI refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPendingIncidents]);

  const calculateSla = (createdAt, priority) => {
    if (!createdAt || !priority) return null;
    const start = new Date(createdAt);
    const now = new Date();
    const elapsedMs = now - start;
    const targetHours = slaTargets[priority]?.hours || 24;
    const targetMs = targetHours * 60 * 60 * 1000;
    const remainingMs = targetMs - elapsedMs;
    const pctUsed = (elapsedMs / targetMs) * 100;

    let status = 'on-track';
    if (remainingMs < 0) status = 'breached';
    else if (pctUsed > 80) status = 'critical';
    else if (pctUsed > 50) status = 'warning';

    return {
      elapsedMs,
      remainingMs,
      pctUsed: Math.min(100, pctUsed),
      status,
      targetHours
    };
  };

  const formatDuration = (ms) => {
    const absMs = Math.abs(ms);
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const mins = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m${ms < 0 ? ' ago' : ''}`;
  };

  const filteredIncidents = incidents.map(inc => ({
    ...inc,
    sla: calculateSla(inc.metadata?.timestamp, inc.metadata?.priority || 'P4')
  })).filter(inc => {
    if (filter === 'breached') return inc.sla?.status === 'breached';
    if (filter === 'long-pending') return (inc.sla?.elapsedMs / (1000 * 60 * 60)) > 2;
    return true;
  }).sort((a, b) => (b.sla?.pctUsed || 0) - (a.sla?.pctUsed || 0));

  const stats = {
    total: incidents.length,
    breached: incidents.filter(i => calculateSla(i.metadata?.timestamp, i.metadata?.priority)?.status === 'breached').length,
    critical: incidents.filter(i => calculateSla(i.metadata?.timestamp, i.metadata?.priority)?.status === 'critical').length,
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Pending", value: stats.total, color: "#6366f1", icon: "📋" },
          { label: "SLA Breached", value: stats.breached, color: "#ef4444", icon: "🚨" },
          { label: "Critical (>80%)", value: stats.critical, color: "#f59e0b", icon: "⚠️" },
        ].map(s => (
          <div key={s.label} style={{ 
            padding: 16, borderRadius: 12, 
            background: darkMode ? "#1a1b2e" : "#ffffff", 
            border: `1.5px solid ${darkMode ? "#3a3b5c" : "#e2e8f0"}`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>{s.label}</span>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "all", label: "All Pending" },
          { id: "breached", label: "Breached" },
          { id: "long-pending", label: "Pending > 2h" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={styles.chip(filter === f.id)}>
            {f.label}
          </button>
        ))}
        <button onClick={fetchPendingIncidents} disabled={loading} style={{ ...styles.chip(false), marginLeft: "auto" }}>
          {loading ? "⏳" : "🔄 Refresh"}
        </button>
      </div>

      {/* Incident List */}
      <div style={{ display: "grid", gap: 10 }}>
        {filteredIncidents.length > 0 ? (
          filteredIncidents.map(inc => {
            const statusColor = inc.sla?.status === 'breached' ? '#ef4444' : 
                               inc.sla?.status === 'critical' ? '#f59e0b' : 
                               inc.sla?.status === 'warning' ? '#3b82f6' : '#10b981';
            
            return (
              <div key={inc.id} style={{
                padding: 16, borderRadius: 12,
                background: darkMode ? "#1a1b2e" : "#ffffff",
                border: `1px solid ${darkMode ? "#3a3b5c" : "#e2e8f0"}`,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#6366f1" }}>{inc.metadata?.number}</span>
                      <span style={{ ...styles.badge(inc.metadata?.priority === 'P1' ? 'red' : 'orange'), fontSize: 10 }}>{inc.metadata?.priority}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>• {inc.metadata?.state}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? "#e5e7eb" : "#1f2937" }}>
                      {inc.metadata?.description}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: statusColor }}>
                      {inc.sla?.remainingMs < 0 ? "-" : ""}{formatDuration(inc.sla?.remainingMs)}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>TIME REMAINING</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: 6, background: darkMode ? "#2d2e4a" : "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ 
                    width: `${inc.sla?.pctUsed}%`, 
                    height: "100%", 
                    background: statusColor,
                    transition: "width 1s ease-in-out"
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>
                  <span>Elapsed: {formatDuration(inc.sla?.elapsedMs)}</span>
                  <span>Target: {inc.sla?.targetHours}h</span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", background: darkMode ? "#1a1b2e" : "#f9fafb", borderRadius: 12, border: "1.5px dashed #3a3b5c" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 700 }}>No pending incidents found for this filter.</div>
            <div style={{ fontSize: 12 }}>Great job! All SLAs are on track or resolved.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlaMonitor;
