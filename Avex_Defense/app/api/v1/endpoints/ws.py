"""
WebSocket Router for Real-Time Threat Alerts and Dashboard Streaming.
"""

import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.core.websocket import ws_manager

router = APIRouter()


class WebSocketStatusResponse(BaseModel):
    active_connections: int
    subscribed_clients: List[Dict[str, Any]]


@router.get("/status", response_model=WebSocketStatusResponse, summary="Retrieve WebSocket Gateway Status")
async def get_ws_status():
    """
    Returns the count of active WebSocket dashboard connections and active subscription filters.
    """
    clients_info = [
        {
            "client_id": sub.client_id,
            "min_severity": sub.min_severity,
            "tactics": sub.tactics,
            "behavior_classes": sub.behavior_classes,
        }
        for sub in ws_manager.active_clients.values()
    ]
    return WebSocketStatusResponse(
        active_connections=ws_manager.client_count,
        subscribed_clients=clients_info,
    )


@router.websocket("/alerts")
async def websocket_alerts_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None, description="Optional unique identifier for this dashboard client"),
    min_severity: Optional[str] = Query(None, description="Filter: LOW, MEDIUM, HIGH, CRITICAL"),
    tactic: Optional[str] = Query(None, description="Filter by MITRE tactic (e.g. Discovery, Command and Control)"),
    behavior_class: Optional[str] = Query(None, description="Filter by threat behavior label"),
):
    """
    Bidirectional WebSocket gateway for receiving instantaneous threat alert pushes.
    Dashboard clients can subscribe with optional severity and MITRE tactic filters,
    and dynamically reconfigure filters or ping/pong during the connection.
    """
    cid = client_id or f"client-{uuid.uuid4().hex[:8]}"
    tactics_list = [tactic] if tactic else None
    behaviors_list = [behavior_class] if behavior_class else None

    sub = await ws_manager.connect(
        websocket=websocket,
        client_id=cid,
        min_severity=min_severity,
        tactics=tactics_list,
        behavior_classes=behaviors_list,
    )

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
                action = str(msg.get("action", "")).lower()

                if action == "ping":
                    await ws_manager.send_json(
                        websocket,
                        {"event": "PONG", "timestamp": msg.get("timestamp")},
                    )

                elif action in ("set_filter", "update_filter"):
                    new_min_sev = msg.get("min_severity")
                    new_tactics = msg.get("tactics")
                    new_behaviors = msg.get("behavior_classes")
                    await ws_manager.update_filter(
                        client_id=cid,
                        min_severity=new_min_sev,
                        tactics=new_tactics,
                        behavior_classes=new_behaviors,
                    )

                elif action == "status":
                    await ws_manager.send_json(
                        websocket,
                        {
                            "event": "CLIENT_STATUS",
                            "client_id": cid,
                            "min_severity": sub.min_severity,
                            "tactics": sub.tactics,
                            "behavior_classes": sub.behavior_classes,
                        },
                    )

                else:
                    await ws_manager.send_json(
                        websocket,
                        {"event": "ECHO", "message": msg},
                    )

            except json.JSONDecodeError:
                if raw_data.strip() == "ping":
                    await ws_manager.send_json(websocket, {"event": "PONG"})
                else:
                    await ws_manager.send_json(
                        websocket,
                        {"event": "ERROR", "detail": "Invalid JSON frame received"},
                    )

    except WebSocketDisconnect:
        await ws_manager.disconnect(cid)
    except Exception:
        await ws_manager.disconnect(cid)
