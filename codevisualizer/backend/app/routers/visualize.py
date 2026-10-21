from fastapi import APIRouter, HTTPException
from typing import List
from ..schemas import VisualizeRequest, VisualizeResponse, SampleSnippet
from ..services.llm_service import LLMService
from ..samples import SAMPLE_SNIPPETS

router = APIRouter(prefix="/api", tags=["visualize"])

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "CodeVisualizer Backend API"}

@router.get("/samples", response_model=List[SampleSnippet])
def get_samples():
    return SAMPLE_SNIPPETS

@router.post("/visualize", response_model=VisualizeResponse)
async def visualize_code(request: VisualizeRequest):
    if not request.code or not request.code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty")
    
    try:
        response = await LLMService.visualize(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to visualize code: {str(e)}")
