"""
Rules API router: listing, hot-reloading, and evaluating Sigma detection rules.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from app.rules.engine import get_rule_engine
from app.schemas.flow import FlowCreate
from app.ml.trainer import get_or_load_ensemble_engine
from app.services.mitre_mapper import get_mitre_mapper

router = APIRouter()


@router.get(
    "",
    summary="List all loaded Sigma-inspired detection rules",
)
async def list_rules() -> Dict[str, Any]:
    """
    Returns active custom Sigma rules, levels, tags, and MITRE mappings.
    """
    engine = get_rule_engine()
    rules_data = [
        {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "level": r.level,
            "tags": r.tags,
            "mitre_techniques": r.mitre_technique_ids,
            "description": r.description,
            "condition": r.condition,
            "enabled": r.enabled,
        }
        for r in engine.rules
    ]
    return {
        "count": len(rules_data),
        "rules": rules_data,
    }


@router.post(
    "/reload",
    status_code=status.HTTP_200_OK,
    summary="Hot-reload Sigma rules and MITRE mappings from YAML configuration",
)
async def reload_rules() -> Dict[str, Any]:
    """
    Dynamically reloads both Sigma rules and MITRE mappings from disk without downtime.
    """
    rule_engine = get_rule_engine()
    mitre_mapper = get_mitre_mapper()

    loaded_rules = rule_engine.reload()
    loaded_mitre = mitre_mapper.reload()

    return {
        "status": "success",
        "sigma_rules_loaded": loaded_rules,
        "mitre_mappings_loaded": len(mitre_mapper.mappings),
        "message": f"Successfully reloaded {loaded_rules} Sigma rules and {len(mitre_mapper.mappings)} MITRE mappings.",
    }


@router.post(
    "/evaluate",
    status_code=status.HTTP_200_OK,
    summary="Evaluate a unidirectional flow against custom Sigma rules",
)
async def evaluate_flow_rules(flow_in: FlowCreate) -> Dict[str, Any]:
    """
    Matches a flow against all active Sigma detection rules.
    """
    engine = get_rule_engine()
    matches = await engine.evaluate_async(flow_in)

    return {
        "match_count": len(matches),
        "has_match": len(matches) > 0,
        "matches": [
            {
                "rule_id": m.rule_id,
                "title": m.rule_title,
                "level": m.level,
                "tags": m.tags,
                "mitre_techniques": m.mitre_techniques,
                "description": m.description,
                "matched_selections": m.matched_selections,
                "flow_summary": m.flow_summary,
            }
            for m in matches
        ],
    }


@router.post(
    "/evaluate-hybrid",
    status_code=status.HTTP_200_OK,
    summary="Evaluate flow concurrently across Sigma Rules and ML Ensemble",
)
async def evaluate_hybrid(flow_in: FlowCreate) -> Dict[str, Any]:
    """
    Concurrently executes the Sigma Rule Engine and the Hybrid ML Ensemble,
    returning a corroborated defense-in-depth evaluation.
    """
    rule_engine = get_rule_engine()
    ml_engine = get_or_load_ensemble_engine()
    mitre_mapper = get_mitre_mapper()

    # Concurrent execution
    hybrid_report = await rule_engine.evaluate_concurrently_with_ml(
        flow_obj=flow_in,
        ml_engine=ml_engine,
        target_ip=flow_in.dst_ip,
        source_ip=flow_in.src_ip,
    )

    # Enrich with dynamic MITRE mapper
    enriched = mitre_mapper.enrich_alert(
        behavior_label=hybrid_report["behavior_class"],
        alert_payload=hybrid_report,
    )

    return enriched
