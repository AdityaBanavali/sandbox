"""
Sigma Rule YAML Parser.
Parses Sigma detection definitions into structured SigmaRule models.
Supports pipe modifier syntax (e.g. field | gte: 7.0, field | cidr: 10.0.0.0/24).
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import yaml

from app.rules.models import FieldFilter, Selection, SigmaRule

logger = logging.getLogger(__name__)

SUPPORTED_OPERATORS = {
    "eq", "ne", "gt", "gte", "lt", "lte", "in", "contains",
    "startswith", "endswith", "cidr", "regex"
}


def parse_field_key(key_str: str) -> Tuple[str, str]:
    """
    Parses a field key that may contain a pipe operator modifier.
    Examples:
        "dst_port" -> ("dst_port", "eq")
        "payload_entropy | gte" -> ("payload_entropy", "gte")
        "dst_ip | cidr" -> ("dst_ip", "cidr")
        "protocol | in" -> ("protocol", "in")
    """
    parts = [p.strip() for p in key_str.split("|")]
    field_name = parts[0]
    operator = parts[1].lower() if len(parts) > 1 else "eq"

    # Alias normalization
    if operator in ["equal", "equals", "=="]:
        operator = "eq"
    elif operator in ["!=", "not_eq"]:
        operator = "ne"
    elif operator in [">="]:
        operator = "gte"
    elif operator in ["<="]:
        operator = "lte"
    elif operator in [">"]:
        operator = "gt"
    elif operator in ["<"]:
        operator = "lt"

    if operator not in SUPPORTED_OPERATORS:
        logger.warning("Unrecognized operator '%s' in field '%s'; defaulting to 'eq'.", operator, key_str)
        operator = "eq"

    return field_name, operator


def parse_sigma_rule(rule_dict: Dict[str, Any]) -> Optional[SigmaRule]:
    """
    Parses a dictionary representing a single Sigma rule into a SigmaRule model.
    """
    try:
        title = rule_dict.get("title", "Untitled Sigma Rule")
        rule_id = str(rule_dict.get("id", ""))
        status = rule_dict.get("status", "experimental")
        description = rule_dict.get("description", "")
        level = rule_dict.get("level", "medium").lower()
        tags = rule_dict.get("tags", [])
        references = rule_dict.get("references", [])

        detection = rule_dict.get("detection", {})
        if not detection:
            logger.warning("Rule '%s' has no detection block; skipping.", title)
            return None

        condition = str(detection.get("condition", "")).strip()

        selections: Dict[str, Selection] = {}

        for sel_name, sel_content in detection.items():
            if sel_name == "condition":
                continue

            filters: List[FieldFilter] = []

            if isinstance(sel_content, dict):
                for k, val in sel_content.items():
                    fname, op = parse_field_key(k)
                    filters.append(FieldFilter(field_name=fname, operator=op, expected_value=val))
            elif isinstance(sel_content, list):
                # List of maps or single map
                for item in sel_content:
                    if isinstance(item, dict):
                        for k, val in item.items():
                            fname, op = parse_field_key(k)
                            filters.append(FieldFilter(field_name=fname, operator=op, expected_value=val))

            selections[sel_name] = Selection(name=sel_name, filters=filters)

        return SigmaRule(
            id=rule_id,
            title=title,
            status=status,
            description=description,
            level=level,
            tags=tags,
            references=references,
            selections=selections,
            condition=condition,
            enabled=True,
        )
    except Exception as exc:
        logger.error("Failed to parse Sigma rule dict: %s", exc)
        return None


def parse_rules_from_yaml(yaml_path_or_str: Union[str, Path]) -> List[SigmaRule]:
    """
    Parses rules from a YAML file path or raw string.
    Supports single rule format or multi-rule documents (under 'rules' key or YAML docs).
    """
    rules: List[SigmaRule] = []

    if isinstance(yaml_path_or_str, Path) or (isinstance(yaml_path_or_str, str) and "\n" not in yaml_path_or_str and Path(yaml_path_or_str).exists()):
        p = Path(yaml_path_or_str)
        with open(p, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = yaml_path_or_str

    docs = yaml.safe_load_all(content)
    for doc in docs:
        if not doc:
            continue
        if isinstance(doc, dict):
            if "rules" in doc and isinstance(doc["rules"], list):
                for item in doc["rules"]:
                    r = parse_sigma_rule(item)
                    if r:
                        rules.append(r)
            elif "detection" in doc:
                r = parse_sigma_rule(doc)
                if r:
                    rules.append(r)

    return rules
