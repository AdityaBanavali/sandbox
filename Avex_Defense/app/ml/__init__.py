"""
Machine Learning Cyber Threat Detection Package for Cyber Defense Enclave.
Combines:
1. Unsupervised Isolation Forest Anomaly Detector
2. Supervised Random Forest Multi-Class Threat Classifier
3. Unified Ensemble Scoring Engine with Zero-Day Detection
4. Multi-Parameter Severity Scoring Matrix (Confidence * Impact * Asset Criticality)
5. SHAP TreeExplainer Local Attribution Helper
"""

from app.ml.feature_vector import FEATURE_NAMES, extract_feature_vector, extract_batch_features
from app.ml.unsupervised import IsolationForestAnomalyDetector
from app.ml.supervised import SupervisedThreatClassifier, LABEL_TO_CLASS, CLASS_TO_LABEL, CLASS_TO_MITRE
from app.ml.severity_matrix import SeverityMatrix, THREAT_IMPACT_WEIGHTS
from app.ml.explainer import ThreatExplainer
from app.ml.ensemble import EnsembleThreatEngine, EnsembleResult

__all__ = [
    "FEATURE_NAMES",
    "extract_feature_vector",
    "extract_batch_features",
    "IsolationForestAnomalyDetector",
    "SupervisedThreatClassifier",
    "LABEL_TO_CLASS",
    "CLASS_TO_LABEL",
    "CLASS_TO_MITRE",
    "SeverityMatrix",
    "THREAT_IMPACT_WEIGHTS",
    "ThreatExplainer",
    "EnsembleThreatEngine",
    "EnsembleResult",
]

