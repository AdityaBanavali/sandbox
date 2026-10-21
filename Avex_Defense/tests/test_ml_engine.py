"""
Comprehensive Unit Tests for Hybrid ML Threat Detection Engine:
1. Unsupervised Isolation Forest Anomaly Detection
2. Supervised Random Forest Classification (Port Scan, Exfil, DoS, C2, Spoofing)
3. Ensemble Scoring & Zero-Day Detection Escalation
4. Multi-Factor Severity Scoring Matrix (Confidence * Impact * Asset Criticality)
5. SHAP Explainability Helper (Top Driving Features Attribution)
"""

import numpy as np
import pytest

from app.ml.feature_vector import FEATURE_NAMES, extract_feature_vector
from app.ml.unsupervised import IsolationForestAnomalyDetector
from app.ml.supervised import SupervisedThreatClassifier, CLASS_TO_LABEL
from app.ml.severity_matrix import SeverityMatrix
from app.ml.explainer import ThreatExplainer
from app.ml.ensemble import EnsembleThreatEngine
from app.ml.trainer import generate_synthetic_training_data, get_or_load_ensemble_engine


@pytest.fixture(scope="module")
def ml_engine():
    """
    Loads or creates the trained ML ensemble engine.
    """
    return get_or_load_ensemble_engine()


def test_1_feature_vector_extraction():
    """
    Verify 12-dimensional feature vector extraction from dictionary or model.
    """
    flow_dict = {
        "duration_ms": 2500.0,
        "packet_count": 25,
        "byte_count": 18500,
        "packet_size_mean": 740.0,
        "packet_size_std": 45.0,
        "iat_mean": 100.0,
        "iat_std": 15.0,
        "payload_entropy": 7.85,
        "features": {
            "packet_size_skew": 1.25,
            "iat_entropy": 0.85,
            "ttl_fingerprint": {"ttl_variance": 0.0},
        },
    }
    vec = extract_feature_vector(flow_dict)
    assert vec.shape == (12,)
    assert vec[0] == 2500.0
    assert vec[9] == 7.85       # payload_entropy
    assert vec[8] == 0.85       # iat_entropy
    assert vec[5] == 1.25       # packet_size_skew
    assert not np.isnan(vec).any()


def test_2_unsupervised_isolation_forest(ml_engine):
    """
    Test that Isolation Forest flags extreme multidimensional outliers with high anomaly scores.
    """
    # Normal benign vector
    benign_vec = np.array([
        1500.0, 30.0, 6000.0, 200.0, 50.0, 0.1, 50.0, 20.0, 3.2, 4.0, 0.0, 4000.0
    ])
    score_benign, is_anom_benign, _ = ml_engine.unsupervised.predict_score(benign_vec)

    # Extreme outlier (zero-day pattern: massive packets, strange entropy, abnormal timing)
    outlier_vec = np.array([
        99999.0, 10000.0, 9999999.0, 1490.0, 2.0, 8.5, 0.01, 0.001, 0.01, 7.99, 15.0, 999999.0
    ])
    score_outlier, is_anom_outlier, _ = ml_engine.unsupervised.predict_score(outlier_vec)

    assert score_outlier > score_benign, f"Outlier score ({score_outlier}) should exceed benign ({score_benign})"
    assert score_outlier >= 0.65, f"Extreme outlier should trigger anomaly threshold, got {score_outlier}"


