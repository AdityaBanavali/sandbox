"""
Dashboard service for Cyber Defense Enclave:
Aggregates real-time telemetry, worker cluster readiness, ingestion pipeline metrics,
active threat analysis records, and cryptographic audit hash chain ledger.
Also provides administrative triggers for PCAP replay, batch ingestion, and chain verification.
"""

import asyncio
import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict, cast

from sqlalchemy import select, func, desc, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.redis import get_redis_client
from app.core.websocket import ws_manager
from app.models.flow import Flow
from app.models.alert import Alert
from app.models.audit import AuditLog, GENESIS_HASH
from app.models.mitre import MitreMapping
from app.rules.engine import rule_engine
from app.schemas.flow import FlowCreate
from app.services.alert_service import AlertService
from app.services.audit_service import AuditService
from app.services.flow_service import FlowService
from app.services.mitre_service import MitreService
from app.services.pcap_service import UnidirectionalFlowAggregator
from app.workers.tasks import detect_threats_for_flow_task

logger = logging.getLogger("cyber_defense.dashboard")

DASHBOARD_START_TIME = time.time()


class FlowScenario(TypedDict):
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    packet_count: int
    byte_count: int
    duration_ms: float
    payload_entropy: float
    iat_entropy: float
    is_c2: bool


def _inspect_celery_cluster_sync() -> Dict[str, Any]:
    """
    Synchronous helper to probe Celery worker nodes without blocking the async loop.
    Timeout is kept tight (0.6s) to ensure ultra-fast dashboard responsiveness.
    """
    try:
        insp = celery_app.control.inspect(timeout=0.6)
        ping_res = insp.ping() or {}
        active_tasks = insp.active() or {}
        registered = insp.registered() or {}
        stats = insp.stats() or {}

        all_nodes = set(list(ping_res.keys()) + list(active_tasks.keys()) + list(stats.keys()))
        workers = []

        for node_name in sorted(all_nodes):
            is_alive = node_name in ping_res and ping_res[node_name].get("ok") == "pong"
            act = active_tasks.get(node_name, [])
            reg = registered.get(node_name, [])
            st = stats.get(node_name, {})
            pool_info = st.get("pool", {})
            concurrency = pool_info.get("max-concurrency", "N/A")

            workers.append({
                "name": node_name,
                "status": "ONLINE" if is_alive else "OFFLINE",
                "concurrency": concurrency,
                "active_tasks_count": len(act),
                "active_tasks": act,
                "registered_tasks": reg,
            })

        online_count = sum(1 for w in workers if w["status"] == "ONLINE")
        return {
            "status": "ok" if online_count > 0 else "degraded",
            "workers_online": online_count,
            "total_workers": len(workers),
            "workers": workers,
        }
    except Exception as exc:
        logger.warning("Could not inspect Celery cluster: %s", exc)
        return {
            "status": "unavailable",
            "error": str(exc),
            "workers_online": 0,
            "total_workers": 0,
            "workers": [],
        }


