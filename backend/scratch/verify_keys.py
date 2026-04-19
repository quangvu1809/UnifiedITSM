import os
from dotenv import load_dotenv
from openai import OpenAI
from pinecone import Pinecone
from huggingface_hub import HfApi

load_dotenv()

def verify():
    print("--- VERIFYING KEYS ---")
    
    # 1. OpenAI
    print("\n1. Checking OpenAI/STU Platform...")
    try:
        client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL")
        )
        # Try to list models as a simple health check
        models = client.models.list()
        print("✅ OpenAI/STU Platform: Connected successfully.")
    except Exception as e:
        print(f"❌ OpenAI/STU Platform: Error - {str(e)}")

    # 2. Pinecone
    print("\n2. Checking Pinecone...")
    try:
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        indexes = pc.list_indexes()
        index_names = [idx.name for idx in indexes]
        print(f"✅ Pinecone: Connected successfully. Indexes: {index_names}")
        
        target_index = os.getenv("PINECONE_INDEX_NAME")
        if target_index in index_names:
            desc = pc.describe_index(target_index)
            print(f"✅ Index '{target_index}' found. Dimension: {desc.dimension}, Metric: {desc.metric}")
            if desc.dimension != 384:
                print(f"⚠️ Warning: Index dimension is {desc.dimension}, but model 'all-MiniLM-L6-v2' requires 384.")
        else:
            print(f"❌ Index '{target_index}' NOT found. Please create it first.")
    except Exception as e:
        print(f"❌ Pinecone: Error - {str(e)}")

    # 3. HuggingFace
    print("\n3. Checking HuggingFace...")
    try:
        api = HfApi(token=os.getenv("HF_API_TOKEN"))
        user_info = api.whoami()
        print(f"✅ HuggingFace: Connected as '{user_info['name']}'.")
    except Exception as e:
        print(f"❌ HuggingFace: Error - {str(e)}")

if __name__ == "__main__":
    verify()
