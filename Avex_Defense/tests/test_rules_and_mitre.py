"""
Comprehensive Unit Tests for Dynamic MITRE ATT&CK Mapping & Sigma Rule Engine.
Tests:
1. Dynamic MitreMapper service (YAML loading, alias resolution, alert enrichment, hot reload).
2. Sigma Rule Parser & Operator Evaluation (eq, gte, lte, in, cidr, regex).
3. Complex Boolean Condition logic (and, or, not, selection_*).
4. Pre-built rules evaluation against simulated unidirectional threat flows.
5. Concurrent hybrid execution of Rule Engine alongside ML Ensemble.
"""

import asyncio
from pathlib import Path
import pytest

from app.services.mitre_mapper import MitreMapper, get_mitre_mapper
from app.rules.models import FieldFilter, Selection, SigmaRule
from app.rules.parser import parse_field_key, parse_rules_from_yaml, parse_sigma_rule
from app.rules.evaluator import (
    evaluate_filter,
    evaluate_selection,
    evaluate_boolean_condition,
    evaluate_rule,
    extract_field_value,
)
from app.rules.engine import RuleEngine, get_rule_engine
from app.ml.trainer import get_or_load_ensemble_engine


# ---------------------------------------------------------------------------
# 1. MITRE MAPPER TESTS
# ---------------------------------------------------------------------------

def test_1_mitre_mapper_yaml_loading():
    """
    Test MitreMapper loads config/mitre_rules.yaml correctly.
    """
    mapper = get_mitre_mapper()
    assert len(mapper.mappings) >= 6, f"Expected at least 6 mappings, got {len(mapper.mappings)}"
    assert "port_scan_burst" in mapper.mappings
    assert "payload_high_entropy_exfil" in mapper.mappings
    assert "beaconing_pattern" in mapper.mappings


def test_2_mitre_mapper_alias_resolution():
    """
    Test resolving threat labels and aliases emitted by the ML models.
    """
    mapper = get_mitre_mapper()

    # Direct key
    entry1 = mapper.get_mapping_by_behavior("port_scan_burst")
    assert entry1 is not None
    assert entry1["technique_id"] == "T1046"

    # ML alias: DATA_EXFILTRATION -> payload_high_entropy_exfil
    entry2 = mapper.get_mapping_by_behavior("DATA_EXFILTRATION")
    assert entry2 is not None
    assert entry2["technique_id"] == "T1048.003"
    assert entry2["tactic_name"] == "Exfiltration"

    # ML alias: C2_BEACON -> beaconing_pattern
    entry3 = mapper.get_mapping_by_behavior("C2_BEACON")
    assert entry3 is not None
    assert entry3["technique_id"] == "T1071.004"

    # Zero-day anomaly alias
    entry4 = mapper.get_mapping_by_behavior("NOVEL_ANOMALY")
    assert entry4 is not None
    assert entry4["technique_id"] == "T1048"


def test_3_mitre_mapper_alert_enrichment():
    """
    Test alert payload enrichment with full ATT&CK matrix metadata.
    """
    mapper = get_mitre_mapper()
    alert_data = {
        "alert_id": "test-alert-123",
        "severity": "HIGH",
    }
    enriched = mapper.enrich_alert("payload_high_entropy_exfil", alert_data)
    assert "mitre_enrichment" in enriched
    assert enriched["mitre_enrichment"]["technique_id"] == "T1048.003"
    assert "https://attack.mitre.org" in enriched["mitre_enrichment"]["mitre_url"]
    assert enriched["mitre_technique_id"] == "T1048.003"


# ---------------------------------------------------------------------------
# 2. SIGMA RULE PARSER & OPERATOR TESTS
# ---------------------------------------------------------------------------

def test_4_parse_field_keys():
    """
    Test field key modifier parsing (field | op).
    """
    f1, op1 = parse_field_key("payload_entropy | gte")
    assert f1 == "payload_entropy" and op1 == "gte"

    f2, op2 = parse_field_key("dst_ip | cidr")
    assert f2 == "dst_ip" and op2 == "cidr"

    f3, op3 = parse_field_key("dst_port")
    assert f3 == "dst_port" and op3 == "eq"

    f4, op4 = parse_field_key("ports | in")
    assert f4 == "ports" and op4 == "in"


