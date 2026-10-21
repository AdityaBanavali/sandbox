"""
MITRE ATT&CK Service for managing cybersecurity threat techniques and seeding.
"""

import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mitre import MitreMapping
from app.models.alert import Alert
from app.schemas.mitre import MitreMappingCreate

DEFAULT_UNIDIRECTIONAL_TECHNIQUES = [
    {
        "tactic_name": "Exfiltration",
        "technique_id": "T1048",
        "technique_name": "Exfiltration Over Alternative Protocol",
        "subtechnique_id": None,
        "description": "Adversaries may steal data by exfiltrating it over a different protocol than that of the existing command and control channel, particularly bypassing unidirectional diodes.",
        "url": "https://attack.mitre.org/techniques/T1048/",
    },
    {
        "tactic_name": "Exfiltration",
        "technique_id": "T1048.003",
        "technique_name": "Exfiltration Over Unencrypted Non-C2 Protocol",
        "subtechnique_id": "T1048.003",
        "description": "Adversaries may exfiltrate data using an unencrypted protocol, transmitting high-entropy payloads across unidirectional boundaries.",
        "url": "https://attack.mitre.org/techniques/T1048/003/",
    },
    {
        "tactic_name": "Discovery",
        "technique_id": "T1046",
        "technique_name": "Network Service Discovery",
        "subtechnique_id": None,
        "description": "Adversaries may attempt to get a listing of services running on hosts by generating unidirectional SYN probes or UDP port sweeps.",
        "url": "https://attack.mitre.org/techniques/T1046/",
    },
    {
        "tactic_name": "Command and Control",
        "technique_id": "T1071.004",
        "technique_name": "Application Layer Protocol: DNS",
        "subtechnique_id": "T1071.004",
        "description": "Adversaries may communicate using DNS queries or exfiltrate sensitive data via structured DNS queries across unidirectional outbound taps.",
        "url": "https://attack.mitre.org/techniques/T1071/004/",
    },
    {
        "tactic_name": "Command and Control",
        "technique_id": "T1095",
        "technique_name": "Non-Application Layer Protocol",
        "subtechnique_id": None,
        "description": "Adversaries may use non-application layer protocols (such as raw ICMP or custom UDP datagrams) for covert unidirectional data transfer.",
        "url": "https://attack.mitre.org/techniques/T1095/",
    },
    {
        "tactic_name": "Impact",
        "technique_id": "T1498",
        "technique_name": "Network Denial of Service",
        "subtechnique_id": None,
        "description": "Adversaries may perform Network DoS attacks by flooding network bandwidth over unidirectional streams.",
        "url": "https://attack.mitre.org/techniques/T1498/",
    },
    {
        "tactic_name": "Defense Evasion",
        "technique_id": "T1036",
        "technique_name": "Masquerading",
        "subtechnique_id": None,
        "description": "Adversaries may spoof TTL fingerprints or packet metadata to masquerade legitimate internal nodes.",
        "url": "https://attack.mitre.org/techniques/T1036/",
    },
]


class MitreService:
    @staticmethod
    async def get_by_technique_id(db: AsyncSession, technique_id: str) -> Optional[MitreMapping]:
        stmt = select(MitreMapping).where(MitreMapping.technique_id == technique_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def get_by_id(db: AsyncSession, mapping_id: uuid.UUID) -> Optional[MitreMapping]:
        stmt = select(MitreMapping).where(MitreMapping.id == mapping_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def list_all(db: AsyncSession, limit: int = 100) -> List[MitreMapping]:
        stmt = select(MitreMapping).order_by(MitreMapping.technique_id).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create(db: AsyncSession, obj_in: MitreMappingCreate) -> MitreMapping:
        db_obj = MitreMapping(
            tactic_name=obj_in.tactic_name,
            technique_id=obj_in.technique_id,
            technique_name=obj_in.technique_name,
            subtechnique_id=obj_in.subtechnique_id,
            description=obj_in.description,
            url=obj_in.url,
        )
        db.add(db_obj)
        await db.flush()
        return db_obj

    @staticmethod
    async def seed_defaults(db: AsyncSession) -> int:
        """
        Seeds default unidirectional MITRE techniques into the database if not present.
        Returns the number of newly added mappings.
        """
        added = 0
        for item in DEFAULT_UNIDIRECTIONAL_TECHNIQUES:
            tid = str(item.get("technique_id", ""))
            existing = await MitreService.get_by_technique_id(db, tid)
            if not existing:
                db_obj = MitreMapping(**item)
                db.add(db_obj)
                added += 1
        if added > 0:
            await db.flush()
        return added

    @staticmethod
    async def get_tactics_overview(db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Aggregates all registered tactics, techniques, and their associated alert counts.
        """
        stmt = select(MitreMapping).order_by(MitreMapping.tactic_name, MitreMapping.technique_id)
        result = await db.execute(stmt)
        mappings = result.scalars().all()

        tactics_map: Dict[str, Dict[str, Any]] = {}
        for m in mappings:
            t_name = m.tactic_name
            if t_name not in tactics_map:
                tactics_map[t_name] = {
                    "tactic_name": t_name,
                    "techniques_count": 0,
                    "total_alerts": 0,
                    "techniques": [],
                }

            # Count alerts linked to this technique
            alert_count_stmt = select(func.count(Alert.id)).where(Alert.mitre_mapping_id == m.id)
            alert_count = (await db.execute(alert_count_stmt)).scalar_one()

            tactics_map[t_name]["techniques_count"] += 1
            tactics_map[t_name]["total_alerts"] += alert_count
            tactics_map[t_name]["techniques"].append({
                "technique_id": m.technique_id,
                "technique_name": m.technique_name,
                "subtechnique_id": m.subtechnique_id,
                "url": m.url,
                "alert_count": alert_count,
            })

        return list(tactics_map.values())

    @staticmethod
    async def get_alerts_by_tactic(
        db: AsyncSession,
        tactic_name: str,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Alert], int]:
        """
        Retrieves all alerts linked to techniques under a given MITRE tactic.
        """
        count_stmt = (
            select(func.count(Alert.id))
            .join(Alert.mitre_mapping)
            .where(MitreMapping.tactic_name.ilike(f"%{tactic_name}%"))
        )
        total = (await db.execute(count_stmt)).scalar_one()

        stmt = (
            select(Alert)
            .options(selectinload(Alert.mitre_mapping))
            .join(Alert.mitre_mapping)
            .where(MitreMapping.tactic_name.ilike(f"%{tactic_name}%"))
            .order_by(Alert.timestamp.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all()), total
