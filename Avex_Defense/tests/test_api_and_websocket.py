"""
Comprehensive Unit and Integration Tests for:
1. Historical flow querying with multi-parameter filtering and stats summary.
2. Threat alerts filtering by MITRE tactics/techniques and aggregate alert statistics.
3. MITRE tactics grouped overview and alerts-by-tactic queries.
4. System health and comprehensive operational telemetry metrics (CPU/RAM/Disk/DB/Redis).
5. Real-time WebSocket gateway with client filters, ping/pong heartbeats, and alert push.
6. Forensic-grade dual-storage cryptographic hash-chained audit ledger with tamper detection.
"""

import asyncio
from datetime import datetime, timezone, timedelta
import json
import os
import tempfile
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import get_async_session
from app.core.websocket import ws_manager
from app.models.base import Base
from app.models.flow import Flow
from app.models.alert import Alert
from app.models.mitre import MitreMapping
from app.models.audit import AuditLog
from app.services.audit_service import AuditService, compute_record_hash, GENESIS_HASH
from app.services.mitre_service import MitreService, DEFAULT_UNIDIRECTIONAL_TECHNIQUES


# ---------------------------------------------------------------------------
# Test Fixtures & Setup
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def sqlite_engine():
    """
    Creates an isolated SQLite async engine for test execution.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async def init_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_tables())
    yield engine
    asyncio.run(engine.dispose())


@pytest.fixture(scope="module")
def test_client(sqlite_engine):
    """
    Configures FastAPI TestClient with database session dependency override.
    """
    session_factory = async_sessionmaker(sqlite_engine, expire_on_commit=False, class_=AsyncSession)

    async def override_session():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_async_session] = override_session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Historical Flows Querying & Statistics Tests
# ---------------------------------------------------------------------------

def test_1_historical_flows_queries_and_stats(test_client):
    """
    Tests historical flow ingestion, multi-parameter filtering, and stats summary.
    """
    now = datetime.now(timezone.utc)

    # Ingest 3 distinct test flows
    flow1_payload = {
        "src_ip": "192.168.1.10",
        "dst_ip": "10.0.0.5",
        "src_port": 40001,
        "dst_port": 53,
        "protocol": "UDP",
        "start_time": (now - timedelta(minutes=15)).isoformat(),
        "end_time": (now - timedelta(minutes=14)).isoformat(),
        "duration_ms": 60000.0,
        "packet_count": 50,
        "byte_count": 15000,
        "packet_size_mean": 300.0,
        "packet_size_std": 20.0,
        "packet_size_min": 64.0,
        "packet_size_max": 512.0,
        "iat_mean": 1200.0,
        "iat_std": 100.0,
        "iat_min": 50.0,
        "iat_max": 2500.0,
        "payload_entropy": 7.85,
    }

    flow2_payload = {
        "src_ip": "192.168.1.20",
        "dst_ip": "10.0.0.8",
        "src_port": 45000,
        "dst_port": 80,
        "protocol": "TCP",
        "start_time": (now - timedelta(minutes=10)).isoformat(),
        "end_time": (now - timedelta(minutes=9)).isoformat(),
        "duration_ms": 60000.0,
        "packet_count": 20,
        "byte_count": 4000,
        "packet_size_mean": 200.0,
        "packet_size_std": 10.0,
        "packet_size_min": 64.0,
        "packet_size_max": 400.0,
        "iat_mean": 3000.0,
        "iat_std": 200.0,
        "iat_min": 100.0,
        "iat_max": 5000.0,
        "payload_entropy": 2.1,
    }

    res1 = test_client.post("/api/v1/flows/ingest", json=flow1_payload)
    assert res1.status_code == 201
    f1_id = res1.json()["id"]

    res2 = test_client.post("/api/v1/flows/ingest", json=flow2_payload)
    assert res2.status_code == 201

    # Query 1: Filter by protocol
    r_proto = test_client.get("/api/v1/flows?protocol=UDP")
    assert r_proto.status_code == 200
    assert "X-Total-Count" in r_proto.headers
    assert int(r_proto.headers["X-Total-Count"]) >= 1
    items = r_proto.json()
    assert all(item["protocol"] == "UDP" for item in items)

    # Query 2: Filter by high entropy
    r_ent = test_client.get("/api/v1/flows?min_entropy=7.0")
    assert r_ent.status_code == 200
    assert int(r_ent.headers["X-Total-Count"]) >= 1
    items_ent = r_ent.json()
    assert all(item["payload_entropy"] >= 7.0 for item in items_ent)

    # Query 3: Lookup specific flow by UUID
    r_single = test_client.get(f"/api/v1/flows/{f1_id}")
    assert r_single.status_code == 200
    assert r_single.json()["src_ip"] == "192.168.1.10"

    # Query 4: Traffic summary statistics
    r_stats = test_client.get("/api/v1/flows/stats/summary")
    assert r_stats.status_code == 200
    stats = r_stats.json()
    assert stats["total_flows"] >= 2
    assert stats["total_packets"] >= 70
    assert stats["total_bytes"] >= 19000
    assert "UDP" in stats["by_protocol"]
    assert "TCP" in stats["by_protocol"]
    assert len(stats["top_source_ips"]) >= 1


# ---------------------------------------------------------------------------
# 2. Alerts & MITRE Tactics Filtering Tests
# ---------------------------------------------------------------------------

def test_2_alerts_filtering_and_mitre_tactics(test_client):
    """
    Tests seeding MITRE techniques, creating alerts, and filtering by MITRE tactics.
    """
    # Seed default techniques
    seed_res = test_client.post("/api/v1/mitre/seed")
    assert seed_res.status_code == 200

    # Retrieve seeded techniques to get IDs
    mitre_res = test_client.get("/api/v1/mitre")
    assert mitre_res.status_code == 200
    techniques = {t["technique_id"]: t["id"] for t in mitre_res.json()}
    assert "T1046" in techniques
    assert "T1048.003" in techniques

    # Fetch or create an existing flow ID
    flows = test_client.get("/api/v1/flows").json()
    if not flows:
        f_resp = test_client.post(
            "/api/v1/flows/ingest",
            json={
                "src_ip": "192.168.1.10",
                "dst_ip": "10.0.0.5",
                "src_port": 40001,
                "dst_port": 53,
                "protocol": "UDP",
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": datetime.now(timezone.utc).isoformat(),
                "duration_ms": 1000.0,
                "packet_count": 10,
                "byte_count": 500,
                "packet_size_mean": 50.0,
                "packet_size_std": 5.0,
                "packet_size_min": 40.0,
                "packet_size_max": 60.0,
                "iat_mean_ms": 100.0,
                "iat_std_ms": 10.0,
                "iat_entropy": 3.0,
                "payload_entropy": 2.5,
                "ttl_mean": 64.0,
                "ttl_variance": 0.0,
                "tcp_syn_ratio": 0.0,
                "tcp_rst_ratio": 0.0,
                "ewma_byte_rate": 500.0,
                "ewma_packet_rate": 10.0,
            },
        )
        flow_id = f_resp.json()["id"]
    else:
        flow_id = flows[0]["id"]

    # Create Alert 1: Discovery (T1046)
    alert1_payload = {
        "flow_id": flow_id,
        "mitre_mapping_id": techniques["T1046"],
        "severity": "HIGH",
        "severity_score": 7.5,
        "confidence": 0.88,
        "behavior_class": "Unidirectional SYN Sweep",
        "status": "NEW",
        "model_version": "v1.0.0",
        "explanation": {"packet_count": 50},
    }
    r_a1 = test_client.post("/api/v1/alerts", json=alert1_payload)
    assert r_a1.status_code == 201
    a1_id = r_a1.json()["id"]

    # Create Alert 2: Exfiltration (T1048.003)
    alert2_payload = {
        "flow_id": flow_id,
        "mitre_mapping_id": techniques["T1048.003"],
        "severity": "CRITICAL",
        "severity_score": 9.2,
        "confidence": 0.95,
        "behavior_class": "Encrypted Payload Exfiltration",
        "status": "INVESTIGATING",
        "model_version": "v1.0.0",
        "explanation": {"payload_entropy": 7.9},
    }
    r_a2 = test_client.post("/api/v1/alerts", json=alert2_payload)
    assert r_a2.status_code == 201

    # Filter by MITRE tactic: Discovery
    r_disc = test_client.get("/api/v1/alerts?tactic=Discovery")
    assert r_disc.status_code == 200
    items_disc = r_disc.json()
    assert len(items_disc) >= 1
    assert any(a["id"] == a1_id for a in items_disc)
    assert all(a["mitre_mapping"]["tactic_name"] == "Discovery" for a in items_disc if a.get("mitre_mapping"))

    # Filter by Severity: CRITICAL
    r_crit = test_client.get("/api/v1/alerts?severity=CRITICAL")
    assert r_crit.status_code == 200
    items_crit = r_crit.json()
    assert len(items_crit) >= 1
    assert all(a["severity"] == "CRITICAL" for a in items_crit)

    # Triage update
    r_patch = test_client.patch(f"/api/v1/alerts/{a1_id}", json={"status": "RESOLVED"})
    assert r_patch.status_code == 200
    assert r_patch.json()["status"] == "RESOLVED"

    # Alert stats summary
    r_sum = test_client.get("/api/v1/alerts/stats/summary")
    assert r_sum.status_code == 200
    stats = r_sum.json()
    assert stats["total_alerts"] >= 2
    assert "CRITICAL" in stats["by_severity"]
    assert "Discovery" in stats["by_mitre_tactic"]
    assert len(stats["top_techniques"]) >= 1


# ---------------------------------------------------------------------------
# 3. MITRE Tactics Endpoints
# ---------------------------------------------------------------------------

def test_3_mitre_tactics_overview_and_endpoints(test_client):
    """
    Tests /api/v1/mitre/tactics overview and /api/v1/mitre/tactics/{tactic_name}/alerts.
    """
    # Tactics overview
    r_tactics = test_client.get("/api/v1/mitre/tactics")
    assert r_tactics.status_code == 200
    tactics = r_tactics.json()
    assert len(tactics) >= 3
    tactic_names = [t["tactic_name"] for t in tactics]
    assert "Discovery" in tactic_names
    assert "Exfiltration" in tactic_names

    # Specific tactic alerts query
    r_tactic_alerts = test_client.get("/api/v1/mitre/tactics/Discovery/alerts")
    assert r_tactic_alerts.status_code == 200
    assert "X-Total-Count" in r_tactic_alerts.headers
    alerts = r_tactic_alerts.json()
    assert len(alerts) >= 1
    assert any("SYN Sweep" in a["behavior_class"] for a in alerts)


# ---------------------------------------------------------------------------
# 4. System Health & Operational Telemetry Metrics
# ---------------------------------------------------------------------------

def test_4_system_health_and_metrics(test_client):
    """
    Tests basic liveness, readiness, and /api/v1/health/metrics.
    """
    # Liveness
    r_live = test_client.get("/api/v1/health")
    assert r_live.status_code == 200
    assert r_live.json()["status"] == "ok"

    # Readiness
    r_ready = test_client.get("/api/v1/health/ready")
    assert r_ready.status_code == 200

    # Operational metrics
    r_metrics = test_client.get("/api/v1/health/metrics")
    assert r_metrics.status_code == 200
    data = r_metrics.json()
    assert "host_resources" in data
    assert "cpu_percent" in data["host_resources"]
    assert "memory" in data["host_resources"]
    assert "disk" in data["host_resources"]
    assert "detection_engine" in data
    assert data["detection_engine"]["active_sigma_rules"] >= 6
    assert "IsolationForest" in data["detection_engine"]["ml_models"]
    assert "database" in data
    assert "records" in data["database"]
    assert data["database"]["records"]["flows"] >= 2


# ---------------------------------------------------------------------------
# 5. Real-Time WebSocket Gateway & Filter Reconfiguration
# ---------------------------------------------------------------------------

def test_5_websocket_gateway_lifecycle_and_filters(test_client):
    """
    Tests WebSocket handshake, ping/pong heartbeats, dynamic filter updates, and status report.
    """
    cid = f"test-dash-{uuid.uuid4().hex[:6]}"
    with test_client.websocket_connect(f"/api/v1/ws/alerts?client_id={cid}&min_severity=HIGH&tactic=Discovery") as ws:
        # Handshake verification
        greeting = ws.receive_json()
        assert greeting["event"] == "CONNECTED"
        assert greeting["client_id"] == cid
        assert greeting["active_filters"]["min_severity"] == "HIGH"
        assert "discovery" in greeting["active_filters"]["tactics"]

        # Ping / Pong heartbeat
        ws.send_json({"action": "ping", "timestamp": 12345})
        pong = ws.receive_json()
        assert pong["event"] == "PONG"
        assert pong["timestamp"] == 12345

        # Dynamic filter update
        ws.send_json({
            "action": "set_filter",
            "min_severity": "CRITICAL",
            "tactics": ["Exfiltration"],
        })
        filter_ack = ws.receive_json()
        assert filter_ack["event"] == "FILTER_UPDATED"
        assert filter_ack["active_filters"]["min_severity"] == "CRITICAL"
        assert "exfiltration" in filter_ack["active_filters"]["tactics"]

        # Query client status frame
        ws.send_json({"action": "status"})
        client_status = ws.receive_json()
        assert client_status["event"] == "CLIENT_STATUS"
        assert client_status["min_severity"] == "CRITICAL"

        # Check HTTP status endpoint while client is connected
        r_status = test_client.get("/api/v1/ws/status")
        assert r_status.status_code == 200
        ws_info = r_status.json()
        assert ws_info["active_connections"] >= 1
        assert any(c["client_id"] == cid for c in ws_info["subscribed_clients"])

    # Disconnected cleanup
    r_after = test_client.get("/api/v1/ws/status")
    assert r_after.status_code == 200
    assert not any(c["client_id"] == cid for c in r_after.json()["subscribed_clients"])


# ---------------------------------------------------------------------------
# 6. WebSocket Real-Time Push & Client Severity Filtering
# ---------------------------------------------------------------------------

def test_6_websocket_realtime_alert_push_and_filtering(test_client):
    """
    Validates that real-time alerts pushed via create_alert() are broadcast
    instantly to connected WebSockets and respect client severity thresholds.
    """
    flows = test_client.get("/api/v1/flows").json()
    flow_id = flows[0]["id"]

    # Connect client with min_severity=CRITICAL
    with test_client.websocket_connect("/api/v1/ws/alerts?client_id=ws-crit-only&min_severity=CRITICAL") as ws_crit:
        ws_crit.receive_json()  # Consume CONNECTED

        # Connect second client with min_severity=LOW
        with test_client.websocket_connect("/api/v1/ws/alerts?client_id=ws-all-sevs&min_severity=LOW") as ws_all:
            ws_all.receive_json()  # Consume CONNECTED

            # Trigger a MEDIUM alert
            medium_alert_payload = {
                "flow_id": flow_id,
                "severity": "MEDIUM",
                "severity_score": 4.5,
                "confidence": 0.72,
                "behavior_class": "Suspicious Port Burst",
                "status": "NEW",
                "model_version": "v1.0.0",
                "explanation": {},
            }
            test_client.post("/api/v1/alerts", json=medium_alert_payload)

            # ws_all must receive it
            msg_medium = ws_all.receive_json()
            assert msg_medium["event"] == "NEW_ALERT"
            assert msg_medium["severity"] == "MEDIUM"

            # Trigger a CRITICAL alert
            crit_alert_payload = {
                "flow_id": flow_id,
                "severity": "CRITICAL",
                "severity_score": 9.8,
                "confidence": 0.99,
                "behavior_class": "Data Exfiltration Breach",
                "status": "NEW",
                "model_version": "v1.0.0",
                "explanation": {},
            }
            test_client.post("/api/v1/alerts", json=crit_alert_payload)

            # Both clients must receive the CRITICAL alert
            msg_crit_1 = ws_crit.receive_json()
            assert msg_crit_1["event"] == "NEW_ALERT"
            assert msg_crit_1["severity"] == "CRITICAL"

            msg_crit_2 = ws_all.receive_json()
            assert msg_crit_2["event"] == "NEW_ALERT"
            assert msg_crit_2["severity"] == "CRITICAL"


# ---------------------------------------------------------------------------
# 7. Forensic Dual-Storage Cryptographic Audit Ledger & Tamper Detection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_7_forensic_audit_ledger_dual_storage_and_tampering():
    """
    Tests forensic-grade dual ledger (PostgreSQL/DB + physical append-only flat file),
    chain recalculation, cross-consistency verification, and tampering detection.
    """
    isolated_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with isolated_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(isolated_engine, expire_on_commit=False, class_=AsyncSession)

    # Use a dedicated temporary file for isolated test ledger
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tmp:
        temp_ledger_path = tmp.name

    try:
        async with session_factory() as session:
            # 1. Append 3 chained incident events
            await AuditService.append_async(
                db=session,
                action="SYSTEM_INITIALIZED",
                record_payload={"node_id": "diode-tap-01", "firmware": "2.4.1"},
                actor="bootstrap_daemon",
                file_path=temp_ledger_path,
            )

            await AuditService.append_async(
                db=session,
                action="ALERT_TRIGGERED",
                record_payload={"alert_id": str(uuid.uuid4()), "severity": "HIGH", "tactic": "Discovery"},
                actor="ml_engine",
                file_path=temp_ledger_path,
            )

            await AuditService.append_async(
                db=session,
                action="INCIDENT_CONTAINED",
                record_payload={"incident_id": "INC-2026-001", "action_taken": "diode_gate_closed"},
                actor="secops_lead",
                file_path=temp_ledger_path,
            )
            await session.commit()

            # 2. Verify database cryptographic chain
            db_valid, db_count, bad_seq, head_h, msg = await AuditService.verify_chain_async(db=session)
            assert db_valid is True, f"DB chain failed: {msg}"
            assert db_count >= 3
            assert head_h is not None

            # 3. Verify physical flat file ledger
            file_valid, file_count, file_bad_seq, file_head, file_msg = AuditService.verify_file_ledger(
                file_path=temp_ledger_path
            )
            assert file_valid is True, f"File ledger verification failed: {file_msg}"
            assert file_count == 3
            assert file_head == head_h, "File head hash must match DB head hash!"

            # 4. Cross-verify dual storage parity
            cross_valid, matched, cross_msg = await AuditService.verify_cross_consistency(
                db=session,
                file_path=temp_ledger_path,
            )
            assert cross_valid is True, f"Cross-consistency failed: {cross_msg}"
            assert matched == 3

        # 5. Tamper-evident test: deliberately tamper with sequence 2 in the physical file
        with open(temp_ledger_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        assert len(lines) == 3
        tampered_record = json.loads(lines[1])
        # Maliciously alter the payload without updating the cryptographic hash
        tampered_record["record_payload"]["severity"] = "LOW_FAKE_ALTERED"
        lines[1] = json.dumps(tampered_record) + "\n"

        with open(temp_ledger_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

        # 6. Verify that tampering is immediately caught at sequence 2!
        tamper_valid, t_count, tampered_seq, _, t_msg = AuditService.verify_file_ledger(
            file_path=temp_ledger_path
        )
        assert tamper_valid is False, "Verification MUST fail on tampered record!"
        assert tampered_seq == 2, f"Expected tampering detected at seq 2, got {tampered_seq}"
        assert "cryptographic hash recalculation mismatch" in t_msg

    finally:
        await isolated_engine.dispose()
        if os.path.exists(temp_ledger_path):
            os.remove(temp_ledger_path)
