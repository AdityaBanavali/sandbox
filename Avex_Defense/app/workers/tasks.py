"""
Celery asynchronous worker tasks for Cyber Defense Enclave:
- AI threat detection and inference on unidirectional flows
- Cryptographic audit chain verification
"""

import uuid
import logging
from typing import Dict, Any

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_sync_session
from app.models.flow import Flow
from app.models.alert import Alert
from app.models.mitre import MitreMapping
from app.models.audit import AuditLog, GENESIS_HASH
from app.services.audit_service import AuditService, compute_record_hash
from app.ml.trainer import get_or_load_ensemble_engine

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.detect_threats_for_flow")
def detect_threats_for_flow_task(flow_id_str: str) -> Dict[str, Any]:
    """
    Evaluates an ingested unidirectional flow against the hybrid ML ensemble
    (Isolation Forest + Random Forest + Severity Matrix + SHAP Explainability).
    Appends threat detection results directly to the database and audit chain.
    """
    logger.info("Executing threat detection analysis for flow %s", flow_id_str)
    flow_id = uuid.UUID(flow_id_str)

    with get_sync_session() as session:
        flow = session.query(Flow).filter(Flow.id == flow_id).first()
        if not flow:
            logger.warning("Flow %s not found in database", flow_id_str)
            return {"status": "error", "message": "Flow not found"}

        alerts_created = []

        # -------------------------------------------------------------------
        # Primary ML Pipeline: Hybrid Ensemble Evaluation & Sigma Rules
        # -------------------------------------------------------------------
        try:
            from app.rules.engine import get_rule_engine
            from app.services.mitre_mapper import get_mitre_mapper

            ml_engine = get_or_load_ensemble_engine()
            rule_engine = get_rule_engine()
            mitre_mapper = get_mitre_mapper()

            # Synchronously evaluate both ML and custom Sigma rules
            eval_res = ml_engine.evaluate_flow(flow, target_ip=flow.dst_ip, source_ip=flow.src_ip)
            rule_matches = rule_engine.evaluate(flow)

            # Corroborate results
            is_threat = eval_res.is_threat or len(rule_matches) > 0
            behavior_class = eval_res.behavior_class

            if not eval_res.is_threat and rule_matches:
                behavior_class = f"SIGNATURE_{rule_matches[0].rule_title.upper().replace(' ', '_')}"

            # Enrich explanation with rule hits and dynamic MITRE data
            explanation = eval_res.explanation or {}
            if rule_matches:
                explanation["sigma_rule_hits"] = [
                    {"rule_id": rm.rule_id, "title": rm.rule_title, "level": rm.level, "tags": rm.tags}
                    for rm in rule_matches
                ]

            # Dynamic MITRE enrichment
            enriched_payload = mitre_mapper.enrich_alert(
                behavior_label=behavior_class,
                alert_payload={"explanation": explanation},
            )
            mitre_meta = enriched_payload.get("mitre_enrichment", {})

            if is_threat:
                # Find or create matching MITRE technique in DB
                tech_id = mitre_meta.get("technique_id") or eval_res.mitre_technique_id
                mitre = None
                if tech_id and tech_id != "N/A":
                    mitre = (
                        session.query(MitreMapping)
                        .filter(MitreMapping.technique_id == tech_id)
                        .first()
                    )
                    if not mitre and mitre_meta:
                        # Auto-create in DB from dynamic YAML config
                        mitre = MitreMapping(
                            technique_id=tech_id,
                            tactic_name=mitre_meta.get("tactic_name", "Unknown"),
                            technique_name=mitre_meta.get("technique_name", "Unknown"),
                            subtechnique_id=mitre_meta.get("subtechnique_id"),
                            description=mitre_meta.get("description", ""),
                            url=mitre_meta.get("mitre_url"),
                        )
                        session.add(mitre)
                        session.flush()

                # Adjust confidence & severity if rule matches
                fused_conf = eval_res.confidence
                fused_sev = eval_res.severity_level
                fused_score = eval_res.severity_score
                if rule_matches:
                    fused_conf = min(1.0, fused_conf + 0.08)
                    if any(rm.level.lower() == "critical" for rm in rule_matches):
                        fused_sev = "CRITICAL"
                        fused_score = max(fused_score, 8.5)

                alert = Alert(
                    flow_id=flow.id,
                    mitre_mapping_id=mitre.id if mitre else None,
                    severity=fused_sev,
                    severity_score=fused_score,
                    confidence=fused_conf,
                    behavior_class=behavior_class,
                    status="NEW",
                    model_version=settings.AI_MODEL_VERSION,
                    explanation=explanation,
                )
                session.add(alert)
                session.flush()

                AuditService.append_sync(
                    session=session,
                    action="ALERT_GENERATED_HYBRID",
                    record_payload={
                        "alert_id": str(alert.id),
                        "flow_id": str(flow.id),
                        "behavior_class": alert.behavior_class,
                        "severity": alert.severity,
                        "severity_score": alert.severity_score,
                        "confidence": alert.confidence,
                        "is_novel_zero_day": eval_res.is_novel_zero_day,
                        "sigma_rule_hits": len(rule_matches),
                        "mitre_technique": tech_id,
                    },
                    actor="celery_worker_hybrid_engine",
                )
                alerts_created.append(str(alert.id))
                logger.info(
                    "Hybrid Threat Alert generated: %s [%s] score=%.2f conf=%.2f (rules=%d)",
                    alert.behavior_class,
                    alert.severity,
                    alert.severity_score,
                    alert.confidence,
                    len(rule_matches),
                )
        except Exception as exc:
            logger.error("Error during hybrid evaluation on flow %s: %s", flow_id_str, exc)


        features = flow.features or {}


        # -------------------------------------------------------------------
        # Rule / Model 1: High-Entropy Data Exfiltration (T1048)
        # Unidirectional taps with payload entropy > threshold
        # -------------------------------------------------------------------
        if flow.payload_entropy is not None and flow.payload_entropy >= settings.ENTROPY_THRESHOLD:
            mitre = session.query(MitreMapping).filter(MitreMapping.technique_id == "T1048.003").first()
            if not mitre:
                mitre = session.query(MitreMapping).filter(MitreMapping.technique_id == "T1048").first()

            alert = Alert(
                flow_id=flow.id,
                mitre_mapping_id=mitre.id if mitre else None,
                severity="HIGH",
                severity_score=8.5,
                confidence=0.92,
                behavior_class="High-Entropy Unidirectional Exfiltration",
                status="NEW",
                model_version=settings.AI_MODEL_VERSION,
                explanation={
                    "metric": "payload_entropy",
                    "observed_value": flow.payload_entropy,
                    "threshold": settings.ENTROPY_THRESHOLD,
                    "reason": "Payload exhibits near-random cryptographic entropy, consistent with covert exfiltration over data diode.",
                },
            )
            session.add(alert)
            session.flush()

            AuditService.append_sync(
                session=session,
                action="ALERT_GENERATED",
                record_payload={
                    "alert_id": str(alert.id),
                    "flow_id": str(flow.id),
                    "behavior_class": alert.behavior_class,
                    "severity": alert.severity,
                },
                actor="celery_worker_ai",
            )
            alerts_created.append(str(alert.id))

        # -------------------------------------------------------------------
        # Rule / Model 2: Port Sweep / Network Service Discovery (T1046)
        # Low packet count, short duration, SYN or UDP probe
        # -------------------------------------------------------------------
        port_flags = features.get("port_anomaly_flags", {})
        if (
            flow.packet_count <= 2 and flow.duration_ms < 50 and flow.byte_count < 200
        ) or port_flags.get("syn_without_ack_return") or port_flags.get("is_reserved_target"):
            if flow.dst_port in [21, 22, 23, 80, 443, 3389, 445, 8080, 8443]:
                mitre = session.query(MitreMapping).filter(MitreMapping.technique_id == "T1046").first()
                alert = Alert(
                    flow_id=flow.id,
                    mitre_mapping_id=mitre.id if mitre else None,
                    severity="MEDIUM",
                    severity_score=5.5,
                    confidence=0.81,
                    behavior_class="Unidirectional Port Probe Sweep",
                    status="NEW",
                    model_version=settings.AI_MODEL_VERSION,
                    explanation={
                        "dst_port": flow.dst_port,
                        "packet_count": flow.packet_count,
                        "duration_ms": flow.duration_ms,
                        "port_flags": port_flags,
                        "reason": "Isolated low-packet probe directed at sensitive port in unidirectional network.",
                    },
                )
                session.add(alert)
                session.flush()

                AuditService.append_sync(
                    session=session,
                    action="ALERT_GENERATED",
                    record_payload={
                        "alert_id": str(alert.id),
                        "flow_id": str(flow.id),
                        "behavior_class": alert.behavior_class,
                        "severity": alert.severity,
                    },
                    actor="celery_worker_ai",
                )
                alerts_created.append(str(alert.id))

        # -------------------------------------------------------------------
        # Rule / Model 3: Periodic C2 Beaconing Channel (T1071.004 / T1095)
        # Rigid IAT distribution with low Shannon entropy & low jitter
        # -------------------------------------------------------------------
        if features.get("is_c2_beacon", False):
            mitre = session.query(MitreMapping).filter(MitreMapping.technique_id == "T1071.004").first()
            if not mitre:
                mitre = session.query(MitreMapping).filter(MitreMapping.technique_id == "T1095").first()

            alert = Alert(
                flow_id=flow.id,
                mitre_mapping_id=mitre.id if mitre else None,
                severity="HIGH",
                severity_score=8.8,
                confidence=0.94,
                behavior_class="Periodic C2 Beaconing Channel",
                status="NEW",
                model_version=settings.AI_MODEL_VERSION,
                explanation={
                    "iat_entropy": features.get("iat_entropy"),
                    "iat_mean_ms": flow.iat_mean,
                    "iat_std_ms": flow.iat_std,
                    "reason": "Highly regular inter-arrival timing with near-zero Shannon entropy, indicating an automated adversary C2 heartbeat beacon.",
                },
            )
            session.add(alert)
            session.flush()

            AuditService.append_sync(
                session=session,
                action="ALERT_GENERATED",
                record_payload={
                    "alert_id": str(alert.id),
                    "flow_id": str(flow.id),
                    "behavior_class": alert.behavior_class,
                    "severity": alert.severity,
                },
                actor="celery_worker_ai",
            )
            alerts_created.append(str(alert.id))

        # -------------------------------------------------------------------
        # Rule / Model 4: TTL / OS Device Spoofing & Masquerade
        # Multi-TTL variance or conflicting base TTLs in same flow window
        # -------------------------------------------------------------------
        ttl_info = features.get("ttl_fingerprint", {})
        if ttl_info.get("is_ttl_spoofed", False):
            alert = Alert(
                flow_id=flow.id,
                mitre_mapping_id=None,
                severity="MEDIUM",
                severity_score=6.8,
                confidence=0.87,
                behavior_class="TTL / IP Device Masquerade & Spoofing",
                status="NEW",
                model_version=settings.AI_MODEL_VERSION,
                explanation={
                    "ttl_variance": ttl_info.get("ttl_variance"),
                    "unique_ttls_count": ttl_info.get("unique_ttls_count"),
                    "os_family": ttl_info.get("os_family"),
                    "reason": "Inconsistent TTL observed within the same flow/source IP, indicating packet spoofing or multiple rogue devices transmitting through a single tap.",
                },
            )
            session.add(alert)
            session.flush()

            AuditService.append_sync(
                session=session,
                action="ALERT_GENERATED",
                record_payload={
                    "alert_id": str(alert.id),
                    "flow_id": str(flow.id),
                    "behavior_class": alert.behavior_class,
                    "severity": alert.severity,
                },
                actor="celery_worker_ai",
            )
            alerts_created.append(str(alert.id))

        # -------------------------------------------------------------------
        # Rule / Model 5: Adaptive EWMA Volumetric Anomaly (T1498)
        # Z-score spike exceeding 3.0 relative to rolling baseline
        # -------------------------------------------------------------------
        ewma_info = features.get("ewma_stats", {})
        if ewma_info.get("is_volume_anomaly", False):
            mitre = session.query(MitreMapping).filter(MitreMapping.technique_id == "T1498").first()
            alert = Alert(
                flow_id=flow.id,
                mitre_mapping_id=mitre.id if mitre else None,
                severity="HIGH",
                severity_score=7.9,
                confidence=0.85,
                behavior_class="Adaptive EWMA Volumetric Burst Anomaly",
                status="NEW",
                model_version=settings.AI_MODEL_VERSION,
                explanation={
                    "z_score_pps": ewma_info.get("z_score_pps"),
                    "z_score_bps": ewma_info.get("z_score_bps"),
                    "current_pps": ewma_info.get("current_pps"),
                    "ewma_mean_pps": ewma_info.get("ewma_mean_pps"),
                    "reason": "Traffic rate deviates by >3 sigma from the rolling exponentially weighted moving average baseline.",
                },
            )
            session.add(alert)
            session.flush()

            AuditService.append_sync(
                session=session,
                action="ALERT_GENERATED",
                record_payload={
                    "alert_id": str(alert.id),
                    "flow_id": str(flow.id),
                    "behavior_class": alert.behavior_class,
                    "severity": alert.severity,
                },
                actor="celery_worker_ai",
            )
            alerts_created.append(str(alert.id))

        return {
            "status": "success",
            "flow_id": flow_id_str,
            "alerts_created": alerts_created,
        }


