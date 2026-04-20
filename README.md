# Hệ Thống Quản Lý Dịch Vụ IT (ITSM) Tích Hợp AI (UnifiedITSM)

Một nền tảng quản lý sự cố IT (Incident Management) toàn diện, kết hợp giữa quy trình xử lý chuẩn ITIL và Trợ lý AI (AI Chat Assistant) thông minh. 

Dự án này mang lại một giải pháp thống nhất với trải nghiệm người dùng tương tự **ServiceNow**, được tối ưu hóa cho tốc độ xử lý và khả năng tự học từ dữ liệu.

---

## 🚀 Các Tính Năng Chính

### 🤖 Trợ Lý Dịch Vụ AI (AI Assistant)
- **Cơ sở kiến thức RAG**: Tìm kiếm ngữ nghĩa trên hơn 15 bài viết hướng dẫn kỹ thuật và hàng ngàn Incident cũ thông qua Pinecone.
- **Tư duy Agentic**: Sử dụng LangGraph để xây dựng ReAct agent, cho phép Chatbot tự quyết định khi nào cần tìm kiếm KB hoặc khi nào cần tra cứu trạng thái Ticket.
- **Hỗ trợ đa ngôn ngữ & Voice (TTS)**: Tùy chuyển linh hoạt giữa Tiếng Anh và Tiếng Việt. Chatbot có khả năng phản hồi bằng giọng nói cực kỳ tự nhiên.

### 🎫 Quản Lý Sự Cố (Incident Management)
- **Giao diện ServiceNow-style**: Form xử lý Incident mượt mà với đầy đủ các trường nghiệp vụ: `Caller`, `Category`, `Subcategory`, `Priority`, và `State`.
- **Phân loại AI (Smart Triage)**: Tự động phân loại Category và đánh giá mức độ Priority dựa trên mô tả lỗi của người dùng.
- **Tự học từ thực tế**: Khi Resolve một sự cố, hệ thống cho phép "Save to Knowledge Base", biến kinh nghiệm xử lý lỗi thành tài sản tri thức cho tương lai.

### 📧 Quy Trình Leo Thang Tự Động (AI Escalation Workflow)
- **Email Drafting**: Chỉ cần nhập số INC, AI sẽ tự động truy xuất toàn bộ lịch sử xử lý (Timeline) để soạn một bản thảo email leo thang chuyên nghiệp (có To, CC, Subject).
- **1-Click Send**: Tích hợp nút gửi mail nhanh, tự động mở ứng dụng thư điện tử (Outlook, Apple Mail) với nội dung đã được điền sẵn 100%.

### 📊 Dashboard Giám Sát & SLA
- **Real-time Monitoring**: Theo dõi danh sách sự cố với trạng thái cập nhật mới nhất (Latest Status) và mã màu thông minh.
- **Phân tích Dashboard**: Biểu đồ Breakdown theo Category và Priority, giúp nhà quản lý nắm bắt nhanh các điểm nóng kỹ thuật.
- **SLA Tracker**: Đếm ngược thời gian xử lý dựa trên mức độ nghiêm trọng (P1-P4) của từng Incident.

---

## 🛠️ Công Nghệ Sử Dụng

| Thành phần | Công nghệ | Chi tiết |
|-----------|------------|--------|
| **Frontend** | React 18 + Vite | Giao diện hiện đại, Dark Mode, mượt mà |
| **Backend** | Python 3.12 + FastAPI | Xử lý Agentic Workflow, RAG, API module |
| **Vector DB** | Pinecone | Lưu trữ tri thức và lịch sử sự cố dưới dạng vector |
| **Học máy AI** | HuggingFace + LangChain | Embeddings model: `all-MiniLM-L6-v2` |
| **Tích hợp** | Mailto Protocol | Kết nối trực tiếp với Desktop Email Clients |

---

## 🚥 Hướng Dẫn Cài Đặt

1. **Cài đặt Backend**:
   - `cd backend`
   - `pip install -r requirements.txt`
   - Cấu hình `.env` với các Key: `PINECONE_API_KEY`, `HF_API_TOKEN`, ...
   - Chạy `python main.py`

2. **Cài đặt Frontend**:
   - `npm install`
   - `npm run dev`

3. **Khởi tạo dữ liệu**:
   - Sử dụng các nút **Seed Data** hoặc **Seed KB** ngay trên giao diện Dashboard để nạp dữ liệu mẫu nhanh chóng.

---
**UnifiedITSM** - Tầm nhìn mới cho quy trình IT Support thông minh.
