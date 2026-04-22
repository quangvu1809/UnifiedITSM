# 🏛️ UnifiedITSM - AI-Integrated Incident Management Platform

### 🚀 Developed by **GreenAI Team**

[English] | [Tiếng Việt](README_VN.md)

**UnifiedITSM** is a next-generation IT Service Management (ITSM) platform that leverages **Agentic AI** and **Retrieval-Augmented Generation (RAG)** to automate the incident lifecycle, from initial triage to deep root cause analysis and resolution.

---

## 🌟 Key Features

*   **Agentic AI Assistant:** A 24/7 intelligent assistant capable of reasoning, searching the knowledge base (RAG), and performing automated tasks via natural language.
*   **Smart Triage:** Automated incident classification and priority assignment based on ITIL standards.
*   **Deep Root Cause Analysis (RCA):** AI-driven analysis of logs and symptoms to identify core issues and suggest optimal fixes.
*   **Intelligent Escalation:** Automatic drafting of professional escalation emails based on incident history.
*   **Knowledge Learning Loop:** Seamlessly saves resolved incidents back into the vector database to improve future RAG cycles.
*   **Executive Dashboard:** Real-time visualization of system health, MTTR trends, and SLA compliance.

---

## 🛠️ Technology Stack & Rationale

We selected a "Best-of-Breed" stack to solve the specific performance and intelligence challenges of modern ITSM.

| Technology | Strength | Why we chose it? |
| :--- | :--- | :--- |
| **GPT-4o** | State-of-the-art reasoning & analysis. | Used as the "Core Brain" to analyze complex logs, perform RCA, and generate human-like professional responses. |
| **LangGraph** | Stateful & Cyclic AI Agent orchestration. | Unlike linear chains, LangGraph allows the AI to self-correct, loop back, and reason through multi-step ITSM workflows. |
| **FastAPI** | High-performance Asynchronous Python. | Critical for handling concurrent AI inference tasks without blocking the system, ensuring a responsive user experience. |
| **Pinecone** | Serverless Vector DB with semantic search. | Solves the "Keyword Search" limitation. It finds relevant knowledge based on **meaning**, ensuring RAG accuracy. |
| **React 18** | Concurrent rendering & Virtual DOM. | Provides a smooth, premium SPA experience for managing high-volume real-time incident data. |
| **HuggingFace** | Localized NLP & Voice AI models. | Running embeddings (`all-MiniLM-L6-v2`) locally reduces latency and costs while ensuring better data privacy. |

---

## 💡 How it Solves ITSM Problems

1.  **Reducing MTTR (Mean Time To Repair):** By automating RAG-based knowledge retrieval and log analysis, we reduce incident investigation time by over 50%.
2.  **Eliminating Triage Bottlenecks:** AI-driven classification removes the manual effort of Service Desk agents, ensuring tickets reach the right team instantly.
3.  **Digitizing Expertise:** The learning loop ensures that specialized knowledge from senior engineers is captured in Pinecone and reused by the AI assistant.
4.  **24/7 Autonomous Support:** Users get instant help for L1/L2 issues without waiting for human technicians, increasing overall service availability.

---

## 🚥 Getting Started

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Configure your .env file (PINECONE_API_KEY, OPENAI_API_KEY, etc.)
python main.py
```

### 2. Frontend Setup
```bash
# In the root directory
npm install
npm run dev
```

### 3. Seed Sample Data
Go to the **Dashboard** and use the **Seed Data** feature to populate your Pinecone instance with sample incidents and knowledge base entries.

---

**UnifiedITSM** - Researched and developed by **GreenAI Team**

*"Redefining IT Service Management through Intelligence"*
