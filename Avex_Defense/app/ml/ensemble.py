"""
Ensemble Threat Engine for Unidirectional Cyber Defense.
Fuses unsupervised anomaly detection (Isolation Forest) with supervised classification (Random Forest),
incorporates the multi-factor severity matrix, and generates SHAP explainability summaries.
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional
import numpy as np

from app.ml.feature_vector import extract_feature_vector
from app.ml.unsupervised import IsolationForestAnomalyDetector
from app.ml.supervised import SupervisedThreatClassifier, CLASS_TO_MITRE
from app.ml.severity_matrix import SeverityMatrix
from app.ml.explainer import ThreatExplainer


@dataclass
class EnsembleResult:
    is_threat: bool
    behavior_class: str
    mitre_technique_id: str
    risk_score: float              # 0.0 to 1.0 unified risk
    confidence: float              # 0.0 to 1.0 unified confidence
    severity_level: str            # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    severity_score: float          # 0.0 to 10.0 scaled score
    is_novel_zero_day: bool        # True if flagged by unsupervised but unclassified by supervised
    unsupervised_score: float
    supervised_class: str
    supervised_confidence: float
    explanation: Dict[str, Any]
    severity_metadata: Dict[str, Any]


class EnsembleThreatEngine:
    """
    Unified Ensemble Cyber Threat Detection Engine.
    Combines Isolation Forest, Random Forest, Severity Matrix, and SHAP Explainability.
    """

    def __init__(
        self,
        unsupervised_model: Optional[IsolationForestAnomalyDetector] = None,
        supervised_model: Optional[SupervisedThreatClassifier] = None,
        severity_matrix: Optional[SeverityMatrix] = None,
        explainer: Optional[ThreatExplainer] = None,
    ):
        self.unsupervised = unsupervised_model or IsolationForestAnomalyDetector()
        self.supervised = supervised_model or SupervisedThreatClassifier()
        self.severity_matrix = severity_matrix or SeverityMatrix()
        self.explainer = explainer or ThreatExplainer(supervised_model=self.supervised)

    def evaluate_flow(
        self,
        flow_obj: Any,
        target_ip: Optional[str] = None,
        source_ip: Optional[str] = None,
    ) -> EnsembleResult:
        """
        Evaluates a flow object through both models, performs ensemble fusion,
        calculates multi-factor severity, and attaches explainability attributes.
        """
        vec = extract_feature_vector(flow_obj)

        # 1. Unsupervised Anomaly Scoring (Isolation Forest)
        unsup_score, is_unsup_anomaly, _ = self.unsupervised.predict_score(vec)

        # 2. Supervised Threat Classification (Random Forest)
        sup_class, sup_conf, prob_dict = self.supervised.predict(vec)

        # Resolve target and source IPs
        dst_ip = target_ip or getattr(flow_obj, "dst_ip", "") or (flow_obj.get("dst_ip") if isinstance(flow_obj, dict) else "0.0.0.0")
        src_ip = source_ip or getattr(flow_obj, "src_ip", "") or (flow_obj.get("src_ip") if isinstance(flow_obj, dict) else "0.0.0.0")

        # 3. Ensemble Fusion Logic
        is_novel_zero_day = False

        if sup_class != "BENIGN" and sup_conf >= 0.55:
            # Known threat signature matched
            behavior_class = sup_class
            fused_risk = round(0.65 * sup_conf + 0.35 * unsup_score, 4)
            fused_conf = max(sup_conf, unsup_score)
            is_threat = True
            mitre_id = CLASS_TO_MITRE.get(sup_class, "T1048")

        elif unsup_score >= self.unsupervised.threshold:
            # Unsupervised outlier detected without matching a known supervised signature -> Novel / Zero-day!
            behavior_class = "NOVEL_ANOMALY"
            fused_risk = unsup_score
            fused_conf = unsup_score
            is_threat = True
            is_novel_zero_day = True
            mitre_id = "T1048"  # Fallback general covert exfiltration / diode anomaly

        else:
            # Benign flow
            behavior_class = "BENIGN"
            fused_risk = round(unsup_score * 0.4, 4)
            fused_conf = sup_conf
            is_threat = False
            mitre_id = "N/A"

        # 4. Severity Scoring Matrix (Confidence * Impact * Asset Criticality)
        sev_meta = self.severity_matrix.compute_severity(
            behavior_class=behavior_class,
            confidence=fused_conf,
            target_ip=str(dst_ip),
            source_ip=str(src_ip),
        )

        # 5. Explainability (SHAP / Tree Attribution)
        explanation_dict: Dict[str, Any] = {}
        if is_threat:
            explanation_dict = self.explainer.explain_flow(
                flow_obj=flow_obj,
                predicted_class=behavior_class,
                top_k=4,
            )
            explanation_dict["is_novel_zero_day"] = is_novel_zero_day
            explanation_dict["unsupervised_anomaly_score"] = unsup_score
            explanation_dict["supervised_class_probabilities"] = prob_dict

        return EnsembleResult(
            is_threat=is_threat,
            behavior_class=behavior_class,
            mitre_technique_id=mitre_id,
            risk_score=fused_risk,
            confidence=fused_conf,
            severity_level=sev_meta["severity_level"],
            severity_score=sev_meta["severity_score"],
            is_novel_zero_day=is_novel_zero_day,
            unsupervised_score=unsup_score,
            supervised_class=sup_class,
            supervised_confidence=sup_conf,
            explanation=explanation_dict,
            severity_metadata=sev_meta,
        )