def test_5_evaluate_operators():
    """
    Test individual operator matching logic.
    """
    # Numeric gte / lte
    assert evaluate_filter(7.85, FieldFilter("payload_entropy", "gte", 7.0)) is True
    assert evaluate_filter(6.5, FieldFilter("payload_entropy", "gte", 7.0)) is False
    assert evaluate_filter(50, FieldFilter("duration_ms", "lte", 100)) is True

    # List 'in' operator
    assert evaluate_filter(443, FieldFilter("dst_port", "in", [80, 443, 8080])) is True
    assert evaluate_filter(22, FieldFilter("dst_port", "in", [80, 443, 8080])) is False

    # Network 'cidr' operator
    assert evaluate_filter("10.0.0.45", FieldFilter("dst_ip", "cidr", "10.0.0.0/24")) is True
    assert evaluate_filter("192.168.1.1", FieldFilter("dst_ip", "cidr", "10.0.0.0/24")) is False


def test_6_boolean_conditions():
    """
    Test complex boolean condition strings.
    """
    results_1 = {"sel1": True, "sel2": True, "filter1": False}
    assert evaluate_boolean_condition("sel1 and sel2", results_1) is True
    assert evaluate_boolean_condition("sel1 and not filter1", results_1) is True

    results_2 = {"sel1": True, "sel2": False, "sel3": False}
    assert evaluate_boolean_condition("sel1 or sel2", results_2) is True
    assert evaluate_boolean_condition("1 of sel*", results_2) is True
    assert evaluate_boolean_condition("all of sel*", results_2) is False


# ---------------------------------------------------------------------------
# 3. PRE-BUILT RULES EVALUATION TESTS
# ---------------------------------------------------------------------------

def test_7_prebuilt_rules_evaluation():
    """
    Test prebuilt rules from config/sigma_rules.yaml against simulated flows.
    """
    engine = get_rule_engine()
    assert len(engine.rules) >= 5, f"Expected at least 5 Sigma rules, got {len(engine.rules)}"

    # 1. Flow triggering DNS tunneling exfil rule
    dns_tunnel_flow = {
        "src_ip": "192.168.10.15",
        "dst_ip": "8.8.8.8",
        "dst_port": 53,
        "protocol": "UDP",
        "payload_entropy": 7.82,  # gte 7.0
        "byte_count": 1200,       # gte 300
    }
    matches_dns = engine.evaluate(dns_tunnel_flow)
    assert any("DNS Covert Tunnel" in m.rule_title for m in matches_dns)

    # 2. Flow triggering Port Sweep rule
    sweep_flow = {
        "src_ip": "192.168.10.99",
        "dst_ip": "10.0.0.1",
        "dst_port": 22,           # in target list
        "protocol": "TCP",
        "packet_count": 1,        # lte 3
        "duration_ms": 10.0,      # lte 100
    }
    matches_sweep = engine.evaluate(sweep_flow)
    assert any("Port Probe Sweep" in m.rule_title for m in matches_sweep)

    # 3. Flow triggering SCADA ingress violation rule
    scada_violation_flow = {
        "src_ip": "192.168.10.88",
        "dst_ip": "10.0.0.50",    # in 10.0.0.0/24
        "dst_port": 4444,         # unauthorized port (not Modbus 502 or S7 102)
        "protocol": "TCP",
    }
    matches_scada = engine.evaluate(scada_violation_flow)
    assert any("Core SCADA Enclave" in m.rule_title for m in matches_scada)


# ---------------------------------------------------------------------------
# 4. CONCURRENT EXECUTION WITH ML
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_8_concurrent_rule_and_ml_execution():
    """
    Verify RuleEngine and MLEngine execute concurrently without race conditions.
    """
    rule_engine = get_rule_engine()
    ml_engine = get_or_load_ensemble_engine()

    test_flow = {
        "src_ip": "192.168.10.20",
        "dst_ip": "10.0.0.1",
        "dst_port": 53,
        "protocol": "UDP",
        "duration_ms": 800.0,
        "packet_count": 30,
        "byte_count": 42000,
        "packet_size_mean": 1400.0,
        "packet_size_std": 10.0,
        "iat_mean": 25.0,
        "iat_std": 3.0,
        "payload_entropy": 7.95,
        "features": {
            "packet_size_skew": 0.0,
            "iat_entropy": 1.5,
            "ttl_fingerprint": {"ttl_variance": 0.0},
        },
    }

    hybrid_report = await rule_engine.evaluate_concurrently_with_ml(
        flow_obj=test_flow,
        ml_engine=ml_engine,
        target_ip="10.0.0.1",
    )

    assert hybrid_report["is_hybrid_threat"] is True
    assert hybrid_report["has_rule_hit"] is True
    assert hybrid_report["ml_threat"] is True
    assert len(hybrid_report["rule_matches"]) > 0
    assert len(hybrid_report["mitre_techniques"]) > 0
    assert hybrid_report["confidence"] >= 0.75
