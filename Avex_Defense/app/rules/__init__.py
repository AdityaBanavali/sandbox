"""
Sigma-Inspired Custom Rule Engine Package for Cyber Defense Enclave.
"""

from app.rules.models import FieldFilter, Selection, SigmaRule, RuleMatchResult
from app.rules.parser import parse_sigma_rule, parse_rules_from_yaml
from app.rules.evaluator import evaluate_rule, evaluate_filter, evaluate_selection
from app.rules.engine import RuleEngine, get_rule_engine

__all__ = [
    "FieldFilter",
    "Selection",
    "SigmaRule",
    "RuleMatchResult",
    "parse_sigma_rule",
    "parse_rules_from_yaml",
    "evaluate_rule",
    "evaluate_filter",
    "evaluate_selection",
    "RuleEngine",
    "get_rule_engine",
]
