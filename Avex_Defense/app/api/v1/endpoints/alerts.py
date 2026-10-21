"""
Alerts API router: threat alert querying, manual creation, triage status management, and statistics.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.schemas.alert import AlertCreate, AlertRead, AlertUpdate
from app.schemas.flow import FlowCreate
from app.services.alert_service import AlertService


router = APIRouter()


@router.get(
    "",
    response_model=List[AlertRead],
    summary="List threat alerts with multi-dimensional filtering",
)
async def list_alerts(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None, description="LOW, MEDIUM, HIGH, CRITICAL"),
    status_filter: Optional[str] = Query(None, alias="status", description="NEW, INVESTIGATING, RESOLVED, FALSE_POSITIVE"),
    behavior_class: Optional[str] = Query(None, description="Filter by threat behavior label"),
    tactic: Optional[str] = Query(None, description="Filter by MITRE tactic (e.g. Discovery, Command and Control)"),
    technique_id: Optional[str] = Query(None, description="Filter by MITRE technique ID (e.g. T1046)"),
    start_time: Optional[datetime] = Query(None, description="Filter alerts on or after timestamp (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="Filter alerts on or before timestamp (ISO format)"),
    min_severity_score: Optional[float] = Query(None, ge=0.0, le=10.0, description="Minimum severity score"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum AI confidence"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Retrieves filtered threat alerts. Returns pagination count in 'X-Total-Count' response header.
    """
    alerts, total = await AlertService.list_alerts(
        db=db,
        skip=skip,
        limit=limit,
        severity=severity,
        status=status_filter,
        behavior_class=behavior_class,
        tactic=tactic,
        technique_id=technique_id,
        start_time=start_time,
        end_time=end_time,
        min_severity_score=min_severity_score,
        min_confidence=min_confidence,
    )
    response.headers["X-Total-Count"] = str(total)
    return alerts


@router.get(
    "/stats/summary",
    status_code=status.HTTP_200_OK,
    summary="Retrieve aggregate alert statistics and MITRE breakdown",
)
async def get_alert_stats_summary(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Returns high-level threat metrics for SOC dashboards:
    - Total alert counts
    - Severity distributions (LOW, MEDIUM, HIGH, CRITICAL)
    - Triage status breakdown
    - Breakdown by MITRE ATT&CK tactic
    - Top targeted MITRE techniques
    - Average severity and confidence scores
    """
    return await AlertService.get_alert_stats_summary(db=db)


@router.post(
    "",
    response_model=AlertRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new threat alert",
)
async def create_alert(
    alert_in: AlertCreate,
    db: AsyncSession = Depends(get_async_session),
):
    alert = await AlertService.create_alert(
        db=db,
        alert_in=alert_in,
        actor="api_analyst",
    )
    return alert


@router.get(
    "/{alert_id}",
    response_model=AlertRead,
    summary="Retrieve details of a specific alert",
)
async def get_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
):
    alert = await AlertService.get_by_id(db=db, alert_id=alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found.",
        )
    return alert


@router.patch(
    "/{alert_id}",
    response_model=AlertRead,
    summary="Update triage status or severity of an alert",
)
async def update_alert(
    alert_id: uuid.UUID,
    alert_update: AlertUpdate,
    db: AsyncSession = Depends(get_async_session),
):
    alert = await AlertService.update_alert(
        db=db,
        alert_id=alert_id,
        alert_update=alert_update,
        actor="security_analyst",
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found.",
        )
    return alert


@router.post(
    "/evaluate-flow",
    status_code=status.HTTP_200_OK,
    summary="Real-time ML Ensemble Threat Evaluation with SHAP Explainability",
)
async def evaluate_flow_with_ml(
    flow_in: FlowCreate,
):
    """
    Evaluates a unidirectional flow through the hybrid ML detection engine:
    - Unsupervised Isolation Forest (zero-day anomaly scoring)
    - Supervised Random Forest (threat signature classification)
    - Ensemble Risk Fusion
    - Severity Matrix (confidence x impact x asset criticality)
    - SHAP Explainability (top driving features)
    """
    from app.ml.trainer import get_or_load_ensemble_engine

    engine = get_or_load_ensemble_engine()
    res = engine.evaluate_flow(flow_in, target_ip=flow_in.dst_ip, source_ip=flow_in.src_ip)

    return {
        "is_threat": res.is_threat,
        "behavior_class": res.behavior_class,
        "mitre_technique_id": res.mitre_technique_id,
        "risk_score": res.risk_score,
        "confidence": res.confidence,
        "severity_level": res.severity_level,
        "severity_score": res.severity_score,
        "is_novel_zero_day": res.is_novel_zero_day,
        "unsupervised_score": res.unsupervised_score,
        "supervised_class": res.supervised_class,
        "supervised_confidence": res.supervised_confidence,
        "explanation": res.explanation,
        "severity_metadata": res.severity_metadata,
    }
