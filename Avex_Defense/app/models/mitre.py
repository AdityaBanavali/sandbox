"""
MITRE ATT&CK Mapping model for unidirectional IP threat classification.
Stores tactics, technique IDs (e.g. T1046), technique names, descriptions, and URLs.
"""

import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.alert import Alert


class MitreMapping(Base, TimestampMixin):
    """
    MITRE ATT&CK Framework Mapping Model.
    Maps detected behavioral anomalies in unidirectional network traffic to
    formally documented adversary tactics, techniques, and procedures (TTPs).
    """
    __tablename__ = "mitre_mappings"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # MITRE ATT&CK Fields
    tactic_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
    )  # e.g., "Exfiltration", "Discovery", "Command and Control"

    technique_id: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        index=True,
    )  # e.g., "T1046", "T1048", "T1071"

    technique_name: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
    )  # e.g., "Network Service Discovery", "Exfiltration Over Alternative Protocol"

    subtechnique_id: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
    )  # e.g., "T1048.003"

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    url: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
    )  # Reference link to attack.mitre.org

    # Relationships
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert",
        back_populates="mitre_mapping",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        tid = self.__dict__.get("technique_id", "T0000")
        tname = self.__dict__.get("technique_name", "unknown")
        tactic = self.__dict__.get("tactic_name", "unknown")
        return f"<MitreMapping {tid}: {tname} ({tactic})>"
