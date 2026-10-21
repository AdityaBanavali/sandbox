"""
API v1 main router aggregation.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import health, flows, alerts, mitre, audit, rules, ws, dashboard

api_v1_router = APIRouter()

api_v1_router.include_router(health.router, prefix="/health", tags=["Health & Readiness"])
api_v1_router.include_router(flows.router, prefix="/flows", tags=["Unidirectional Flows"])
api_v1_router.include_router(alerts.router, prefix="/alerts", tags=["Threat Alerts"])
api_v1_router.include_router(rules.router, prefix="/rules", tags=["Sigma Custom Detection Rules"])
api_v1_router.include_router(mitre.router, prefix="/mitre", tags=["MITRE ATT&CK Mappings"])
api_v1_router.include_router(audit.router, prefix="/audit", tags=["Tamper-Evident Audit Ledger"])
api_v1_router.include_router(ws.router, prefix="/ws", tags=["Real-Time WebSockets"])
api_v1_router.include_router(dashboard.router, tags=["Administrative Analysis & Tasks Dashboard"])

