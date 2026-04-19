# Hệ Thống Quản Lý Dịch Vụ IT (ITSM) Tích Hợp AI

Một nền tảng quản lý sự cố IT (Incident Management) toàn diện, kết hợp giữa quy trình xử lý tự động và Trợ lý AI (AI Chat Assistant) thông minh.

Dự án này là sự hợp nhất của hai dự án **ChatBot** (RAG & TTS) và **INCSystem** (Vòng đời sự cố), mang lại một giải pháp thống nhất với trải nghiệm người dùng tương tự **ServiceNow**.

## 🚀 Các Tính Năng Chính

### 🤖 Trợ Lý Dịch Vụ AI (AI Assistant)
- **Cơ sở kiến thức RAG**: Tìm kiếm ngữ nghĩa trên hơn 15 bài viết hướng dẫn kỹ thuật bằng Pinecone.
- **Tư duy Agentic**: Sử dụng LangGraph để xây dựng ReAct agent cho chatbot.
- **Hỗ trợ giọng nói (TTS)**: Chuyển đổi văn bản thành giọng nói (English & Vietnamese).

### 🎫 Quản Lý Sự Cố chuẩn ServiceNow (Incident Form)
- **Giao diện chuẩn hóa**: Form xử lý Incident với bố cục 2 cột, hỗ trợ đầy đủ các trường: `Number`, `Caller`, `Category`, `Subcategory`, `State`, `Priority`, và `Assignment Group`.
- **Gợi ý giải pháp AI (Smart Suggestion)**: Tự động tìm kiếm lịch sử và đề xuất giải pháp (Resolution) ngay trong form nếu phát hiện sự cố tương tự đã được xử lý trước đó.
- **Cơ chế Tự học (Learning Mechanism)**: Khi một sự cố được Resolve, người dùng có thể chọn "Save to Knowledge Base" để lưu giải pháp vào Vector DB. Hệ thống sẽ ngày càng thông minh hơn qua mỗi lần sử dụng.

### 🎯 Quy Trình Tự Động Hóa
- **Phân tích nguyên nhân (RCA)**: Phân tích sâu triệu chứng và logs để xác định nguyên nhân chính.
- **Tóm tắt giải pháp**: Tự động soạn thảo Resolution Note chuyên nghiệp.
- **SLA Timer**: Theo dõi thời gian xử lý dựa trên mức độ ưu tiên (P1-P4).

## 🛠️ Công Nghệ Sử Dụng

| Thành phần | Công nghệ | Chi tiết |
|-----------|------------|--------|
| **Frontend** | React 18 + Vite | Giao diện ServiceNow-style với Vanilla CSS |
| **Backend** | Python 3.12 + FastAPI | API dạng module, xử lý AI & Data |
| **Vector DB** | Pinecone | Lưu trữ sự cố (`incidents`) và bài viết (`kb-articles`) |
| **Học máy AI** | RAG + HuggingFace | Cơ chế gợi ý và học tập từ lịch sử xử lý |

## 📁 Cấu Trúc Dự Án

```
UnifiedITSM/
├── backend/                      # Backend Python FastAPI
│   ├── main.py                   # Điểm khởi chạy Server
│   ├── embeddings/               # Dịch vụ Pinecone & Embeddings (Logic học tập)
│   ├── rag/                      # Pipeline RAG & Đề xuất giải pháp
│   ├── routers/                  # API Endpoints (Chatbot, Incidents, Resolve, v.v.)
│   └── ...
├── src/                          # Frontend React
│   ├── components/               # ChatAssistant & UI Components
│   ├── App.jsx                   # ServiceNow Incident Form & Điều phối chính
│   └── index.css                 # Styling nâng cao
└── ...
```

## 🚥 Hướng Dẫn Cài Đặt

1. **Cài đặt Backend**:
   - `pip install -r requirements.txt`
   - Cấu hình `.env` với API keys.
   - Chạy `python main.py`.

2. **Cài đặt Frontend**:
   - `npm install`
   - `npm run dev`.

3. **Khởi tạo dữ liệu**:
   - `curl -X POST http://localhost:8000/api/incidents/seed`

---
Dự án được phát triển nhằm tối ưu hóa quy trình IT Support bằng sức mạnh của AI và RAG.