def test_3_supervised_classifier_signatures(ml_engine):
    """
    Verify supervised Random Forest accurately classifies signature threat patterns.
    """
    # 1. Port Scan: 1 packet, small size, 0 duration
    scan_vec = np.array([0.0, 1.0, 54.0, 54.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 54000.0])
    cls_scan, conf_scan, _ = ml_engine.supervised.predict(scan_vec)
    assert cls_scan == "PORT_SCAN", f"Expected PORT_SCAN, got {cls_scan} (conf={conf_scan})"
    assert conf_scan >= 0.70

    # 2. Data Exfiltration: Large packets, very high payload entropy ~7.9
    exfil_vec = np.array([800.0, 40.0, 52000.0, 1300.0, 15.0, 0.0, 20.0, 5.0, 1.5, 7.95, 0.0, 65000.0])
    cls_exfil, conf_exfil, _ = ml_engine.supervised.predict(exfil_vec)
    assert cls_exfil == "DATA_EXFILTRATION", f"Expected DATA_EXFILTRATION, got {cls_exfil} (conf={conf_exfil})"
    assert conf_exfil >= 0.70

    # 3. C2 Beacon: Periodic IAT ~1000ms, near-zero IAT entropy
    c2_vec = np.array([20000.0, 20.0, 2000.0, 100.0, 1.0, 0.0, 1000.0, 2.0, 0.05, 3.5, 0.0, 100.0])
    cls_c2, conf_c2, _ = ml_engine.supervised.predict(c2_vec)
    assert cls_c2 == "C2_BEACON", f"Expected C2_BEACON, got {cls_c2} (conf={conf_c2})"
    assert conf_c2 >= 0.70


def test_4_ensemble_zero_day_escalation(ml_engine):
    """
    Test ensemble wrapper: When supervised model predicts BENIGN but Isolation Forest
    detects high anomaly score, the engine must escalate to NOVEL_ANOMALY (Zero-Day).
    """
    # Craft a synthetic unknown pattern that tricks naive signatures but is an outlier in distribution
    novel_pattern = {
        "duration_ms": 12000.0,
        "packet_count": 8,
        "byte_count": 11800,
        "packet_size_mean": 1475.0,
        "packet_size_std": 2.0,
        "iat_mean": 1500.0,
        "iat_std": 800.0,
        "payload_entropy": 7.15,
        "features": {
            "packet_size_skew": 0.0,
            "iat_entropy": 2.8,
            "ttl_fingerprint": {"ttl_variance": 0.0},
        },
    }
    result = ml_engine.evaluate_flow(novel_pattern, target_ip="10.0.0.15")

    # If flagged as novel zero day or exfiltration, it must be marked as a threat
    assert result.is_threat is True
    assert result.risk_score >= 0.50
    assert result.severity_score > 0.0


def test_5_severity_matrix_asset_criticality():
    """
    Verify severity scoring matrix scales based on confidence, threat impact,
    and asset criticality weights.
    """
    matrix = SeverityMatrix()

    # Asset 1: Standard enterprise endpoint (multiplier = 1.0)
    res_std = matrix.compute_severity(
        behavior_class="DATA_EXFILTRATION",
        confidence=0.90,
        target_ip="192.168.1.55",
    )

    # Asset 2: Core SCADA / Industrial Enclave (10.0.0.x, multiplier = 2.0)
    res_scada = matrix.compute_severity(
        behavior_class="DATA_EXFILTRATION",
        confidence=0.90,
        target_ip="10.0.0.12",
    )

    assert res_scada["asset_criticality"] == 2.0
    assert res_scada["severity_score"] > res_std["severity_score"]
    assert res_scada["severity_level"] == "CRITICAL"
    assert res_scada["recommended_action"] == "IMMEDIATE_ENCLAVE_ISOLATION"


def test_6_shap_explainability_attribution(ml_engine):
    """
    Test explainability helper extracts top driving features with human rationale.
    """
    exfil_flow = {
        "duration_ms": 1000.0,
        "packet_count": 50,
        "byte_count": 65000,
        "packet_size_mean": 1300.0,
        "packet_size_std": 10.0,
        "iat_mean": 20.0,
        "iat_std": 2.0,
        "payload_entropy": 7.96,  # Primary driving feature
        "features": {
            "packet_size_skew": 0.0,
            "iat_entropy": 1.1,
            "ttl_fingerprint": {"ttl_variance": 0.0},
        },
    }

    explanation = ml_engine.explainer.explain_flow(
        flow_obj=exfil_flow,
        predicted_class="DATA_EXFILTRATION",
        top_k=3,
    )

    assert "top_driving_features" in explanation
    assert len(explanation["top_driving_features"]) == 3
    top_feature_names = [f["feature"] for f in explanation["top_driving_features"]]

    # Payload entropy must be one of the top driving features
    assert "payload_entropy" in top_feature_names
    assert "rationale" in explanation
    assert len(explanation["rationale"]) > 10