@celery_app.task(name="tasks.verify_audit_chain")
def verify_audit_chain_task() -> Dict[str, Any]:
    """
    Periodic Celery task validating the cryptographic integrity of the audit ledger.
    """
    logger.info("Executing scheduled tamper-evident audit ledger verification")

    with get_sync_session() as session:
        records = session.query(AuditLog).order_by(AuditLog.sequence_number.asc()).all()
        total = len(records)
        if total == 0:
            return {"verified": True, "total_records": 0, "message": "Audit chain empty."}

        expected_prev_hash = GENESIS_HASH
        for idx, record in enumerate(records):
            expected_seq = idx + 1
            if record.sequence_number != expected_seq or record.previous_hash != expected_prev_hash:
                logger.error("Tampering detected at sequence %d!", record.sequence_number)
                return {
                    "verified": False,
                    "tampered_sequence": record.sequence_number,
                    "total_records": total,
                    "message": f"Tamper detected at seq {record.sequence_number}",
                }

            computed = compute_record_hash(
                sequence_number=record.sequence_number,
                timestamp=record.timestamp,
                action=record.action,
                actor=record.actor,
                previous_hash=record.previous_hash,
                payload=record.record_payload,
            )
            if computed != record.record_hash:
                logger.error("Hash mismatch at sequence %d!", record.sequence_number)
                return {
                    "verified": False,
                    "tampered_sequence": record.sequence_number,
                    "total_records": total,
                    "message": f"Hash recalculation mismatch at seq {record.sequence_number}",
                }

            expected_prev_hash = record.record_hash

        return {
            "verified": True,
            "total_records": total,
            "head_hash": records[-1].record_hash,
            "message": "All records cryptographically valid.",
        }
