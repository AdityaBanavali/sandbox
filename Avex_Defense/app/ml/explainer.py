"""
Explainability Helper using SHAP and Tree Feature Attribution.
Extracts top driving features and generates human-interpretable rationale for cyber threat alerts.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.ml.feature_vector import FEATURE_NAMES, extract_feature_vector

FEATURE_DESCRIPTIONS: Dict[str, str] = {
    "duration_ms": "Flow duration in milliseconds",
    "packet_count": "Total volume of packets in unidirectional stream",
    "byte_count": "Total bytes transferred in forward direction",
    "packet_size_mean": "Mean packet size in bytes",
    "packet_size_std": "Standard deviation of packet size",
    "packet_size_skew": "Fisher-Pearson skewness of packet sizes",
    "iat_mean": "Mean inter-arrival time between packets",
    "iat_std": "Inter-arrival timing jitter / deviation",
    "iat_entropy": "Shannon entropy of packet arrival timing intervals (low = C2 beacon)",
    "payload_entropy": "Shannon randomness of payload bytes (high = encrypted exfiltration)",
    "ttl_variance": "Variance of IP Time-To-Live headers (high = IP/device spoofing)",
    "bytes_per_second": "Volumetric byte transfer rate",
}


class ThreatExplainer:
    """
    Explainability engine for ML Cyber Threat Detection.
    Computes local feature attribution (SHAP values / marginal decision weights)
    to identify the top driving signals responsible for triggering an alert.
    """

    def __init__(self, supervised_model: Any = None, background_data: Optional[np.ndarray] = None):
        self.supervised_model = supervised_model
        self.shap_explainer = None
        self._init_shap(background_data)

    def _init_shap(self, background_data: Optional[np.ndarray]) -> None:
        """
        Attempts to initialize a shap.TreeExplainer if shap is available and model is fitted.
        """
        if self.supervised_model is not None and getattr(self.supervised_model, "is_fitted", False):
            try:
                import shap
                rf = self.supervised_model.model
                self.shap_explainer = shap.TreeExplainer(rf)
            except Exception:
                self.shap_explainer = None

    def explain_flow(
        self,
        flow_obj: Any,
        predicted_class: str,
        top_k: int = 4,
    ) -> Dict[str, Any]:
        """
        Extracts top driving features and their local contribution toward the predicted class.
        Returns a structured dictionary suitable for Alert.explanation.
        """
        vec = extract_feature_vector(flow_obj)

        contributions: List[Dict[str, Any]] = []

        # Attempt SHAP TreeExplainer calculation
        shap_values_used = False
        if self.shap_explainer is not None:
            try:
                # Shape: (1, n_features, n_classes) or (n_classes, 1, n_features)
                shaps = self.shap_explainer.shap_values(vec.reshape(1, -1))
                if isinstance(shaps, list):
                    # Multi-class output: list of arrays per class
                    # Find class index
                    cls_idx = 0
                    if hasattr(self.supervised_model, "model"):
                        classes = list(self.supervised_model.model.classes_)
                        # Map predicted class name to index
                        from app.ml.supervised import CLASS_TO_LABEL
                        target_label = CLASS_TO_LABEL.get(predicted_class, 1)
                        if target_label in classes:
                            cls_idx = classes.index(target_label)
                    class_shaps = shaps[cls_idx][0]
                elif isinstance(shaps, np.ndarray):
                    if shaps.ndim == 3:
                        class_shaps = shaps[0, :, 0]
                    else:
                        class_shaps = shaps[0]
                else:
                    class_shaps = np.zeros(len(FEATURE_NAMES))

                for idx, fname in enumerate(FEATURE_NAMES):
                    attr_val = float(class_shaps[idx])
                    contributions.append({
                        "feature": fname,
                        "observed_value": round(float(vec[idx]), 3),
                        "importance_weight": round(abs(attr_val), 4),
                        "direction": "positive" if attr_val >= 0 else "negative",
                        "description": FEATURE_DESCRIPTIONS.get(fname, ""),
                    })
                shap_values_used = True
            except Exception:
                shap_values_used = False

        # Fallback: Tree global feature importance + normalized feature deviation
        if not shap_values_used:
            rf_importances = None
            if self.supervised_model is not None and getattr(self.supervised_model, "is_fitted", False):
                rf_importances = self.supervised_model.model.feature_importances_

            for idx, fname in enumerate(FEATURE_NAMES):
                val = float(vec[idx])
                weight = float(rf_importances[idx]) if rf_importances is not None else 0.1
                # Boost domain markers
                if fname == "payload_entropy" and val > 7.0:
                    weight += 0.4
                elif fname == "iat_entropy" and val < 1.3:
                    weight += 0.35
                elif fname == "ttl_variance" and val > 2.0:
                    weight += 0.3
                elif fname == "packet_size_skew" and abs(val) > 1.0:
                    weight += 0.25

                contributions.append({
                    "feature": fname,
                    "observed_value": round(val, 3),
                    "importance_weight": round(weight, 4),
                    "direction": "positive",
                    "description": FEATURE_DESCRIPTIONS.get(fname, ""),
                })

        # Sort by importance_weight descending and take top_k
        contributions.sort(key=lambda x: x["importance_weight"], reverse=True)
        top_features = contributions[:top_k]

        # Generate human-readable summary rationale
        rationale_lines = []
        for feat in top_features:
            rationale_lines.append(
                f"{feat['feature']}={feat['observed_value']} ({feat['description']})"
            )
        rationale_str = " | ".join(rationale_lines)

        return {
            "method": "SHAP_TreeExplainer" if shap_values_used else "Feature_Attribution_Weighting",
            "predicted_class": predicted_class,
            "top_driving_features": top_features,
            "rationale": rationale_str,
        }
