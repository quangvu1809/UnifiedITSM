import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue();
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// Mock localStorage
const localStorageStore = {};
const mockLocalStorage = {
  getItem: vi.fn((key) => localStorageStore[key] ?? null),
  setItem: vi.fn((key, value) => { localStorageStore[key] = String(value); }),
  removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
};
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

beforeEach(() => {
  mockFetch.mockReset();
  mockWriteText.mockClear();
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  document.body.removeAttribute("data-theme");
});

// ============================================
// 1. RENDERING & NAVIGATION
// ============================================
describe("App Rendering", () => {
  it("renders header and title", () => {
    render(<App />);
    expect(screen.getByText("IT Incident Assistant")).toBeInTheDocument();
    expect(screen.getByText(/AI-powered incident management/)).toBeInTheDocument();
  });

  it("renders all 5 module tabs", () => {
    render(<App />);
    expect(screen.getByText("Triage")).toBeInTheDocument();
    expect(screen.getByText("Root Cause")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
    expect(screen.getByText("Escalation")).toBeInTheDocument();
    expect(screen.getByText("SLA Timer")).toBeInTheDocument();
  });

  it("shows Triage form by default", () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/Server production/)).toBeInTheDocument();
    expect(screen.getByText(/Mô tả Incident/)).toBeInTheDocument();
  });

  it("switches tabs when clicked", () => {
    render(<App />);

    fireEvent.click(screen.getByText("Root Cause"));
    expect(screen.getByPlaceholderText(/App không connect/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Resolution"));
    expect(screen.getByText(/Actions đã thực hiện/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Escalation"));
    expect(screen.getByPlaceholderText("INC0012345")).toBeInTheDocument();

    fireEvent.click(screen.getByText("SLA Timer"));
    expect(screen.getByText(/Priority Level/)).toBeInTheDocument();
  });

  it("renders stats bar with token count and latency", () => {
    render(<App />);
    expect(screen.getByText(/Tokens: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Latency: 0ms/)).toBeInTheDocument();
  });
});

// ============================================
// 2. TRIAGE MODULE
// ============================================
describe("Triage Module", () => {
  it("shows error when description is empty", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText("Vui lòng nhập mô tả incident")).toBeInTheDocument();
  });

  it("loads sample data when sample button is clicked", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    const textarea = screen.getByPlaceholderText(/Server production/);
    expect(textarea.value).toContain("Production server không response");
  });

  it("calls API on valid triage submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: '```json\n{"priority":"P1","priority_reason":"test","category":"Application","impact_assessment":{"users_affected":"500","business_impact":"Critical"},"recommended_actions":["action1"],"suggested_team":"DevOps","confidence":0.9}\n```' }],
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText("P1")).toBeInTheDocument();
    });
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText(/DevOps/)).toBeInTheDocument();
  });

  it("displays API error message properly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ type: "error", error: { message: "invalid x-api-key" } }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText(/API Error: invalid x-api-key/)).toBeInTheDocument();
    });
  });

  it("detects sensitive data and warns on cloud provider", () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/Server production/);
    fireEvent.change(textarea, { target: { value: "User SSN is 123-45-6789 server issue" } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/dữ liệu nhạy cảm/)).toBeInTheDocument();
  });

  it("loads all 3 triage samples correctly", () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/Server production/);

    fireEvent.click(screen.getByText(/Production Down/));
    expect(textarea.value).toContain("Production server");

    fireEvent.click(screen.getByText(/Performance/));
    expect(textarea.value).toContain("Website load");

    fireEvent.click(screen.getByText(/Integration/));
    expect(textarea.value).toContain("API sync SAP");
  });
});

// ============================================
// 3. RCA MODULE
// ============================================
describe("RCA Module", () => {
  it("shows error when symptoms are empty", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Root Cause"));
    fireEvent.click(screen.getByText(/Find Root Cause/));
    expect(screen.getByText("Vui lòng nhập triệu chứng")).toBeInTheDocument();
  });

  it("loads RCA sample data", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Root Cause"));
    fireEvent.click(screen.getByText(/DB Connection/));
    expect(screen.getByPlaceholderText(/App không connect/).value).toContain("App không connect");
  });

  it("calls API with symptoms and shows text result", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: "## ROOT CAUSE ANALYSIS\n\n**Most Likely Root Cause:** Connection pool exhaustion." }],
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText("Root Cause"));
    fireEvent.click(screen.getByText(/DB Connection/));
    fireEvent.click(screen.getByText(/Find Root Cause/));

    await waitFor(() => {
      expect(screen.getByText(/ROOT CAUSE ANALYSIS/)).toBeInTheDocument();
    });
  });
});

