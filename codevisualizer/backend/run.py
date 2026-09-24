import uvicorn
import sys
import os

if __name__ == "__main__":
    # Ensure backend directory is in sys.path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, backend_dir)
    
    port = int(os.getenv("PORT", 8000))
    print(f"Starting CodeVisualizer FastAPI backend on http://127.0.0.1:{port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
