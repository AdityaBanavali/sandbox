"""
Data models for the Sigma-Inspired Custom Rule Engine.
Defines rule abstractions, field filter criteria, and match results.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class FieldFilter:
    """
    Individual field evaluation filter.
    Examples:
        field_name: "payload_entropy", operator: "gte", expected_value: 7.0
        field_name: "dst_ip", operator: "cidr", expected_value: "10.0.0.0/24"
        field_name: "dst_port", operator: "in", expected_value: [80, 443, 8080]
    """
    field_name: str
    operator: str          # "eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "cidr", "regex"
    expected_value: Any


@dataclass
class Selection:
    """
    Named grouping of field filters that must all evaluate to True (logical AND).
    """
    name: str
    filters: List[FieldFilter] = field(default_factory=list)


@dataclass
class SigmaRule:
    """
    Compiled Sigma-inspired rule representation.
    """
    id: str
    title: str
    status: str
    description: str
    level: str             # "critical", "high", "medium", "low"
    tags: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    selections: Dict[str, Selection] = field(default_factory=dict)
    condition: str = ""
    enabled: bool = True

    @property
    def mitre_technique_ids(self) -> List[str]:
        """
        Extracts MITRE ATT&CK technique IDs from rule tags (e.g. 'attack.t1048.003' -> 'T1048.003').
        """
        techniques = []
        for tag in self.tags:
            tag_lower = tag.lower().strip()
            if tag_lower.startswith("attack.t"):
                # Format: attack.t1048 or attack.t1071.004
                parts = tag_lower.split(".")
                if len(parts) >= 2:
                    tech = parts[1].upper()
                    if len(parts) >= 3:
                        tech += f".{parts[2]}"
                    techniques.append(tech)
        return techniques


@dataclass
class RuleMatchResult:
    """
    Outcome of evaluating a flow against a SigmaRule.
    """
    rule_id: str
    rule_title: str
    level: str
    tags: List[str]
    mitre_techniques: List[str]
    description: str
    matched_selections: List[str]
    flow_summary: str
    details: Dict[str, Any] = field(default_factory=dict)
