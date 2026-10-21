from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class NodeData(BaseModel):
    label: str = Field(..., description="Display title for the node")
    category: str = Field(
        default="function",
        description="Type category: api, service, function, db, decision, middleware, component"
    )
    description: Optional[str] = Field(None, description="Brief explanation of what this component does")
    snippet: Optional[str] = Field(None, description="Relevant source code snippet or definition")
    badge: Optional[str] = Field(None, description="Short tag or HTTP method e.g. GET, POST, ASYNC, SQL, IF")
    tags: List[str] = Field(default_factory=list, description="Descriptive tags for filtering")
    params: List[str] = Field(default_factory=list, description="Inputs or parameter names")
    returns: Optional[str] = Field(None, description="Return type or output")

class NodePosition(BaseModel):
    x: float = 0.0
    y: float = 0.0

class GraphNode(BaseModel):
    id: str
    type: str = Field(default="functionNode", description="Node component: apiNode, serviceNode, functionNode, dbNode, decisionNode")
    position: NodePosition = Field(default_factory=NodePosition)
    data: NodeData

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    animated: bool = True
    type: str = "smoothstep"
    style: Optional[Dict[str, Any]] = None

class VisualizeStats(BaseModel):
    components: int = 0
    connections: int = 0
    complexity: str = "Low"
    language: str = "python"

class VisualizeRequest(BaseModel):
    code: str
    language: str = "python"
    mode: str = "architecture"  # "architecture" | "control_flow" | "data_flow"
    api_key: Optional[str] = None
    provider: Optional[str] = "gemini"  # "gemini" | "openai" | "fallback"

class VisualizeResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    summary: str
    stats: VisualizeStats
    provider_used: str

class SampleSnippet(BaseModel):
    id: str
    title: str
    language: str
    category: str
    description: str
    code: str
