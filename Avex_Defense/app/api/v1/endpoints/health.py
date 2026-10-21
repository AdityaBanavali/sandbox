"""
Health, readiness, and comprehensive system telemetry endpoints.
"""

import os
import time
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.redis import get_redis_client, THREAT_ALERTS_CHANNEL
from app.core.websocket import ws_manager
from app.models.flow import Flow
from app.models.alert import Alert
from app.models.audit import AuditLog
from app.models.mitre import MitreMapping
from app.rules.engine import rule_engine

router = APIRouter()

# Service start timestamp for uptime calculation
START_TIME = time.time()


@router.get("", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, str]:
    """
    Basic liveness probe.
    """
    return {"status": "ok", "service": "threat-detection-engine"}


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Readiness probe verifying PostgreSQL and Redis connections.
    """
    # Test Database
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {exc}"

    # Test Redis
    redis_status = "ok"
    try:
        client = await get_redis_client()
        ping_res = await client.ping()
        if not ping_res:
            redis_status = "unhealthy: ping returned false"
    except Exception as exc:
        redis_status = f"unhealthy: {exc}"

    is_ready = (db_status == "ok") and (redis_status == "ok")
    return {
        "ready": is_ready,
        "database": db_status,
        "redis": redis_status,
    }


@router.get("/metrics", status_code=status.HTTP_200_OK, summary="Retrieve comprehensive system health & engine metrics")
async def system_metrics(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Returns real-time operational telemetry for monitoring dashboards:
    - Host CPU, Memory, and Disk usage
    - PostgreSQL connection latency and database record counts
    - Redis connection latency, memory usage, and connected clients
    - Threat detection engine status (ML ensemble & Sigma rules count)
    - Active WebSocket client subscriptions
    - Process uptime
    """
    # 1. Host Resources via psutil (with fallback)
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=None)
        vm = psutil.virtual_memory()
        mem_info = {
            "total_mb": round(vm.total / (1024 * 1024), 1),
            "used_mb": round(vm.used / (1024 * 1024), 1),
            "percent": vm.percent,
        }
        du = psutil.disk_usage("/")
        disk_info = {
            "total_gb": round(du.total / (1024 * 1024 * 1024), 2),
            "used_gb": round(du.used / (1024 * 1024 * 1024), 2),
            "free_gb": round(du.free / (1024 * 1024 * 1024), 2),
            "percent": du.percent,
        }
    except Exception as exc:
        cpu_pct = 0.0
        mem_info = {"status": f"unavailable: {exc}"}
        disk_info = {"status": f"unavailable: {exc}"}

    # 2. Database Performance & Table Counts
    db_metrics: Dict[str, Any] = {"status": "ok"}
    try:
        t0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        db_metrics["latency_ms"] = db_latency_ms

        flows_count = (await db.execute(select(func.count(Flow.id)))).scalar_one()
        alerts_count = (await db.execute(select(func.count(Alert.id)))).scalar_one()
        audit_count = (await db.execute(select(func.count(AuditLog.id)))).scalar_one()
        mitre_count = (await db.execute(select(func.count(MitreMapping.id)))).scalar_one()

        db_metrics["records"] = {
            "flows": flows_count,
            "alerts": alerts_count,
            "audit_logs": audit_count,
            "mitre_mappings": mitre_count,
        }
    except Exception as exc:
        db_metrics["status"] = f"error: {exc}"

    # 3. Redis Status & Latency
    redis_metrics: Dict[str, Any] = {"status": "ok"}
    try:
        client = await get_redis_client()
        t0 = time.perf_counter()
        await client.ping()
        redis_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        redis_metrics["latency_ms"] = redis_latency_ms

        info = await client.info()
        redis_metrics["used_memory_human"] = info.get("used_memory_human", "N/A")
        redis_metrics["connected_clients"] = info.get("connected_clients", 1)
    except Exception as exc:
        redis_metrics["status"] = f"unavailable: {exc}"

    # 4. Engine & Security Telemetry
    active_rules = rule_engine.get_active_rules()
    uptime_seconds = round(time.time() - START_TIME, 1)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": uptime_seconds,
        "host_resources": {
            "cpu_percent": cpu_pct,
            "memory": mem_info,
            "disk": disk_info,
        },
        "database": db_metrics,
        "redis": redis_metrics,
        "detection_engine": {
            "active_sigma_rules": len(active_rules),
            "ml_models": ["IsolationForest", "RandomForestClassifier", "SHAP_TreeExplainer"],
            "mitre_framework": "ATT&CK Enterprise v14",
            "active_websocket_clients": ws_manager.client_count,
        },
    }
