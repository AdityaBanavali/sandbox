"""
Unit verification script for Cyber Defense Enclave models, audit hash chaining, and entropy calculations.
"""

import sys
from datetime import datetime, timezone
import uuid

from app.models import Base, Flow, Alert, MitreMapping, AuditLog, GENESIS_HASH
from app.services.audit_service import compute_record_hash, canonical_json
from app.services.flow_service import calculate_shannon_entropy
from app.schemas.flow import FlowCreate


def test_shannon_entropy():
    print("Testing Shannon entropy calculator...")
    # Low entropy (uniform single byte)
    zeros = b"\x00" * 100
    ent_zeros = calculate_shannon_entropy(zeros)
    assert ent_zeros == 0.0, f"Expected 0.0, got {ent_zeros}"

    # High entropy (simulated encrypted or random bytes)
    all_bytes = bytes(range(256))
    ent_all = calculate_shannon_entropy(all_bytes)
    assert 7.9 <= ent_all <= 8.0, f"Expected ~8.0, got {ent_all}"
    print(f"  Entropy checks passed! Zero byte entropy: {ent_zeros}, All byte entropy: {ent_all}")


def test_audit_hash_chain():
    print("Testing tamper-evident hash chaining...")
    now = datetime.now(timezone.utc)
    
    # Record 1 (Genesis predecessor)
    payload1 = {"action": "FLOW_INGESTED", "flow_id": str(uuid.uuid4())}
    hash1 = compute_record_hash(
        sequence_number=1,
        timestamp=now,
        action="FLOW_INGESTED",
        actor="system",
        previous_hash=GENESIS_HASH,
        payload=payload1,
    )
    assert len(hash1) == 64, f"Invalid SHA-256 hash length: {len(hash1)}"

    # Record 2 (Chained to Record 1)
    payload2 = {"action": "ALERT_GENERATED", "alert_id": str(uuid.uuid4())}
    hash2 = compute_record_hash(
        sequence_number=2,
        timestamp=now,
        action="ALERT_GENERATED",
        actor="ai_engine",
        previous_hash=hash1,
        payload=payload2,
    )

    # Verify tampering detection
    tampered_payload = {"action": "ALERT_GENERATED", "alert_id": "malicious_fake_id"}
    recomputed_tampered = compute_record_hash(
        sequence_number=2,
        timestamp=now,
        action="ALERT_GENERATED",
        actor="ai_engine",
        previous_hash=hash1,
        payload=tampered_payload,
    )
    assert recomputed_tampered != hash2, "Tampered payload should produce a different hash!"
    print(f"  Record 1 hash: {hash1[:16]}...")
    print(f"  Record 2 hash: {hash2[:16]}...")
    print("  Tampering detection verified successfully!")


def test_models_metadata():
    print("Testing SQLAlchemy models metadata registration...")
    table_names = list(Base.metadata.tables.keys())
    expected_tables = {"flows", "alerts", "mitre_mappings", "audit_logs"}
    assert expected_tables.issubset(set(table_names)), f"Missing tables! Found: {table_names}"
    print(f"  All expected tables found in Base.metadata: {table_names}")


def test_pydantic_flow_schema():
    print("Testing Pydantic schema validation...")
    flow_dict = {
        "src_ip": "192.168.1.100",
        "dst_ip": "10.0.0.50",
        "src_port": 54321,
        "dst_port": 443,
        "protocol": "TCP",
        "start_time": datetime.now(timezone.utc),
        "end_time": datetime.now(timezone.utc),
        "duration_ms": 120.5,
        "packet_count": 15,
        "byte_count": 4500,
        "packet_size_mean": 300.0,
        "packet_size_std": 25.0,
        "packet_size_min": 64.0,
        "packet_size_max": 1400.0,
        "iat_mean": 8.0,
        "iat_std": 1.2,
        "iat_min": 0.5,
        "iat_max": 15.0,
        "payload_entropy": 7.42,
        "features": {"tcp_flags": {"SYN": 1, "ACK": 14}},
    }
    schema = FlowCreate(**flow_dict)
    assert schema.src_ip == "192.168.1.100"
    assert schema.payload_entropy == 7.42
    print("  FlowCreate validation passed!")


if __name__ == "__main__":
    test_shannon_entropy()
    test_audit_hash_chain()
    test_models_metadata()
    test_pydantic_flow_schema()
    print("\nALL BACKEND VERIFICATION CHECKS PASSED!")