// ============================================
// 4. RESOLUTION MODULE
// ============================================
describe("Resolution Module", () => {
  it("shows error when actions are empty", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Resolution"));
    fireEvent.click(screen.getByText(/Generate Summary/));
    expect(screen.getByText("Vui lòng nhập các actions đã thực hiện")).toBeInTheDocument();
  });

  it("allows selecting outcome options", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Resolution"));
    fireEvent.click(screen.getByText("Workaround"));
    expect(screen.getByText("Workaround")).toBeInTheDocument();
  });

  it("shows Export PDF button only on resolution results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: "## RESOLUTION SUMMARY\n\n**Issue:** DB connection\n**Resolution:** Restarted pool" }],
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText("Resolution"));
    const textarea = screen.getByPlaceholderText(/Restarted connection/);
    fireEvent.change(textarea, { target: { value: "Restarted the connection pool and verified connectivity" } });
    fireEvent.click(screen.getByText(/Generate Summary/));

    await waitFor(() => {
      expect(screen.getByText(/Export PDF/)).toBeInTheDocument();
    });
  });
});

// ============================================
// 5. ESCALATION MODULE
// ============================================
describe("Escalation Module", () => {
  it("shows error when summary is empty", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Escalation"));
    fireEvent.click(screen.getByText(/Draft Email/));
    expect(screen.getByText("Vui lòng nhập thông tin incident")).toBeInTheDocument();
  });

  it("renders team selector with all options", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Escalation"));
    const select = screen.getByDisplayValue("L2 Support");
    expect(select).toBeInTheDocument();
    expect(select.options).toHaveLength(7);
  });

  it("renders urgency options", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Escalation"));
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });
});

// ============================================
// 6. SLA TIMER MODULE
// ============================================
describe("SLA Timer Module", () => {
  it("renders priority selection buttons", () => {
    render(<App />);
    fireEvent.click(screen.getByText("SLA Timer"));
    expect(screen.getByText(/P1 - Critical/)).toBeInTheDocument();
    expect(screen.getByText(/P2 - High/)).toBeInTheDocument();
    expect(screen.getByText(/P3 - Medium/)).toBeInTheDocument();
    expect(screen.getByText(/P4 - Low/)).toBeInTheDocument();
  });

  it("shows error when start time is not set", () => {
    render(<App />);
    fireEvent.click(screen.getByText("SLA Timer"));
    fireEvent.click(screen.getByText(/Start Timer/));
    expect(screen.getByText(/Vui lòng chọn thời gian/)).toBeInTheDocument();
  });

  it("starts countdown timer when start time is set", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByText("SLA Timer"));

      const now = new Date();
      const timeInput = document.querySelector('input[type="datetime-local"]');
      fireEvent.change(timeInput, { target: { value: now.toISOString().slice(0, 16) } });
      fireEvent.click(screen.getByText(/Start Timer/));

      expect(screen.getByText(/P1 SLA Countdown/)).toBeInTheDocument();
      expect(screen.getByText(/Stop/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops timer when Stop button is clicked", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByText("SLA Timer"));

      const now = new Date();
      const timeInput = document.querySelector('input[type="datetime-local"]');
      fireEvent.change(timeInput, { target: { value: now.toISOString().slice(0, 16) } });
      fireEvent.click(screen.getByText(/Start Timer/));

      expect(screen.getByText(/Stop/)).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Stop/));
      expect(screen.queryByText(/SLA Countdown/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows SLA BREACHED when time is past", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByText("SLA Timer"));

      const pastTime = new Date(Date.now() - 2 * 3600000);
      const timeInput = document.querySelector('input[type="datetime-local"]');
      fireEvent.change(timeInput, { target: { value: pastTime.toISOString().slice(0, 16) } });
      fireEvent.click(screen.getByText(/Start Timer/));

      expect(screen.getByText(/SLA BREACHED/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ============================================
// 7. DARK MODE
// ============================================
describe("Dark Mode", () => {
  it("renders dark mode toggle button", () => {
    render(<App />);
    expect(screen.getByText(/Dark/)).toBeInTheDocument();
  });

  it("toggles dark mode on click", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Dark/));
    expect(document.body.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByText(/Light/)).toBeInTheDocument();
  });

  it("toggles back to light mode", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Dark/));
    expect(screen.getByText(/Light/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Light/));
    expect(document.body.getAttribute("data-theme")).toBe("light");
    expect(screen.getByText(/Dark/)).toBeInTheDocument();
  });

  it("persists dark mode preference in localStorage", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Dark/));
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("darkMode", "true");
  });

  it("restores dark mode from localStorage", () => {
    localStorageStore["darkMode"] = "true";
    render(<App />);
    expect(document.body.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByText(/Light/)).toBeInTheDocument();
  });
});

