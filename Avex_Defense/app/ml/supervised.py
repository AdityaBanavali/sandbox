"""
Supervised Threat Classifier for Unidirectional IP Network Telemetry.
Lightweight Random Forest classifier trained on signature-style attack behaviors:
- BENIGN
- PORT_SCAN (MITRE T1046)
- DATA_EXFILTRATION (MITRE T1048.003)
- DOS_BURST (MITRE T1498)
- C2_BEACON (MITRE T1071.004)
- DEVICE_SPOOF
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.ensemble import RandomForestClassifier

from app.ml.feature_vector import FEATURE_NAMES, extract_feature_vector

LABEL_TO_CLASS: Dict[int, str] = {
    0: "BENIGN",
    1: "PORT_SCAN",
    2: "DATA_EXFILTRATION",
    3: "DOS_BURST",
    4: "C2_BEACON",
    5: "DEVICE_SPOOF",
}

CLASS_TO_LABEL: Dict[str, int] = {v: k for k, v in LABEL_TO_CLASS.items()}

CLASS_TO_MITRE: Dict[str, str] = {
    "BENIGN": "N/A",
    "PORT_SCAN": "T1046",
    "DATA_EXFILTRATION": "T1048.003",
    "DOS_BURST": "T1498",
    "C2_BEACON": "T1071.004",
    "DEVICE_SPOOF": "T1036",
}


class SupervisedThreatClassifier:
    """
    Supervised Multi-Class Threat Classifier based on Random Forest.
    Categorizes flow feature vectors into known MITRE attack behavior profiles.
    """

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: int = 8,
        random_state: int = 42,
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state

        self.model = RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            class_weight="balanced",
            random_state=self.random_state,
            n_jobs=1,
        )

        self.is_fitted: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> "SupervisedThreatClassifier":
        """
        Fits the Random Forest model on feature matrix X and integer class labels y.
        """
        self.model.fit(X, y)
        self.is_fitted = True
        return self

    def predict(self, feature_vector: np.ndarray) -> Tuple[str, float, Dict[str, float]]:
        """
        Predicts threat class and confidence for a single feature vector.
        Returns:
            (predicted_class_name, confidence [0.0 - 1.0], probabilities_dict)
        """
        if not self.is_fitted:
            return "BENIGN", 1.0, {"BENIGN": 1.0}

        if feature_vector.ndim == 1:
            feature_vector = feature_vector.reshape(1, -1)

        probs = self.model.predict_proba(feature_vector)[0]
        pred_idx = int(np.argmax(probs))
        confidence = float(probs[pred_idx])

        # Map classes to probabilities
        prob_dict: Dict[str, float] = {}
        for idx, cls_int in enumerate(self.model.classes_):
            cls_name = LABEL_TO_CLASS.get(int(cls_int), f"CLASS_{cls_int}")
            prob_dict[cls_name] = round(float(probs[idx]), 4)

        pred_class_name = LABEL_TO_CLASS.get(pred_idx, "UNKNOWN")
        return pred_class_name, round(confidence, 4), prob_dict

    def evaluate_flow(self, flow_obj: Any) -> Dict[str, Any]:
        """
        Evaluates a flow and returns structured supervised classification results.
        """
        vec = extract_feature_vector(flow_obj)
        pred_class, confidence, prob_dict = self.predict(vec)
        mitre_id = CLASS_TO_MITRE.get(pred_class, "UNKNOWN")

        return {
            "model": "RandomForest",
            "predicted_class": pred_class,
            "confidence": confidence,
            "mitre_technique_id": mitre_id,
            "probabilities": prob_dict,
            "is_threat": pred_class != "BENIGN",
        }
