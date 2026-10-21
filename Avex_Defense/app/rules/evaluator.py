"""
Sigma Rule Evaluation Engine for Unidirectional IP Flows.
Matches flow telemetry against compiled FieldFilters, Selections, and boolean conditions.
"""

import ipaddress
import re
from typing import Any, Dict, List, Optional, Set, Union

from app.rules.models import FieldFilter, RuleMatchResult, Selection, SigmaRule


def extract_field_value(flow_obj: Any, field_name: str) -> Any:
    """
    Extracts a value for field_name from a flow object or dictionary.
    Supports top-level attributes, nested feature paths, and auto-flattening.
    """
    if isinstance(flow_obj, dict):
        d = flow_obj
        feat = d.get("features") or {}
    else:
        d = flow_obj.__dict__ if hasattr(flow_obj, "__dict__") else {}
        feat = getattr(flow_obj, "features", {}) or {}

    # 1. Direct top-level lookup
    if field_name in d:
        return d[field_name]
    if hasattr(flow_obj, field_name):
        return getattr(flow_obj, field_name)

    # 2. Check inside features dict
    if field_name in feat:
        return feat[field_name]

    # 3. Check inside nested feature sub-dicts (e.g. ttl_fingerprint, port_anomaly_flags, ewma_stats)
    for sub in ["ttl_fingerprint", "port_anomaly_flags", "ewma_stats"]:
        sub_dict = feat.get(sub) if isinstance(feat, dict) else getattr(feat, sub, None)
        if isinstance(sub_dict, dict) and field_name in sub_dict:
            return sub_dict[field_name]

    # 4. Handle dotted notation
    if "." in field_name:
        parts = field_name.split(".")
        cur = d
        for p in parts:
            if isinstance(cur, dict) and p in cur:
                cur = cur[p]
            elif hasattr(cur, p):
                cur = getattr(cur, p)
            else:
                return None
        return cur

    return None


def evaluate_filter(actual_val: Any, field_filter: FieldFilter) -> bool:
    """
    Evaluates a single FieldFilter operator against the actual flow value.
    """
    op = field_filter.operator
    exp = field_filter.expected_value

    if actual_val is None:
        return False

    try:
        if op == "eq":
            if isinstance(actual_val, str) and isinstance(exp, str):
                return actual_val.lower() == exp.lower()
            return actual_val == exp

        elif op == "ne":
            if isinstance(actual_val, str) and isinstance(exp, str):
                return actual_val.lower() != exp.lower()
            return actual_val != exp

        elif op == "gt":
            return float(actual_val) > float(exp)

        elif op == "gte":
            return float(actual_val) >= float(exp)

        elif op == "lt":
            return float(actual_val) < float(exp)

        elif op == "lte":
            return float(actual_val) <= float(exp)

        elif op == "in":
            if isinstance(exp, (list, set, tuple)):
                # If numeric comparison in list
                if isinstance(actual_val, (int, float)):
                    return any(float(actual_val) == float(x) for x in exp if isinstance(x, (int, float, str)) and str(x).isdigit())
                # String comparison in list
                return actual_val in exp or str(actual_val).lower() in [str(x).lower() for x in exp]
            return actual_val == exp

        elif op == "contains":
            return str(exp).lower() in str(actual_val).lower()

        elif op == "startswith":
            return str(actual_val).lower().startswith(str(exp).lower())

        elif op == "endswith":
            return str(actual_val).lower().endswith(str(exp).lower())

        elif op == "cidr":
            # IP network containment
            ip_obj = ipaddress.ip_address(str(actual_val).strip())
            net_obj = ipaddress.ip_network(str(exp).strip(), strict=False)
            return ip_obj in net_obj

        elif op == "regex":
            return bool(re.search(str(exp), str(actual_val)))

    except Exception:
        return False

    return False


def evaluate_selection(selection: Selection, flow_obj: Any) -> bool:
    """
    A selection matches if and only if ALL of its filters match (logical AND).
    """
    for f in selection.filters:
        val = extract_field_value(flow_obj, f.field_name)
        if not evaluate_filter(val, f):
            return False
    return True


def evaluate_boolean_condition(condition_str: str, selection_results: Dict[str, bool]) -> bool:
    """
    Evaluates a Sigma boolean condition string (e.g. 'sel1 and not sel2', '1 of selection_*').
    """
    cond = condition_str.strip()

    # If simple selection name directly matching
    if cond in selection_results:
        return selection_results[cond]

    # Handle '1 of selection_*' pattern
    if cond.startswith("1 of ") or cond.startswith("any of "):
        prefix = cond.split(" ")[-1].replace("*", "")
        matching = [res for name, res in selection_results.items() if name.startswith(prefix)]
        return any(matching)

    # Handle 'all of selection_*' pattern
    if cond.startswith("all of "):
        prefix = cond.split(" ")[-1].replace("*", "")
        matching = [res for name, res in selection_results.items() if name.startswith(prefix)]
        return len(matching) > 0 and all(matching)

    # Safe evaluation of boolean logic expression using token substitution
    # Replace identifiers with their boolean literals True/False
    tokens = cond.split()
    eval_tokens = []
    for t in tokens:
        clean_token = t.strip("()")
        leading_parens = t[:len(t) - len(t.lstrip("("))]
        trailing_parens = t[len(t.rstrip(")")):]

        if clean_token in selection_results:
            rep = str(selection_results[clean_token])
        elif clean_token in ["and", "or", "not"]:
            rep = clean_token
        else:
            rep = "False"

        eval_tokens.append(f"{leading_parens}{rep}{trailing_parens}")

    eval_expr = " ".join(eval_tokens)
    try:
        # Restricted safe eval with only boolean operators
        # eval_expr only contains 'True', 'False', 'and', 'or', 'not', '(', ')'
        allowed_names = {"True": True, "False": False}
        return bool(eval(eval_expr, {"__builtins__": {}}, allowed_names))
    except Exception:
        # Fallback: if all active selections are True
        return all(selection_results.values()) if selection_results else False


def evaluate_rule(rule: SigmaRule, flow_obj: Any) -> Optional[RuleMatchResult]:
    """
    Evaluates a flow against a SigmaRule.
    Returns a RuleMatchResult if the rule condition is met, otherwise None.
    """
    if not rule.enabled or not rule.selections:
        return None

    selection_results: Dict[str, bool] = {}
    matched_selections: List[str] = []

    for name, selection in rule.selections.items():
        matched = evaluate_selection(selection, flow_obj)
        selection_results[name] = matched
        if matched:
            matched_selections.append(name)

    is_match = evaluate_boolean_condition(rule.condition, selection_results)
    if not is_match:
        return None

    src = extract_field_value(flow_obj, "src_ip") or "unknown"
    dst = extract_field_value(flow_obj, "dst_ip") or "unknown"
    proto = extract_field_value(flow_obj, "protocol") or "unknown"
    dport = extract_field_value(flow_obj, "dst_port") or "unknown"

    flow_summary = f"{src} -> {dst}:{dport} [{proto}]"

    return RuleMatchResult(
        rule_id=rule.id,
        rule_title=rule.title,
        level=rule.level,
        tags=rule.tags,
        mitre_techniques=rule.mitre_technique_ids,
        description=rule.description,
        matched_selections=matched_selections,
        flow_summary=flow_summary,
        details={
            "condition": rule.condition,
            "status": rule.status,
            "references": rule.references,
        },
    )
