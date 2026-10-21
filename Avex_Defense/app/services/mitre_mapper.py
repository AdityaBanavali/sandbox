"""
Dynamic MITRE ATT&CK Mapper Service.
Loads YAML-based mapping configuration, resolves threat behavior classes
(including ML labels and aliases), and dynamically enriches alert payloads.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml
from sqlalchemy.orm import Session

from app.models.mitre import MitreMapping

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "mitre_rules.yaml"


class MitreMapper:
    """
    Dynamic MITRE ATT&CK Mapping Engine.
    Reads YAML configurations and enriches alerts with formal ATT&CK matrix metadata.
    """

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self.mappings: Dict[str, Dict[str, Any]] = {}
        self.alias_lookup: Dict[str, str] = {}
        self.load_mappings()

    def load_mappings(self) -> bool:
        """
        Loads or reloads the YAML mapping configuration from disk.
        Builds the direct key lookup and normalized alias lookup tables.
        """
        if not self.config_path.exists():
            logger.warning("MITRE rules YAML file not found at: %s", self.config_path)
            return False

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            raw_mappings = data.get("mappings", {})
            self.mappings.clear()
            self.alias_lookup.clear()

            for key, entry in raw_mappings.items():
                self.mappings[key.lower()] = entry
                self.alias_lookup[key.lower()] = key.lower()

                # Register aliases
                for alias in entry.get("aliases", []):
                    self.alias_lookup[alias.strip().lower()] = key.lower()

            logger.info("Successfully loaded %d MITRE mappings with %d aliases.",
                        len(self.mappings), len(self.alias_lookup))
            return True
        except Exception as exc:
            logger.error("Failed to parse MITRE rules YAML config %s: %s", self.config_path, exc)
            return False

    def reload(self) -> bool:
        """
        Hot-reloads the configuration file.
        """
        return self.load_mappings()

    def get_mapping_by_behavior(self, behavior_label: str) -> Optional[Dict[str, Any]]:
        """
        Resolves a behavior label (from ML engine, rule triggers, or manual input)
        to its canonical MITRE ATT&CK configuration entry.
        """
        if not behavior_label:
            return None

        normalized = behavior_label.strip().lower()

        # 1. Check alias or direct key lookup
        canonical_key = self.alias_lookup.get(normalized)
        if canonical_key and canonical_key in self.mappings:
            return self.mappings[canonical_key]

        # 2. Check substring matching
        for alias, key in self.alias_lookup.items():
            if alias in normalized or normalized in alias:
                return self.mappings[key]

        # 3. Fallback generic mapping for novel anomalies
        if "novel" in normalized or "zero" in normalized:
            return self.mappings.get("novel_anomaly_zeroday")

        return None

    def enrich_alert(
        self,
        behavior_label: str,
        alert_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Enriches an alert dictionary with ATT&CK tactic, technique, description, and URLs.
        Modifies and returns the alert dictionary.
        """
        mapping = self.get_mapping_by_behavior(behavior_label)
        if not mapping:
            alert_payload.setdefault("mitre_enrichment", {
                "technique_id": "T1048",
                "tactic_name": "Exfiltration",
                "technique_name": "Exfiltration Over Alternative Protocol (Unmapped)",
                "subtechnique_id": None,
                "mitre_url": "https://attack.mitre.org/techniques/T1048/",
                "description": f"Unmapped behavior: {behavior_label}",
            })
            return alert_payload

        enrichment = {
            "technique_id": mapping.get("technique_id"),
            "subtechnique_id": mapping.get("subtechnique_id"),
            "tactic_name": mapping.get("tactic_name"),
            "technique_name": mapping.get("technique_name"),
            "description": mapping.get("description", "").strip(),
            "mitre_url": mapping.get("mitre_url"),
            "default_severity": mapping.get("default_severity"),
            "default_impact": mapping.get("default_impact"),
        }
        alert_payload["mitre_enrichment"] = enrichment

        # Ensure top-level fields are populated if empty
        if not alert_payload.get("mitre_technique_id"):
            alert_payload["mitre_technique_id"] = mapping.get("technique_id")

        return alert_payload

    def sync_with_database(self, session: Session) -> int:
        """
        Synchronizes all YAML mappings into the relational database `mitre_mappings` table.
        Creates missing techniques or updates descriptions.
        Returns the count of synced records.
        """
        synced = 0
        for entry in self.mappings.values():
            tech_id = entry.get("technique_id")
            if not tech_id:
                continue

            existing = session.query(MitreMapping).filter(MitreMapping.technique_id == tech_id).first()
            if existing:
                existing.tactic_name = entry.get("tactic_name", existing.tactic_name)
                existing.technique_name = entry.get("technique_name", existing.technique_name)
                existing.description = entry.get("description", existing.description)
                existing.url = entry.get("mitre_url", existing.url)
            else:
                new_mapping = MitreMapping(
                    technique_id=tech_id,
                    tactic_name=entry.get("tactic_name", "Unknown"),
                    technique_name=entry.get("technique_name", "Unknown"),
                    subtechnique_id=entry.get("subtechnique_id"),
                    description=entry.get("description", "").strip(),
                    url=entry.get("mitre_url"),
                )
                session.add(new_mapping)
            synced += 1

        session.flush()
        return synced


# Global singleton instance
_global_mitre_mapper: Optional[MitreMapper] = None


def get_mitre_mapper() -> MitreMapper:
    """
    Returns or initializes the global MitreMapper singleton instance.
    """
    global _global_mitre_mapper
    if _global_mitre_mapper is None:
        _global_mitre_mapper = MitreMapper()
    return _global_mitre_mapper