// ============================================
// 8. OLLAMA / PROVIDER TOGGLE
// ============================================
describe("Provider Toggle (Ollama)", () => {
  it("shows Cloud provider by default", () => {
    render(<App />);
    expect(screen.getByText(/Cloud/)).toBeInTheDocument();
  });

  it("toggles to Ollama Local on click", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Cloud/));
    expect(screen.getByText(/Ollama Local/)).toBeInTheDocument();
  });

  it("shows Ollama unavailable error when Ollama is not running", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    render(<App />);
    fireEvent.click(screen.getByText(/Cloud/)); // switch to local
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText(/Ollama không khả dụng/)).toBeInTheDocument();
    });
  });

  it("routes to Ollama when provider is local and Ollama is available", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true }); // checkOllama
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        message: { content: '```json\n{"priority":"P2","priority_reason":"perf","category":"Performance","impact_assessment":{"users_affected":"200","business_impact":"High"},"recommended_actions":["check CPU"],"suggested_team":"SRE","confidence":0.8}\n```' },
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Cloud/)); // switch to local
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText("P2")).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.anything()
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.anything()
    );
  });
});

// ============================================
// 9. MODERATION
// ============================================
describe("Input Moderation", () => {
  it("toggles moderation on/off", () => {
    render(<App />);
    expect(screen.getByText(/Moderation ON/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Moderation ON/));
    expect(screen.getByText(/Moderation OFF/)).toBeInTheDocument();
  });

  it("blocks SSN patterns", () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/Server production/);
    fireEvent.change(textarea, { target: { value: "User with SSN 123-45-6789 cannot login" } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/dữ liệu nhạy cảm/)).toBeInTheDocument();
  });

  it("blocks password patterns", () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText(/Server production/);
    fireEvent.change(textarea, { target: { value: "Server error password= admin123 detected" } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/dữ liệu nhạy cảm/)).toBeInTheDocument();
  });

  it("allows clean input through moderation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "Analysis complete" }] }),
    });

    render(<App />);
    const textarea = screen.getByPlaceholderText(/Server production/);
    fireEvent.change(textarea, { target: { value: "Database connection pool is exhausted on production server" } });
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.queryByText(/dữ liệu nhạy cảm/)).not.toBeInTheDocument();
  });
});

// ============================================
// 10. SIMILAR PAST INCIDENTS
// ============================================
describe("Similar Past Incidents", () => {
  it("saves triage result to localStorage history", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: '```json\n{"priority":"P1","priority_reason":"critical","category":"Database","impact_assessment":{"users_affected":"500","business_impact":"Critical"},"recommended_actions":["restart"],"suggested_team":"DBA","confidence":0.95}\n```' }],
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText("P1")).toBeInTheDocument();
    });
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith("incident_history", expect.any(String));
    const saved = JSON.parse(mockLocalStorage.setItem.mock.calls.find(c => c[0] === "incident_history")[1]);
    expect(saved.length).toBe(1);
    expect(saved[0].description).toContain("Production server");
  });

  it("shows similar incidents when history exists", async () => {
    const history = [
      { description: "Production server không response từ 14:30", impact: "500 users", result: { priority: "P1" }, timestamp: Date.now() - 86400000 },
    ];
    localStorageStore["incident_history"] = JSON.stringify(history);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: '```json\n{"priority":"P1","priority_reason":"test","category":"Database","impact_assessment":{"users_affected":"500","business_impact":"Critical"},"recommended_actions":["restart"],"suggested_team":"DBA","confidence":0.9}\n```' }],
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText("P1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Incident tương tự trước đây/)).toBeInTheDocument();
    });
  });

  it("clears similar incidents when switching tabs", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Root Cause"));
    expect(screen.queryByText(/Incident tương tự/)).not.toBeInTheDocument();
  });
});

// ============================================
// 11. COPY & RESET
// ============================================
describe("Copy & Reset", () => {
  it("copies result to clipboard", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "## Test Result\nSome analysis" }] }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText(/Copy/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Copy/));
    expect(mockWriteText).toHaveBeenCalled();
  });

  it("resets form fields when Reset is clicked", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    expect(screen.getByPlaceholderText(/Server production/).value).not.toBe("");

    fireEvent.click(screen.getByText(/Reset/));
    expect(screen.getByPlaceholderText(/Server production/).value).toBe("");
  });
});

// ============================================
// 12. API ERROR HANDLING
// ============================================
describe("API Error Handling", () => {
  it("shows error on network failure (cloud)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText(/Lỗi kết nối API/)).toBeInTheDocument();
    });
  });

  it("shows specific error on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        type: "error",
        error: { type: "authentication_error", message: "invalid x-api-key" },
      }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText(/API Error: invalid x-api-key/)).toBeInTheDocument();
    });
  });

  it("shows error on empty API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    });

    render(<App />);
    fireEvent.click(screen.getByText(/Production Down/));
    fireEvent.click(screen.getByText(/Analyze/));

    await waitFor(() => {
      expect(screen.getByText(/response rỗng/)).toBeInTheDocument();
    });
  });

  it("clears error when switching tabs", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/Analyze/));
    expect(screen.getByText(/Vui lòng nhập/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Root Cause"));
    expect(screen.queryByText(/Vui lòng nhập mô tả/)).not.toBeInTheDocument();
  });
});
