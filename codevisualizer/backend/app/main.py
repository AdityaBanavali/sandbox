import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .routers.visualize import router as visualize_router

load_dotenv()

app = FastAPI(
    title="CodeVisualizer API",
    description="AI-powered code architecture and logic flow graph generator",
    version="1.0.0"
)

# Allow requests from frontend dev and preview servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(visualize_router)

@app.get("/")
def root():
    return {
        "name": "CodeVisualizer API",
        "status": "online",
        "docs": "/docs"
    }
