"""
Unsupervised Isolation Forest Anomaly Detector for Unidirectional IP Traffic.
Detects zero-day, novel, and stealthy anomalous flow behaviors without labeled ground truth.
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union, cast
import numpy as np
from sklearn.ensemble import IsolationForest

from app.ml.feature_vector import FEATURE_NAMES, extract_feature_vector


class IsolationForestAnomalyDetector:
    """
    Unsupervised Isolation Forest model detecting statistical anomalies in unidirectional network flows.
    Trained strictly on benign traffic; flags zero-day attacks and outlier behavior.
    """

    def __init__(
        self,
        n_estimators: int = 150,
        contamination: float = 0.08,
        random_state: int = 42,
        threshold: float = 0.65,
    ):
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state
        self.threshold = threshold

        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=cast(Any, self.contamination),
            random_state=self.random_state,
            n_jobs=1,
        )

        self.is_fitted: bool = False

    def fit(self, X: np.ndarray) -> "IsolationForestAnomalyDetector":
        """
        Fits the Isolation Forest on a feature matrix X of shape (N, 12).
        """
        if X.ndim == 1:
            X = X.reshape(1, -1)
        self.model.fit(X)
        self.is_fitted = True
        return self

    def predict_score(self, feature_vector: np.ndarray) -> Tuple[float, bool, float]:
        """
        Predicts normalized anomaly score for a single feature vector.
        Returns:
            (normalized_anomaly_score [0.0 - 1.0], is_anomaly [bool], raw_decision_score)
        """
        if not self.is_fitted:
            # Fallback heuristic if model not yet fitted
            return 0.0, False, 0.0

        if feature_vector.ndim == 1:
            feature_vector = feature_vector.reshape(1, -1)

        # decision_function returns negative values for outliers, positive for inliers
        raw_score = float(self.model.decision_function(feature_vector)[0])

        # Map decision score (-0.5 to +0.5 typically) to normalized [0.0, 1.0]
        # Invert such that more negative (outlier) -> higher anomaly score
        normalized_score = 1.0 / (1.0 + math.exp(raw_score * 8.0))
        normalized_score = round(float(np.clip(normalized_score, 0.0, 1.0)), 4)

        is_anomaly = normalized_score >= self.threshold
        return normalized_score, is_anomaly, round(raw_score, 4)

    def evaluate_flow(self, flow_obj: Any) -> Dict[str, Any]:
        """
        Evaluates an arbitrary flow model, schema, or dict and returns detection dictionary.
        """
        vec = extract_feature_vector(flow_obj)
        score, is_anomaly, raw = self.predict_score(vec)
        return {
            "model": "IsolationForest",
            "anomaly_score": score,
            "is_anomaly": is_anomaly,
            "raw_decision_score": raw,
            "threshold": self.threshold,
        }