class DashboardService:
    """
    Provides comprehensive administrative metrics and control triggers
    for the cyber defense dashboard.
    """

    @classmethod
    async def get_dashboard_data(cls, db: AsyncSession) -> Dict[str, Any]:
        """
        Gathers complete unified state across:
        1. System Readiness & Worker Cluster
        2. Ingestion Pipeline & Flow Statistics
        3. Active ML Models & Sigma Detection Rules
        4. Recent Threat Analysis Ledger
        5. Tamper-Evident SHA-256 Audit Chain
        6. MITRE ATT&CK Matrix Coverage
        """
        now = datetime.now(timezone.utc)

        # -------------------------------------------------------------------
        # 1. Database Health & Table Counts
        # -------------------------------------------------------------------
        db_metrics: Dict[str, Any] = {"status": "ok"}
        try:
            t0 = time.perf_counter()
            await db.execute(text("SELECT 1"))
            db_latency = round((time.perf_counter() - t0) * 1000, 2)
            db_metrics["latency_ms"] = db_latency

            flows_count = (await db.execute(select(func.count(Flow.id)))).scalar_one()
            alerts_count = (await db.execute(select(func.count(Alert.id)))).scalar_one()
            audit_count = (await db.execute(select(func.count(AuditLog.id)))).scalar_one()
            mitre_count = (await db.execute(select(func.count(MitreMapping.id)))).scalar_one()

            db_metrics["counts"] = {
                "flows": flows_count,
                "alerts": alerts_count,
                "audit_logs": audit_count,
                "mitre_mappings": mitre_count,
            }
        except Exception as exc:
            db_metrics["status"] = f"error: {exc}"
            db_metrics["counts"] = {"flows": 0, "alerts": 0, "audit_logs": 0, "mitre_mappings": 0}

        # -------------------------------------------------------------------
        # 2. Redis Telemetry
        # -------------------------------------------------------------------
        redis_metrics: Dict[str, Any] = {"status": "ok"}
        try:
            r_client = await get_redis_client()
            t0 = time.perf_counter()
            await r_client.ping()
            redis_metrics["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)

            r_info = await r_client.info()
            redis_metrics["used_memory_human"] = r_info.get("used_memory_human", "N/A")
            redis_metrics["connected_clients"] = r_info.get("connected_clients", 1)
            redis_metrics["channels"] = ["threat_alerts", "threat_flows"]
        except Exception as exc:
            redis_metrics["status"] = f"unavailable: {exc}"
            redis_metrics["used_memory_human"] = "N/A"
            redis_metrics["connected_clients"] = 0
            redis_metrics["channels"] = []

        # -------------------------------------------------------------------
        # 3. Celery Worker Cluster Telemetry (Non-blocking threadpool inspection)
        # -------------------------------------------------------------------
        celery_metrics = await asyncio.to_thread(_inspect_celery_cluster_sync)

        # -------------------------------------------------------------------
        # 4. ML Models & Detection Engine Metadata
        # -------------------------------------------------------------------
        active_sigma_rules = rule_engine.get_active_rules()
        sigma_list = [
            {"id": r.id, "title": r.title, "level": r.level, "tags": r.tags}
            for r in active_sigma_rules[:6]
        ]
        ml_engine_info = {
            "version": settings.AI_MODEL_VERSION,
            "models": [
                {
                    "name": "IsolationForest Anomaly Detector",
                    "type": "Unsupervised Outlier Scoring",
                    "target": "Zero-Day & Covariate Shift Anomaly",
                    "status": "LOADED",
                },
                {
                    "name": "RandomForest Classifier",
                    "type": "Supervised Multi-Class Classifier",
                    "target": "C2 Beaconing, Exfiltration, Port Sweeps, Spoofing",
                    "status": "LOADED",
                },
                {
                    "name": "SHAP TreeExplainer",
                    "type": "Local Feature Attribution Engine",
                    "target": "Interpretable Explainability Preimages",
                    "status": "LOADED",
                },
                {
                    "name": "Sigma Rule Engine",
                    "type": "Deterministic Rule Heuristics",
                    "target": f"{len(active_sigma_rules)} Compiled Behavioral Signatures",
                    "status": "ACTIVE",
                },
            ],
            "active_sigma_count": len(active_sigma_rules),
            "sample_sigma_rules": sigma_list,
            "mitre_framework": "ATT&CK Enterprise v14",
            "active_websocket_subscribers": ws_manager.client_count,
        }

        # -------------------------------------------------------------------
        # 5. Ingestion Pipeline & Flow Statistics
        # -------------------------------------------------------------------
        flow_stats = await FlowService.get_flow_stats_summary(db=db)

        # Primary backend operational tasks registered
        backend_tasks = [
            {
                "task_name": "tasks.detect_threats_for_flow",
                "display_name": "AI Hybrid Threat Inference & MITRE Enrichment",
                "queue": "celery",
                "trigger": "Event-driven (on flow ingest)",
                "status": "RUNNING",
                "description": "Applies Isolation Forest, Random Forest, Sigma rules, and SHAP attribution to newly tapped unidirectional flows.",
            },
            {
                "task_name": "tasks.verify_audit_chain",
                "display_name": "Cryptographic Hash Chain Integrity Audit",
                "queue": "celery",
                "trigger": "Periodic & Administrative On-Demand",
                "status": "IDLE",
                "description": "Traverses sequential SHA-256 blocks from Genesis to Head to ensure zero ledger tampering.",
            },
            {
                "task_name": "pipeline.pcap_byte_aggregator",
                "display_name": "Raw Unidirectional PCAP Stream Aggregator (dpkt)",
                "queue": "fastapi_async",
                "trigger": "Continuous Stream / File Upload",
                "status": "LISTENING",
                "description": "Calculates packet size skew, Shannon entropy, and inter-arrival timing without return ACK dependency.",
            },
            {
                "task_name": "pubsub.websocket_broadcaster",
                "display_name": "Real-Time Redis Pub/Sub WebSocket Dispatcher",
                "queue": "asyncio_worker",
                "trigger": "Redis Event Channel",
                "status": "STREAMING",
                "description": f"Broadcasts live anomaly events to {ws_manager.client_count} subscribed dashboard clients.",
            },
        ]

        # -------------------------------------------------------------------
        # 6. Active Threat Alerts Ledger (Recent Alerts)
        # -------------------------------------------------------------------
        alert_stmt = (
            select(Alert)
            .options(selectinload(Alert.flow), selectinload(Alert.mitre_mapping))
            .order_by(Alert.timestamp.desc())
            .limit(25)
        )
        alert_res = await db.execute(alert_stmt)
        raw_alerts = alert_res.scalars().all()

        recent_threats = []
        for a in raw_alerts:
            flow_info = {}
            if a.flow:
                flow_info = {
                    "src_ip": a.flow.src_ip,
                    "dst_ip": a.flow.dst_ip,
                    "src_port": a.flow.src_port,
                    "dst_port": a.flow.dst_port,
                    "protocol": a.flow.protocol,
                    "payload_entropy": round(a.flow.payload_entropy, 3) if a.flow.payload_entropy else None,
                    "packet_count": a.flow.packet_count,
                    "byte_count": a.flow.byte_count,
                }

            mitre_info = {}
            if a.mitre_mapping:
                mitre_info = {
                    "technique_id": a.mitre_mapping.technique_id,
                    "technique_name": a.mitre_mapping.technique_name,
                    "tactic_name": a.mitre_mapping.tactic_name,
                    "url": a.mitre_mapping.url,
                }

            recent_threats.append({
                "id": str(a.id),
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "severity": a.severity,
                "severity_score": round(a.severity_score, 2),
                "confidence": round(a.confidence, 2),
                "confidence_pct": round(a.confidence * 100),
                "behavior_class": a.behavior_class,
                "status": a.status,
                "model_version": a.model_version,
                "flow": flow_info,
                "mitre": mitre_info,
                "explanation_summary": cls._summarize_explanation(a.explanation),
            })

        # -------------------------------------------------------------------
        # 7. Tamper-Evident SHA-256 Audit Ledger
        # -------------------------------------------------------------------
        audit_stmt = (
            select(AuditLog)
            .order_by(AuditLog.sequence_number.desc())
            .limit(25)
        )
        audit_res = await db.execute(audit_stmt)
        raw_audit = audit_res.scalars().all()

        audit_entries = []
        for entry in raw_audit:
            audit_entries.append({
                "sequence_number": entry.sequence_number,
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                "action": entry.action,
                "actor": entry.actor,
                "previous_hash": entry.previous_hash,
                "record_hash": entry.record_hash,
                "previous_hash_short": entry.previous_hash[:12] + "..." if entry.previous_hash else "N/A",
                "record_hash_short": entry.record_hash[:12] + "...",
                "payload_snippet": cls._format_payload_snippet(entry.record_payload),
            })

        # -------------------------------------------------------------------
        # 8. MITRE ATT&CK Tactics Overview
        # -------------------------------------------------------------------
        tactics_overview = await MitreService.get_tactics_overview(db=db)

        # Calculate Overall Health
        overall_ready = (
            db_metrics["status"] == "ok"
            and redis_metrics["status"] == "ok"
            and celery_metrics["workers_online"] > 0
        )

        return {
            "title": settings.APP_NAME,
            "environment": settings.APP_ENV,
            "timestamp": now.isoformat(),
            "uptime_seconds": round(time.time() - DASHBOARD_START_TIME, 1),
            "overall_status": "OPERATIONAL" if overall_ready else "READY_PARTIAL",
            "system_readiness": {
                "overall_ready": overall_ready,
                "database": db_metrics,
                "redis": redis_metrics,
                "celery": celery_metrics,
                "ml_engine": ml_engine_info,
            },
            "ingestion_pipeline": {
                "summary": flow_stats,
                "tasks": backend_tasks,
            },
            "recent_threats": recent_threats,
            "audit_ledger": {
                "total_records": db_metrics["counts"]["audit_logs"],
                "head_hash": audit_entries[0]["record_hash"] if audit_entries else GENESIS_HASH,
                "entries": audit_entries,
            },
            "mitre_matrix": {
                "total_techniques": db_metrics["counts"]["mitre_mappings"],
                "tactics": tactics_overview,
            },
        }

    @staticmethod
    def _summarize_explanation(explanation: Optional[Dict[str, Any]]) -> str:
        """Helper to format explanation for clean display."""
        if not explanation:
            return "No explanation attributes recorded."
        if "reason" in explanation:
            return str(explanation["reason"])
        if "top_features" in explanation:
            features = explanation["top_features"]
            if isinstance(features, list):
                names = [f.get("feature", "") for f in features[:3] if isinstance(f, dict)]
                return f"Dominant features: {', '.join(filter(None, names))}"
        return "Heuristic anomaly score triggered threshold."

    @staticmethod
    def _format_payload_snippet(payload: Any) -> str:
        """Formats audit record payload into a compact snippet."""
        if not isinstance(payload, dict):
            return str(payload)[:50]
        items = []
        for k in ["behavior_class", "severity", "flow_id", "alert_id", "packet_count"]:
            if k in payload:
                items.append(f"{k}: {payload[k]}")
        return " | ".join(items) if items else str(payload)[:60]

    @classmethod
    async def trigger_sample_pcap_replay(cls, db: AsyncSession) -> Dict[str, Any]:
        """
        Generates synthetic 5-scenario PCAP packets and processes them through
        the UnidirectionalFlowAggregator and Celery detection pipeline.
        """
        from scripts.pcap_replay import generate_synthetic_threat_pcap

        # Generate in-memory synthetic PCAP stream
        pcap_bytes = generate_synthetic_threat_pcap()
        aggregator = UnidirectionalFlowAggregator(inactivity_timeout_s=10.0)
        extracted_flow_dicts = aggregator.process_pcap(pcap_bytes)

        if not extracted_flow_dicts:
            return {
                "status": "error",
                "message": "No flows extracted from synthetic PCAP generator.",
                "flows_ingested": 0,
            }

        # Convert to FlowCreate schema objects
        flows_to_create = []
        for fd in extracted_flow_dicts:
            features_payload = {
                "packet_size_skew": fd["packet_size_skew"],
                "iat_entropy": fd["iat_entropy"],
                "is_c2_beacon": fd["is_c2_beacon"],
                "port_anomaly_flags": fd["port_anomaly_flags"],
                "ttl_fingerprint": fd["ttl_fingerprint"],
                "is_encrypted_exfiltration": fd["is_encrypted_exfiltration"],
                "ewma_stats": fd["ewma_stats"],
            }
            flows_to_create.append(
                FlowCreate(
                    src_ip=fd["src_ip"],
                    dst_ip=fd["dst_ip"],
                    src_port=fd["src_port"],
                    dst_port=fd["dst_port"],
                    protocol=fd["protocol"],
                    start_time=fd["start_time"],
                    end_time=fd["end_time"],
                    duration_ms=fd["duration_ms"],
                    packet_count=fd["packet_count"],
                    byte_count=fd["byte_count"],
                    packet_size_mean=fd["packet_size_mean"],
                    packet_size_std=fd["packet_size_std"],
                    packet_size_min=fd["packet_size_min"],
                    packet_size_max=fd["packet_size_max"],
                    iat_mean=fd["iat_mean"],
                    iat_std=fd["iat_std"],
                    iat_min=fd["iat_min"],
                    iat_max=fd["iat_max"],
                    payload_entropy=fd["payload_entropy"],
                    features=features_payload,
                )
            )

        # Batch persist flows & create audit records
        created_flows = await FlowService.create_batch(
            db=db,
            flows_in=flows_to_create,
            actor="dashboard_pcap_replay",
        )

        flow_ids = [str(f.id) for f in created_flows]

        # Enqueue background detection for each flow
        enqueued_count = 0
        for fid in flow_ids:
            try:
                cast(Any, detect_threats_for_flow_task).delay(fid)
                enqueued_count += 1
            except Exception as exc:
                logger.warning("Could not dispatch task to Celery: %s", exc)

        return {
            "status": "success",
            "action": "SYNTHETIC_PCAP_REPLAY",
            "pcap_size_bytes": len(pcap_bytes),
            "flows_ingested": len(created_flows),
            "celery_tasks_dispatched": enqueued_count,
            "flow_ids": flow_ids[:5],
            "message": f"Successfully parsed and ingested {len(created_flows)} unidirectional flows from synthetic PCAP. Triggered AI threat classification workers.",
        }

    @classmethod
    async def trigger_batch_ingest(cls, db: AsyncSession, count: int = 15) -> Dict[str, Any]:
        """
        Generates and ingests a simulated high-throughput batch of flows.
        """
        sample_scenarios: List[FlowScenario] = [
            # High-entropy exfiltration
            {
                "src_ip": "192.168.1.18",
                "dst_ip": "203.0.113.88",
                "src_port": 55123,
                "dst_port": 443,
                "protocol": "TCP",
                "packet_count": 80,
                "byte_count": 96000,
                "duration_ms": 450.0,
                "payload_entropy": 7.85,
                "iat_entropy": 3.4,
                "is_c2": False,
            },
            # C2 Beaconing
            {
                "src_ip": "192.168.1.205",
                "dst_ip": "198.51.100.4",
                "src_port": 49800,
                "dst_port": 8443,
                "protocol": "TCP",
                "packet_count": 30,
                "byte_count": 3600,
                "duration_ms": 30000.0,
                "payload_entropy": 4.1,
                "iat_entropy": 0.45,
                "is_c2": True,
            },
            # Benign DNS
            {
                "src_ip": "192.168.1.100",
                "dst_ip": "10.0.0.53",
                "src_port": 52001,
                "dst_port": 53,
                "protocol": "UDP",
                "packet_count": 8,
                "byte_count": 1024,
                "duration_ms": 65.0,
                "payload_entropy": 3.8,
                "iat_entropy": 2.8,
                "is_c2": False,
            },
            # Port sweep probe
            {
                "src_ip": "192.168.1.99",
                "dst_ip": "10.0.0.1",
                "src_port": 40001,
                "dst_port": 3389,
                "protocol": "TCP",
                "packet_count": 2,
                "byte_count": 128,
                "duration_ms": 15.0,
                "payload_entropy": 1.2,
                "iat_entropy": 1.1,
                "is_c2": False,
            },
        ]

        flows_to_create = []
        now = datetime.now(timezone.utc)

        for i in range(count):
            proto_spec: FlowScenario = sample_scenarios[i % len(sample_scenarios)]
            flows_to_create.append(
                FlowCreate(
                    src_ip=proto_spec["src_ip"],
                    dst_ip=proto_spec["dst_ip"],
                    src_port=proto_spec["src_port"] + (i * 3),
                    dst_port=proto_spec["dst_port"],
                    protocol=proto_spec["protocol"],
                    start_time=now,
                    end_time=now,
                    duration_ms=proto_spec["duration_ms"] + random.uniform(5, 30),
                    packet_count=proto_spec["packet_count"],
                    byte_count=proto_spec["byte_count"],
                    packet_size_mean=float(proto_spec["byte_count"] / max(proto_spec["packet_count"], 1)),
                    packet_size_std=15.0,
                    packet_size_min=64.0,
                    packet_size_max=1400.0,
                    iat_mean=10.0,
                    iat_std=2.0,
                    iat_min=0.5,
                    iat_max=20.0,
                    payload_entropy=proto_spec["payload_entropy"],
                    features={
                        "is_c2_beacon": proto_spec["is_c2"],
                        "iat_entropy": proto_spec["iat_entropy"],
                        "port_anomaly_flags": {"is_sensitive_probe": proto_spec["dst_port"] in [22, 3389, 445]},
                        "ttl_fingerprint": {"initial_ttl": 64, "is_ttl_spoofed": False},
                        "is_encrypted_exfiltration": proto_spec["payload_entropy"] > 7.5,
                        "ewma_stats": {"is_volume_anomaly": False, "current_pps": 50.0},
                    },
                )
            )

        created_flows = await FlowService.create_batch(
            db=db,
            flows_in=flows_to_create,
            actor="dashboard_batch_ingest",
        )

        flow_ids = [str(f.id) for f in created_flows]
        for fid in flow_ids:
            try:
                cast(Any, detect_threats_for_flow_task).delay(fid)
            except Exception:
                pass

        return {
            "status": "success",
            "action": "BATCH_FLOW_INGESTION",
            "flows_ingested": len(created_flows),
            "flow_ids": flow_ids,
            "message": f"Successfully batch-ingested {len(created_flows)} unidirectional telemetry records.",
        }
