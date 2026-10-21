import os
import json
import httpx
from typing import Optional
from ..schemas import VisualizeRequest, VisualizeResponse, GraphNode, GraphEdge, NodeData, VisualizeStats
from .fallback_parser import FallbackParser

SYSTEM_PROMPT = """You are an expert software architect and static code analysis system.
Your job is to analyze the provided source code and translate its logic, architecture, and flow into an interactive node-and-edge diagram graph JSON.

Analyze the code according to the requested mode:
- If mode is 'architecture': identify services, modules, API endpoints, database models, controllers, and their high-level architectural interactions.
- If mode is 'control_flow': trace function execution, branching logic, conditional gates, exception handling, and sequential call flows.
- If mode is 'data_flow': trace data transformations, pipeline stages, state updates, payload structures, and persistence.

You MUST respond strictly with a valid JSON object adhering to this structure:
{
  "summary": "Clear, concise 2-3 sentence overview of what the code does and its architectural pattern.",
  "stats": {
    "components": <integer count of nodes>,
    "connections": <integer count of edges>,
    "complexity": "Low" | "Medium" | "High",
    "language": "<language name>"
  },
  "nodes": [
    {
      "id": "node_1",
      "type": "apiNode" | "serviceNode" | "functionNode" | "dbNode" | "decisionNode",
      "data": {
        "label": "Concise display title (e.g. POST /auth/login or generateToken)",
        "category": "api" | "service" | "function" | "db" | "decision" | "middleware",
        "description": "1 sentence explanation of role in the system",
        "snippet": "Short relevant 1-5 line code extract or signature",
        "badge": "Short badge tag (e.g. POST, GET, ASYNC, SQL, IF, JWT, REDIS)",
        "tags": ["Tag1", "Tag2"],
        "params": ["arg1", "arg2"],
        "returns": "return type or output"
      }
    }
  ],
  "edges": [
    {
      "id": "e_1_2",
      "source": "node_1",
      "target": "node_2",
      "label": "verb phrase describing interaction (e.g. 'validates', 'queries', 'invokes', 'returns to')",
      "animated": true,
      "type": "smoothstep"
    }
  ]
}

Guidelines:
1. Choose node types carefully:
   - 'apiNode' for HTTP / RPC / REST endpoints or external APIs
   - 'serviceNode' for controllers, service classes, orchestration layers, modules
   - 'functionNode' for core business logic, utility functions, helpers
   - 'dbNode' for database queries, ORM models, caches, repositories
   - 'decisionNode' for if/else branching, validation checks, auth guards
2. Keep node IDs clean and sequential: node_1, node_2, ...
3. Ensure all edge 'source' and 'target' IDs correspond to defined nodes.
4. Edge labels should be clear and informative.
5. Provide meaningful code snippets in node data so users can inspect them.
"""

class LLMService:
    @classmethod
    async def visualize(cls, request: VisualizeRequest) -> VisualizeResponse:
        api_key = request.api_key or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        provider = (request.provider or "gemini").lower()

        # If explicit fallback requested or no API key available, use heuristic parser
        if provider == "fallback" or not api_key:
            return FallbackParser.parse(request.code, request.language, request.mode)

        try:
            if provider == "gemini" or (not request.provider and os.getenv("GEMINI_API_KEY")):
                return await cls._call_gemini(request, api_key)
            elif provider == "openai" or (not request.provider and os.getenv("OPENAI_API_KEY")):
                return await cls._call_openai(request, api_key)
            else:
                return FallbackParser.parse(request.code, request.language, request.mode)
        except Exception as e:
            # If LLM API fails or rate limits, gracefully fall back to local parser with note
            print(f"[LLMService Error] {str(e)}. Using fallback parser.")
            fallback = FallbackParser.parse(request.code, request.language, request.mode)
            fallback.summary = f"[AI Notice: {str(e)[:80]}...] Displaying AST/heuristic analysis: {fallback.summary}"
            return fallback

    @classmethod
    async def _call_gemini(cls, request: VisualizeRequest, api_key: str) -> VisualizeResponse:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
        user_prompt = f"""Language: {request.language}
Analysis Mode: {request.mode}

Source Code to Analyze:
```{request.language}
{request.code}
```
"""
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": SYSTEM_PROMPT + "\n\n" + user_prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            text_content = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(text_content)
            return cls._build_response(parsed_json, provider_used="gemini-2.0-flash")

    @classmethod
    async def _call_openai(cls, request: VisualizeRequest, api_key: str) -> VisualizeResponse:
        url = "https://api.openai.com/v1/chat/completions"
        user_prompt = f"""Language: {request.language}
Analysis Mode: {request.mode}

Source Code to Analyze:
```{request.language}
{request.code}
```
"""
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            text_content = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(text_content)
            return cls._build_response(parsed_json, provider_used="gpt-4o-mini")

    @classmethod
    def _build_response(cls, data: dict, provider_used: str) -> VisualizeResponse:
        nodes = []
        for n in data.get("nodes", []):
            node_data = NodeData(
                label=n.get("data", {}).get("label", n.get("id", "Node")),
                category=n.get("data", {}).get("category", "function"),
                description=n.get("data", {}).get("description"),
                snippet=n.get("data", {}).get("snippet"),
                badge=n.get("data", {}).get("badge"),
                tags=n.get("data", {}).get("tags", []),
                params=n.get("data", {}).get("params", []),
                returns=n.get("data", {}).get("returns")
            )
            nodes.append(GraphNode(
                id=n.get("id"),
                type=n.get("type", "functionNode"),
                data=node_data
            ))

        edges = []
        for idx, e in enumerate(data.get("edges", [])):
            edge_id = e.get("id", f"e_{e.get('source')}_{e.get('target')}_{idx}")
            edges.append(GraphEdge(
                id=edge_id,
                source=e.get("source"),
                target=e.get("target"),
                label=e.get("label"),
                animated=e.get("animated", True),
                type=e.get("type", "smoothstep")
            ))

        stats_dict = data.get("stats", {})
        stats = VisualizeStats(
            components=stats_dict.get("components", len(nodes)),
            connections=stats_dict.get("connections", len(edges)),
            complexity=stats_dict.get("complexity", "Medium"),
            language=stats_dict.get("language", "Unknown")
        )

        return VisualizeResponse(
            nodes=nodes,
            edges=edges,
            summary=data.get("summary", "Successfully visualized code flow."),
            stats=stats,
            provider_used=provider_used
        )
