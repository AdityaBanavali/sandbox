"""
Model Training and Persistence Pipeline for ML Cyber Threat Detection Engine.
Generates representative unidirectional network telemetry datasets, trains the
unsupervised Isolation Forest and supervised Random Forest classifiers, and saves
artifacts to disk using joblib.
"""

import os
import random
from pathlib import Path
from typing import Optional, Tuple
import joblib
import numpy as np

from app.ml.feature_vector import FEATURE_NAMES
from app.ml.unsupervised import IsolationForestAnomalyDetector
from app.ml.supervised import SupervisedThreatClassifier, CLASS_TO_LABEL
from app.ml.severity_matrix import SeverityMatrix
from app.ml.explainer import ThreatExplainer
from app.ml.ensemble import EnsembleThreatEngine

SAVED_MODELS_DIR = Path(__file__).resolve().parent / "saved_models"


def generate_synthetic_training_data(
    n_benign: int = 1500,
    n_per_threat: int = 300,
    random_seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Synthesizes a realistic training dataset for unidirectional network flows.
    Features:
    [duration_ms, packet_count, byte_count, packet_size_mean, packet_size_std,
     packet_size_skew, iat_mean, iat_std, iat_entropy, payload_entropy,
     ttl_variance, bytes_per_second]
    """
    np.random.seed(random_seed)
    random.seed(random_seed)

    X_list = []
    y_list = []

    # -----------------------------------------------------------------------
    # 1. BENIGN FLOWS (Label 0)
    # Varied sizes, moderate IAT entropy, low payload entropy, zero/low TTL variance
    # -----------------------------------------------------------------------
    for _ in range(n_benign):
        dur = np.random.uniform(50.0, 5000.0)
        pkts = np.random.randint(5, 100)
        size_mean = np.random.uniform(80.0, 600.0)
        size_std = np.random.uniform(10.0, 150.0)
        size_skew = np.random.uniform(-0.5, 0.8)
        bytes_tot = pkts * size_mean
        iat_mean = dur / pkts
        iat_std = iat_mean * np.random.uniform(0.3, 1.2)
        iat_entropy = np.random.uniform(2.2, 3.8)      # High IAT entropy
        payload_entropy = np.random.uniform(2.5, 5.8)  # Modest entropy
        ttl_var = np.random.choice([0.0, 0.0, 0.0, 0.2])
        bps = bytes_tot / max(dur / 1000.0, 1e-4)

        X_list.append([
            dur, pkts, bytes_tot, size_mean, size_std, size_skew,
            iat_mean, iat_std, iat_entropy, payload_entropy, ttl_var, bps
        ])
        y_list.append(CLASS_TO_LABEL["BENIGN"])

    # -----------------------------------------------------------------------
    # 2. PORT SCAN (Label 1)
    # Short duration, 1-2 packets, small sizes (~54-64 bytes), low entropy
    # -----------------------------------------------------------------------
    for _ in range(n_per_threat):
        dur = np.random.uniform(0.0, 30.0)
        pkts = np.random.randint(1, 3)
        size_mean = np.random.uniform(50.0, 64.0)
        size_std = 0.0
        size_skew = 0.0
        bytes_tot = pkts * size_mean
        iat_mean = 0.0
        iat_std = 0.0
        iat_entropy = 0.0
        payload_entropy = 0.0
        ttl_var = 0.0
        bps = bytes_tot / max(dur / 1000.0, 1e-4)

        X_list.append([
            dur, pkts, bytes_tot, size_mean, size_std, size_skew,
            iat_mean, iat_std, iat_entropy, payload_entropy, ttl_var, bps
        ])
        y_list.append(CLASS_TO_LABEL["PORT_SCAN"])

    # -----------------------------------------------------------------------
    # 3. DATA EXFILTRATION (Label 2)
    # Large packets (MTU ~1200-1450), high payload entropy (> 7.4), large byte count
    # -----------------------------------------------------------------------
    for _ in range(n_per_threat):
        dur = np.random.uniform(200.0, 10000.0)
        pkts = np.random.randint(30, 250)
        size_mean = np.random.uniform(1100.0, 1450.0)
        size_std = np.random.uniform(5.0, 35.0)
        size_skew = np.random.uniform(-0.2, 0.2)
        bytes_tot = pkts * size_mean
        iat_mean = dur / pkts
        iat_std = iat_mean * np.random.uniform(0.1, 0.5)
        iat_entropy = np.random.uniform(1.2, 2.5)
        payload_entropy = np.random.uniform(7.4, 7.99)  # High entropy!
        ttl_var = 0.0
        bps = bytes_tot / max(dur / 1000.0, 1e-4)

        X_list.append([
            dur, pkts, bytes_tot, size_mean, size_std, size_skew,
            iat_mean, iat_std, iat_entropy, payload_entropy, ttl_var, bps
        ])
        y_list.append(CLASS_TO_LABEL["DATA_EXFILTRATION"])

    # -----------------------------------------------------------------------
    # 4. DOS BURST (Label 3)
    # Extreme packet rates (high BPS/PPS), rapid fire, small to medium packet size
    # -----------------------------------------------------------------------
    for _ in range(n_per_threat):
        dur = np.random.uniform(500.0, 2000.0)
        pkts = np.random.randint(300, 2000)
        size_mean = np.random.uniform(64.0, 300.0)
        size_std = np.random.uniform(5.0, 40.0)
        size_skew = np.random.uniform(-0.5, 0.5)
        bytes_tot = pkts * size_mean
        iat_mean = dur / pkts  # Very small IAT < 5ms
        iat_std = iat_mean * 0.2
        iat_entropy = np.random.uniform(0.5, 1.8)
        payload_entropy = np.random.uniform(1.0, 4.5)
        ttl_var = np.random.uniform(0.0, 1.5)
        bps = bytes_tot / max(dur / 1000.0, 1e-4)  # Extreme BPS

        X_list.append([
            dur, pkts, bytes_tot, size_mean, size_std, size_skew,
            iat_mean, iat_std, iat_entropy, payload_entropy, ttl_var, bps
        ])
        y_list.append(CLASS_TO_LABEL["DOS_BURST"])

    # -----------------------------------------------------------------------
    # 5. C2 BEACON (Label 4)
    # Fixed periodic intervals (e.g. 1000ms, 5000ms), low jitter, low IAT entropy
    # -----------------------------------------------------------------------
    for _ in range(n_per_threat):
        period = random.choice([500.0, 1000.0, 2000.0, 5000.0])
        pkts = np.random.randint(10, 40)
        dur = pkts * period
        size_mean = np.random.uniform(70.0, 150.0)
        size_std = np.random.uniform(0.0, 5.0)
        size_skew = 0.0
        bytes_tot = pkts * size_mean
        iat_mean = period
        iat_std = period * np.random.uniform(0.001, 0.03)  # Low jitter
        iat_entropy = np.random.uniform(0.0, 0.95)         # Very low IAT entropy!
        payload_entropy = np.random.uniform(3.0, 5.5)
        ttl_var = 0.0
        bps = bytes_tot / max(dur / 1000.0, 1e-4)

        X_list.append([
            dur, pkts, bytes_tot, size_mean, size_std, size_skew,
            iat_mean, iat_std, iat_entropy, payload_entropy, ttl_var, bps
        ])
        y_list.append(CLASS_TO_LABEL["C2_BEACON"])

    # -----------------------------------------------------------------------
    # 6. DEVICE SPOOF (Label 5)
    # High TTL variance (> 4.0) originating from single source
    # -----------------------------------------------------------------------
    for _ in range(n_per_threat):
        dur = np.random.uniform(100.0, 2000.0)
        pkts = np.random.randint(10, 50)
        size_mean = np.random.uniform(80.0, 400.0)
        size_std = np.random.uniform(10.0, 50.0)
        size_skew = 0.0
        bytes_tot = pkts * size_mean
        iat_mean = dur / pkts
        iat_std = iat_mean * 0.5
        iat_entropy = np.random.uniform(1.8, 3.0)
        payload_entropy = np.random.uniform(2.5, 5.0)
        ttl_var = np.random.uniform(5.0, 25.0)  # High TTL variance!
        bps = bytes_tot / max(dur / 1000.0, 1e-4)

        X_list.append([
            dur, pkts, bytes_tot, size_mean, size_std, size_skew,
            iat_mean, iat_std, iat_entropy, payload_entropy, ttl_var, bps
        ])
        y_list.append(CLASS_TO_LABEL["DEVICE_SPOOF"])

    X = np.array(X_list, dtype=np.float64)
    y = np.array(y_list, dtype=np.int64)
    return X, y


def train_and_save_models(save_dir: Optional[Path] = None) -> EnsembleThreatEngine:
    """
    Trains both Isolation Forest and Random Forest models and saves them to disk.
    """
    target_dir = save_dir or SAVED_MODELS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    print("[*] Generating synthetic unidirectional telemetry dataset...")
    X, y = generate_synthetic_training_data()
    print(f"[+] Dataset generated: {X.shape[0]} samples, {X.shape[1]} features.")

    # 1. Train Unsupervised Isolation Forest (on benign + small mix of all)
    print("[*] Training Unsupervised Isolation Forest Anomaly Detector...")
    unsup_detector = IsolationForestAnomalyDetector(n_estimators=150, contamination=0.08)
    unsup_detector.fit(X)

    # 2. Train Supervised Random Forest Classifier
    print("[*] Training Supervised Random Forest Classifier...")
    sup_classifier = SupervisedThreatClassifier(n_estimators=100, max_depth=8)
    sup_classifier.fit(X, y)

    # 3. Save artifacts
    unsup_path = target_dir / "isolation_forest.joblib"
    sup_path = target_dir / "random_forest.joblib"

    joblib.dump(unsup_detector, unsup_path)
    joblib.dump(sup_classifier, sup_path)
    print(f"[+] Models successfully saved to: {target_dir}")

    # Build ensemble
    explainer = ThreatExplainer(supervised_model=sup_classifier)
    ensemble = EnsembleThreatEngine(
        unsupervised_model=unsup_detector,
        supervised_model=sup_classifier,
        severity_matrix=SeverityMatrix(),
        explainer=explainer,
    )
    return ensemble


# Singleton global engine instance
_global_engine: Optional[EnsembleThreatEngine] = None


def get_or_load_ensemble_engine() -> EnsembleThreatEngine:
    """
    Returns or loads the cached EnsembleThreatEngine.
    If models do not exist on disk, trains and persists them automatically.
    """
    global _global_engine
    if _global_engine is not None:
        return _global_engine

    unsup_path = SAVED_MODELS_DIR / "isolation_forest.joblib"
    sup_path = SAVED_MODELS_DIR / "random_forest.joblib"

    if unsup_path.exists() and sup_path.exists():
        try:
            unsup = joblib.load(unsup_path)
            sup = joblib.load(sup_path)
            explainer = ThreatExplainer(supervised_model=sup)
            _global_engine = EnsembleThreatEngine(
                unsupervised_model=unsup,
                supervised_model=sup,
                severity_matrix=SeverityMatrix(),
                explainer=explainer,
            )
            return _global_engine
        except Exception:
            pass

    # Train and save if not present
    _global_engine = train_and_save_models()
    return _global_engine


if __name__ == "__main__":
    train_and_save_models()

