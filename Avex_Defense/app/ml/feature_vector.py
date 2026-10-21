"""
Feature Vector Extraction and Normalization for ML Detection Engine.
Extracts a standard, fixed-dimension numerical feature vector from unidirectional flow telemetry.
"""

from typing import Any, Dict, List, Union
import numpy as np

# Standard feature names in exact deterministic order
FEATURE_NAMES: List[str] = [
    "duration_ms",
    "packet_count",
    "byte_count",
    "packet_size_mean",
    "packet_size_std",
    "packet_size_skew",
    "iat_mean",
    "iat_std",
    "iat_entropy",
    "payload_entropy",
    "ttl_variance",
    "bytes_per_second",
]


def extract_feature_vector(flow_obj: Union[Dict[str, Any], Any]) -> np.ndarray:
    """
    Extracts a 1D numpy float64 array of shape (12,) from a Flow ORM model,
    FlowCreate schema, or flow dictionary.
    """
    if isinstance(flow_obj, dict):
        d = flow_obj
        features_dict = d.get("features") or {}
    else:
        d = {
            "duration_ms": getattr(flow_obj, "duration_ms", 0.0),
            "packet_count": getattr(flow_obj, "packet_count", 1),
            "byte_count": getattr(flow_obj, "byte_count", 0),
            "packet_size_mean": getattr(flow_obj, "packet_size_mean", 0.0),
            "packet_size_std": getattr(flow_obj, "packet_size_std", 0.0),
            "iat_mean": getattr(flow_obj, "iat_mean", 0.0),
            "iat_std": getattr(flow_obj, "iat_std", 0.0),
            "payload_entropy": getattr(flow_obj, "payload_entropy", 0.0),
        }
        features_dict = getattr(flow_obj, "features", {}) or {}

    duration_ms = float(d.get("duration_ms", 0.0) or 0.0)
    packet_count = float(d.get("packet_count", 1) or 1)
    byte_count = float(d.get("byte_count", 0) or 0)
    packet_size_mean = float(d.get("packet_size_mean", 0.0) or 0.0)
    packet_size_std = float(d.get("packet_size_std", 0.0) or 0.0)
    iat_mean = float(d.get("iat_mean", 0.0) or 0.0)
    iat_std = float(d.get("iat_std", 0.0) or 0.0)
    payload_entropy = float(d.get("payload_entropy", 0.0) or 0.0)

    # Nested fields in features
    packet_size_skew = float(features_dict.get("packet_size_skew", 0.0) or 0.0)
    iat_entropy = float(features_dict.get("iat_entropy", 0.0) or 0.0)

    ttl_fingerprint = features_dict.get("ttl_fingerprint") or {}
    ttl_variance = float(ttl_fingerprint.get("ttl_variance", 0.0) or 0.0)

    # Calculate bytes per second
    dur_sec = max(duration_ms / 1000.0, 1e-4)
    bytes_per_second = byte_count / dur_sec

    vec = np.array([
        duration_ms,
        packet_count,
        byte_count,
        packet_size_mean,
        packet_size_std,
        packet_size_skew,
        iat_mean,
        iat_std,
        iat_entropy,
        payload_entropy,
        ttl_variance,
        bytes_per_second,
    ], dtype=np.float64)

    # Replace NaNs or Infs with zero
    return np.nan_to_num(vec, nan=0.0, posinf=1e9, neginf=-1e9)


def extract_batch_features(flows: List[Any]) -> np.ndarray:
    """
    Extracts a 2D numpy array of shape (N, 12) from a batch of flow objects.
    """
    if not flows:
        return np.empty((0, len(FEATURE_NAMES)), dtype=np.float64)
    return np.vstack([extract_feature_vector(f) for f in flows])
