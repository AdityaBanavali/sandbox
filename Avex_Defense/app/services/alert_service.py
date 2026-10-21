"""
Alert Service for generating threat alerts, updating triage status,
publishing to Redis Pub/Sub, broadcasting to WebSockets, and recording events in the tamper-evident audit ledger.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import publish_event, THREAT_ALERTS_CHANNEL
from app.core.websocket import ws_manager
from app.models.alert import Alert
from app.models.mitre import MitreMapping
from app.schemas.alert import AlertCreate, AlertUpdate
from app.services.audit_service import AuditService


class AlertService:
    @staticmethod
    async def create_alert(
        db: AsyncSession,
        alert_in: AlertCreate,
        actor: str = "ai_threat_detector",
    ) -> Alert:
        """
        Creates a new Threat Alert, appends to the audit ledger,
        and broadcasts the event across Redis Pub/Sub and active WebSockets.
        """
        db_alert = Alert(
            flow_id=alert_in.flow_id,
            mitre_mapping_id=alert_in.mitre_mapping_id,
            severity=alert_in.severity.upper(),
            severity_score=alert_in.severity_score,
            confidence=alert_in.confidence,
            behavior_class=alert_in.behavior_class,
            status=alert_in.status.upper(),
            model_version=alert_in.model_version,
            explanation=alert_in.explanation or {},
        )
        db.add(db_alert)
        await db.flush()

        # Eagerly reload full alert with relations to prevent DetachedInstanceError after commit
        stmt = (
            select(Alert)
            .options(selectinload(Alert.mitre_mapping), selectinload(Alert.flow))
            .where(Alert.id == db_alert.id)
        )
        res = await db.execute(stmt)
        loaded = res.scalars().first()
        if loaded:
            db_alert = loaded

        # Audit logging (Tamper-evident chain)
        await AuditService.append_async(
            db=db,
            action="ALERT_GENERATED",
            record_payload={
                "alert_id": str(db_alert.id),
                "flow_id": str(db_alert.flow_id),
                "severity": db_alert.severity,
                "severity_score": db_alert.severity_score,
                "confidence": db_alert.confidence,
                "behavior_class": db_alert.behavior_class,
                "model_version": db_alert.model_version,
            },
            actor=actor,
        )

        # Broadcast via Redis Pub/Sub & WebSockets
        alert_payload = {
            "event": "NEW_ALERT",
            "alert_id": str(db_alert.id),
            "flow_id": str(db_alert.flow_id),
            "severity": db_alert.severity,
            "severity_score": db_alert.severity_score,
            "confidence": db_alert.confidence,
            "behavior_class": db_alert.behavior_class,
            "status": db_alert.status,
            "timestamp": db_alert.timestamp.isoformat() if db_alert.timestamp else datetime.now(timezone.utc).isoformat(),
            "mitre_mapping_id": str(db_alert.mitre_mapping_id) if db_alert.mitre_mapping_id else None,
        }
        await publish_event(channel=THREAT_ALERTS_CHANNEL, message=alert_payload)
        await ws_manager.broadcast_alert(alert_payload)

        return db_alert

    @staticmethod
    async def update_alert(
        db: AsyncSession,
        alert_id: uuid.UUID,
        alert_update: AlertUpdate,
        actor: str = "security_analyst",
    ) -> Optional[Alert]:
        """
        Updates an alert's status or severity and logs the modification.
        """
        stmt = select(Alert).options(selectinload(Alert.mitre_mapping)).where(Alert.id == alert_id)
        result = await db.execute(stmt)
        db_alert = result.scalars().first()
        if not db_alert:
            return None

        old_status = db_alert.status
        old_severity = db_alert.severity

        if alert_update.status is not None:
            db_alert.status = alert_update.status.upper()
        if alert_update.severity is not None:
            db_alert.severity = alert_update.severity.upper()

        await db.flush()

        # Eagerly reload full alert with relations
        stmt_reload = (
            select(Alert)
            .options(selectinload(Alert.mitre_mapping), selectinload(Alert.flow))
            .where(Alert.id == alert_id)
        )
        res_reload = await db.execute(stmt_reload)
        loaded_alert = res_reload.scalars().first()
        if loaded_alert:
            db_alert = loaded_alert

        # Log change to tamper-evident audit ledger
        await AuditService.append_async(
            db=db,
            action="ALERT_TRIAGED",
            record_payload={
                "alert_id": str(db_alert.id),
                "old_status": old_status,
                "new_status": db_alert.status,
                "old_severity": old_severity,
                "new_severity": db_alert.severity,
            },
            actor=actor,
        )

        return db_alert

    @staticmethod
    async def get_by_id(db: AsyncSession, alert_id: uuid.UUID) -> Optional[Alert]:
        stmt = select(Alert).options(selectinload(Alert.mitre_mapping)).where(Alert.id == alert_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def list_alerts(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        behavior_class: Optional[str] = None,
        tactic: Optional[str] = None,
        technique_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        min_severity_score: Optional[float] = None,
        min_confidence: Optional[float] = None,
    ) -> Tuple[List[Alert], int]:
        """
        Queries alerts with multi-dimensional filtering across threat attributes and MITRE TTPs.
        """
        filters = []
        if severity:
            filters.append(Alert.severity == severity.upper())
        if status:
            filters.append(Alert.status == status.upper())
        if behavior_class:
            filters.append(Alert.behavior_class.ilike(f"%{behavior_class}%"))
        if start_time:
            filters.append(Alert.timestamp >= start_time)
        if end_time:
            filters.append(Alert.timestamp <= end_time)
        if min_severity_score is not None:
            filters.append(Alert.severity_score >= min_severity_score)
        if min_confidence is not None:
            filters.append(Alert.confidence >= min_confidence)

        stmt = select(Alert).options(selectinload(Alert.mitre_mapping)).order_by(Alert.timestamp.desc()).offset(skip).limit(limit)
        count_stmt = select(func.count(Alert.id))

        if tactic or technique_id:
            stmt = stmt.join(Alert.mitre_mapping)
            count_stmt = count_stmt.join(Alert.mitre_mapping)
            if tactic:
                filters.append(MitreMapping.tactic_name.ilike(f"%{tactic}%"))
            if technique_id:
                filters.append(MitreMapping.technique_id.ilike(f"%{technique_id}%"))

        if filters:
            count_stmt = count_stmt.where(and_(*filters))
            stmt = stmt.where(and_(*filters))

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_alert_stats_summary(db: AsyncSession) -> Dict[str, Any]:
        """
        Aggregates statistical breakdown of all recorded alerts:
        - Total count
        - Breakdown by severity (LOW, MEDIUM, HIGH, CRITICAL)
        - Breakdown by triage status (NEW, INVESTIGATING, RESOLVED, FALSE_POSITIVE)
        - Breakdown by MITRE tactic
        - Top MITRE techniques
        """
        total_stmt = select(func.count(Alert.id))
        total_alerts = (await db.execute(total_stmt)).scalar_one()

        # Severity breakdown
        sev_stmt = select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
        sev_res = await db.execute(sev_stmt)
        by_severity = {row[0]: row[1] for row in sev_res.all()}

        # Status breakdown
        stat_stmt = select(Alert.status, func.count(Alert.id)).group_by(Alert.status)
        stat_res = await db.execute(stat_stmt)
        by_status = {row[0]: row[1] for row in stat_res.all()}

        # Tactic breakdown
        tactic_stmt = (
            select(MitreMapping.tactic_name, func.count(Alert.id))
            .join(Alert.mitre_mapping)
            .group_by(MitreMapping.tactic_name)
        )
        tactic_res = await db.execute(tactic_stmt)
        by_tactic = {row[0]: row[1] for row in tactic_res.all()}

        # Top techniques breakdown
        tech_stmt = (
            select(MitreMapping.technique_id, MitreMapping.technique_name, func.count(Alert.id))
            .join(Alert.mitre_mapping)
            .group_by(MitreMapping.technique_id, MitreMapping.technique_name)
            .order_by(desc(func.count(Alert.id)))
            .limit(10)
        )
        tech_res = await db.execute(tech_stmt)
        top_techniques = [
            {"technique_id": row[0], "technique_name": row[1], "count": row[2]}
            for row in tech_res.all()
        ]

        # Average severity and confidence
        avg_stmt = select(
            func.avg(Alert.severity_score),
            func.avg(Alert.confidence),
        )
        avg_res = await db.execute(avg_stmt)
        avg_sev, avg_conf = avg_res.first() or (0.0, 0.0)

        return {
            "total_alerts": total_alerts,
            "by_severity": by_severity,
            "by_status": by_status,
            "by_mitre_tactic": by_tactic,
            "top_techniques": top_techniques,
            "avg_severity_score": round(float(avg_sev or 0.0), 2),
            "avg_confidence": round(float(avg_conf or 0.0), 2),
        }
