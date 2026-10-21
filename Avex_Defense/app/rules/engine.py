"""
Sigma-Inspired Custom Rule Engine.
Orchestrates rule loading, caching, execution, and concurrent evaluation
alongside ML models for hybrid signature and anomaly defense.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.rules.evaluator import evaluate_rule
from app.rules.models import RuleMatchResult, SigmaRule
from app.rules.parser import parse_rules_from_yaml

logger = logging.getLogger(__name__)

DEFAULT_RULES_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "sigma_rules.yaml"


class RuleEngine:
    """
    Orchestrates the evaluation of custom Sigma rules against network telemetry.
    Supports dynamic hot-reloading and concurrent execution with ML models.
    """

    def __init__(self, rules_path: Optional[Path] = None):
        self.rules_path = rules_path or DEFAULT_RULES_PATH
        self.rules: List[SigmaRule] = []
        self._executor = ThreadPoolExecutor(max_workers=4)
        self.load_rules()

    def load_rules(self) -> int:
        """
        Loads and compiles rules from the configured YAML file path.
        """
        if not self.rules_path.exists():
            logger.warning("Sigma rules file does not exist at: %s", self.rules_path)
            self.rules.clear()
            return 0

        try:
            parsed = parse_rules_from_yaml(self.rules_path)
            self.rules = parsed
            logger.info("Successfully loaded %d Sigma detection rules from %s.",
                        len(self.rules), self.rules_path.name)
            return len(self.rules)
        except Exception as exc:
            logger.error("Failed to load Sigma rules from %s: %s", self.rules_path, exc)
            return 0

    def reload(self) -> int:
        """
        Hot-reloads rules from disk without application restart.
        """
        return self.load_rules()

    def evaluate(self, flow_obj: Any) -> List[RuleMatchResult]:
        """
        Synchronously evaluates all active Sigma rules against a flow object.
        Returns a list of match results.
        """
        matches: List[RuleMatchResult] = []
        for rule in self.rules:
            res = evaluate_rule(rule, flow_obj)
            if res is not None:
                matches.append(res)
        return matches

    async def evaluate_async(self, flow_obj: Any) -> List[RuleMatchResult]:
        """
        Asynchronously evaluates rules in a worker thread.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, self.evaluate, flow_obj)

    async def evaluate_concurrently_with_ml(
        self,
        flow_obj: Any,
        ml_engine: Any,
        target_ip: Optional[str] = None,
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes Sigma custom rules and the ML ensemble concurrently.
        Fuses deterministic signature hits with unsupervised/supervised ML detections.
        """
        loop = asyncio.get_running_loop()

        # Concurrently execute Rule Engine and ML Engine
        rule_task = loop.run_in_executor(self._executor, self.evaluate, flow_obj)
        ml_task = loop.run_in_executor(
            self._executor,
            ml_engine.evaluate_flow,
            flow_obj,
            target_ip,
            source_ip,
        )

        rule_matches, ml_res = await asyncio.gather(rule_task, ml_task)

        # -------------------------------------------------------------------
        # Hybrid Fusion Logic
        # -------------------------------------------------------------------
        has_rule_hit = len(rule_matches) > 0
        has_ml_threat = ml_res.is_threat
        is_hybrid_threat = has_rule_hit or has_ml_threat

        # Corroborated confidence: Boost confidence when both rule and ML agree
        confidence = ml_res.confidence
        if has_rule_hit and has_ml_threat:
            confidence = min(1.0, confidence + 0.08)

        # Aggregate all MITRE technique IDs from both engines
        mitre_set = set()
        if ml_res.mitre_technique_id and ml_res.mitre_technique_id != "N/A":
            mitre_set.add(ml_res.mitre_technique_id)
        for rm in rule_matches:
            mitre_set.update(rm.mitre_techniques)

        # Determine hybrid behavior class and severity level
        severity_level = ml_res.severity_level
        behavior_class = ml_res.behavior_class

        if has_rule_hit and not has_ml_threat:
            # Rule triggered alone
            top_rule = rule_matches[0]
            behavior_class = f"SIGNATURE_{top_rule.rule_title.upper().replace(' ', '_')}"
            severity_level = top_rule.level.upper()
        elif has_rule_hit and has_ml_threat:
            # Both triggered: elevate severity if rule is critical
            if any(rm.level.lower() == "critical" for rm in rule_matches):
                severity_level = "CRITICAL"

        return {
            "is_hybrid_threat": is_hybrid_threat,
            "behavior_class": behavior_class,
            "severity_level": severity_level,
            "severity_score": ml_res.severity_score,
            "confidence": round(confidence, 4),
            "has_rule_hit": has_rule_hit,
            "rule_match_count": len(rule_matches),
            "rule_matches": [
                {
                    "rule_id": rm.rule_id,
                    "title": rm.rule_title,
                    "level": rm.level,
                    "tags": rm.tags,
                    "mitre_techniques": rm.mitre_techniques,
                    "description": rm.description,
                }
                for rm in rule_matches
            ],
            "ml_threat": has_ml_threat,
            "is_novel_zero_day": ml_res.is_novel_zero_day,
            "mitre_techniques": list(mitre_set),
            "explanation": ml_res.explanation,
            "severity_metadata": ml_res.severity_metadata,
        }


    def get_active_rules(self) -> List[SigmaRule]:
        """
        Returns all currently active Sigma rules.
        """
        return self.rules


# Global singleton instance
_global_rule_engine: Optional[RuleEngine] = None


def get_rule_engine() -> RuleEngine:
    """
    Returns or initializes the global RuleEngine singleton instance.
    """
    global _global_rule_engine
    if _global_rule_engine is None:
        _global_rule_engine = RuleEngine()
    return _global_rule_engine


rule_engine = get_rule_engine()
