import os
from dotenv import load_dotenv
from embeddings.service import seed_sample_incidents, seed_kb_articles

# Load environment variables from .env
load_dotenv()

def main():
    print("--- 🚀 BD ĐẦU NẠP DỮ LIỆU MẪU ---")
    
    try:
        print("\n1. Đang nạp Incidents mẫu...")
        inc_count = seed_sample_incidents()
        print(f"✅ Đã nạp {inc_count} incidents thành công.")
        
        print("\n2. Đang nạp Knowledge Base articles...")
        kb_count = seed_kb_articles()
        print(f"✅ Đã nạp {kb_count} bài viết thành công.")
        
        print("\n--- ✨ HOÀN TẤT NẠP DỮ LIỆU ---")
        print(f"Tổng cộng: {inc_count + kb_count} items đã được đưa vào Pinecone.")
        
    except Exception as e:
        print(f"❌ Có lỗi xảy ra: {str(e)}")

if __name__ == "__main__":
    main()
