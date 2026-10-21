"""
Dashboard and operational tasks router:
Serves the administrative Web Analysis & Tasks Dashboard at /analysis and /tasks.
Provides lightweight Jinja2-rendered HTML or structured JSON, plus API control plane triggers.
"""

from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService
from app.services.mitre_service import MitreService

router = APIRouter()

TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


async def _render_dashboard_or_json(
    request: Request,
    db: AsyncSession,
    format_param: Optional[str] = None,
):
    """
    Renders HTML dashboard via Jinja2 by default, or returns structured JSON if:
    - ?format=json query parameter is present, or
    - Client header specifically requests application/json without text/html.
    """
    data = await DashboardService.get_dashboard_data(db=db)

    accept_header = request.headers.get("accept", "")
    wants_json = (
        format_param == "json"
        or ("application/json" in accept_header and "text/html" not in accept_header)
    )

    if wants_json:
        return JSONResponse(content=jsonable_encoder(data))

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"data": data},
    )


@router.get(
    "/analysis",
    response_class=HTMLResponse,
    summary="Web Analysis and Administrative Control Plane Dashboard",
    include_in_schema=True,
)
async def get_analysis_dashboard(
    request: Request,
    format: Optional[str] = Query(None, description="Optional 'json' format specifier"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Comprehensive cybersecurity operations and tasks dashboard:
    - Infrastructure health (Postgres, Redis, Celery workers)
    - Ingestion pipeline stats & active background tasks
    - Active ML model ensemble status
    - Detected threat alerts & MITRE ATT&CK attribution ledger
    - Cryptographic SHA-256 tamper-evident audit hash chain
    """
    return await _render_dashboard_or_json(request=request, db=db, format_param=format)


@router.get(
    "/tasks",
    response_class=HTMLResponse,
    summary="Backend Operational Tasks & Ingestion Dashboard (Alias)",
    include_in_schema=True,
)
async def get_tasks_dashboard(
    request: Request,
    format: Optional[str] = Query(None, description="Optional 'json' format specifier"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Alias route for /analysis, focusing on primary operational tasks and pipeline health.
    """
    return await _render_dashboard_or_json(request=request, db=db, format_param=format)


@router.get(
    "/analysis/api/data",
    summary="Retrieve current dashboard telemetry and records as JSON",
    tags=["Dashboard API"],
)
@router.get(
    "/tasks/api/data",
    summary="Retrieve current dashboard telemetry as JSON (Alias)",
    tags=["Dashboard API"],
)
async def get_dashboard_api_data(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Pollable JSON endpoint returning live telemetry, worker readiness, and recent ledgers.
    """
    return await DashboardService.get_dashboard_data(db=db)


@router.post(
    "/analysis/api/trigger-pcap",
    status_code=status.HTTP_200_OK,
    summary="Trigger synthetic multi-scenario PCAP replay and asynchronous evaluation",
    tags=["Dashboard Controls"],
)
async def trigger_pcap_replay(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Generates synthetic 5-scenario PCAP packets (Benign, C2 Beaconing, Exfiltration,
    Port Probe, and TTL Masquerade) and feeds them into the detection pipeline.
    """
    return await DashboardService.trigger_sample_pcap_replay(db=db)


@router.post(
    "/analysis/api/trigger-batch",
    status_code=status.HTTP_200_OK,
    summary="Trigger batch ingestion of 15 synthetic unidirectional flows",
    tags=["Dashboard Controls"],
)
async def trigger_batch_ingest(
    count: int = Query(15, ge=1, le=100),
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Simulates a high-throughput batch burst from capture sensors.
    """
    return await DashboardService.trigger_batch_ingest(db=db, count=count)


@router.post(
    "/analysis/api/verify-chain",
    status_code=status.HTTP_200_OK,
    summary="Trigger immediate cryptographic SHA-256 hash chain verification",
    tags=["Dashboard Controls"],
)
async def verify_audit_chain(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Traverses the database audit ledger verifying all SHA-256 preimages and sequential links.
    """
    valid, count, bad_seq, head_hash, message = await AuditService.verify_chain_async(db=db)
    return {
        "verified": valid,
        "total_records": count,
        "tampered_sequence": bad_seq,
        "head_hash": head_hash,
        "message": message,
    }


@router.post(
    "/analysis/api/seed-mitre",
    status_code=status.HTTP_200_OK,
    summary="Trigger synchronization and seeding of default MITRE ATT&CK techniques",
    tags=["Dashboard Controls"],
)
async def seed_mitre_matrix(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Seeds default TTPs for unidirectional threat detection into the database.
    """
    added = await MitreService.seed_defaults(db=db)
    return {
        "status": "success",
        "newly_seeded_count": added,
        "message": f"Seeded {added} MITRE ATT&CK techniques into the database.",
    }
