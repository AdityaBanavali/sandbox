"""
Multi-Parameter Severity Scoring Matrix for Cyber Threat Prioritization.
Combines:
1. Model Detection Confidence (C)
2. Threat Class Impact Weight (I)
3. Asset / Subnet Criticality Weight (A)
"""

import ipaddress
from typing import Any, Dict, List, Optional, Tuple

# Baseline intrinsic impact weights per threat class (0.0 to 1.0)
THREAT_IMPACT_WEIGHTS: Dict[str, float] = {
    "DATA_EXFILTRATION": 0.95,
    "C2_BEACON": 0.90,
    "NOVEL_ANOMALY": 0.88,
    "DOS_BURST": 0.85,
    "DEVICE_SPOOF": 0.65,
    "PORT_SCAN": 0.50,
    "BENIGN": 0.05,
}

# Pre-configured asset criticality rules (subnet or IP -> criticality multiplier 1.0 to 2.0)
DEFAULT_ASSET_CRITICALITY: List[Tuple[str, float, str]] = [
    # (CIDR / IP, multiplier, description)
    ("10.0.0.0/24", 2.0, "Core SCADA & Industrial Control Enclave"),
    ("10.0.1.0/24", 1.8, "High-Security Data Diode Outbound Vault"),
    ("192.168.10.0/24", 1.5, "Restricted Internal Enterprise Operations"),
    ("172.16.0.0/16", 1.3, "Corporate Management Subnet"),
]


class SeverityMatrix:
    """
    Computes calibrated severity scores and tiers based on confidence,
    intrinsic threat impact, and asset criticality.
    """

    def __init__(self, asset_rules: Optional[List[Tuple[str, float, str]]] = None):
        self.asset_rules = asset_rules or DEFAULT_ASSET_CRITICALITY

    def get_asset_criticality(self, ip_address_str: str) -> Tuple[float, str]:
        """
        Determines the asset criticality multiplier for a target destination or source IP.
        Defaults to 1.0 (Standard) if no high-security rule matches.
        """
        try:
            ip_obj = ipaddress.ip_address(ip_address_str)
            for cidr_str, mult, desc in self.asset_rules:
                if ip_obj in ipaddress.ip_network(cidr_str, strict=False):
                    return mult, desc
        except Exception:
            pass
        return 1.0, "Standard Network Asset"

    def compute_severity(
        self,
        behavior_class: str,
        confidence: float,
        target_ip: str,
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculates unified severity score:
        Score = min(10.0, 10.0 * (Confidence * Impact * Asset_Criticality))
        """
        # Determine asset weight (check target first, then source)
        crit_dst, desc_dst = self.get_asset_criticality(target_ip)
        crit_src, desc_src = self.get_asset_criticality(source_ip) if source_ip else (1.0, "")

        asset_criticality = max(crit_dst, crit_src)
        asset_desc = desc_dst if crit_dst >= crit_src else desc_src

        # Intrinsic threat impact
        impact_weight = THREAT_IMPACT_WEIGHTS.get(behavior_class.upper(), 0.60)

        # Unified calculation
        raw_score = 10.0 * (confidence * impact_weight * (asset_criticality / 1.5))
        severity_score = round(min(10.0, max(0.1, raw_score)), 2)

        # Categorization
        if severity_score >= 8.0:
            severity_level = "CRITICAL"
            action = "IMMEDIATE_ENCLAVE_ISOLATION"
        elif severity_score >= 6.0:
            severity_level = "HIGH"
            action = "SECURITY_ANALYST_ESCALATION"
        elif severity_score >= 4.0:
            severity_level = "MEDIUM"
            action = "INVESTIGATE_AND_MONITOR"
        else:
            severity_level = "LOW"
            action = "LOG_TELEMETRY"

        return {
            "severity_level": severity_level,
            "severity_score": severity_score,
            "confidence": round(confidence, 4),
            "impact_weight": impact_weight,
            "asset_criticality": asset_criticality,
            "asset_description": asset_desc,
            "recommended_action": action,
        }
