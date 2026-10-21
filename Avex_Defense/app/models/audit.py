"""
Audit log model implementing a cryptographically hash-chained tamper-evident ledger.
Stores sequence number, previous hash, canonical record payload, and cryptographic SHA-256 hash.
"""

from datetime import datetime
from typing import Any, Dict

from sqlalchemy import (
    BigInteger,
    Integer,
    DateTime,
    Index,
    String,
    JSON,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

GENESIS_HASH = "0" * 64


class AuditLog(Base):
    """
    Tamper-Evident Hash-Chained Audit Ledger.
    Every row commits to the SHA-256 hash of its predecessor.
    Any modification, insertion, or deletion of past records invalidates the cryptographic chain.
    """
    __tablename__ = "audit_logs"

    # Monotonic sequential integer identifier
    id: Mapped[int] = mapped_column(
        Integer().with_variant(BigInteger, "postgresql"),
        primary_key=True,
        autoincrement=True,
    )

    # Strictly monotonic sequence number for chain ordering (1, 2, 3...)
    sequence_number: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        nullable=False,
        index=True,
    )

    # Timestamp of log entry creation
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Event action / type (e.g., 'FLOW_INGESTED', 'ALERT_GENERATED', 'ALERT_STATUS_CHANGED')
    action: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    # Actor responsible (e.g. system agent, worker, user ID, API key)
    actor: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        default="system",
    )

    # SHA-256 hash of the immediate prior audit log entry (Genesis block uses 64 zeros)
    previous_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    # Current event record payload (stored canonically)
    record_payload: Mapped[Dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )

    # Cryptographic SHA-256 hash of:
    # (sequence_number + timestamp_iso + action + actor + previous_hash + canonical_json(record_payload))
    record_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("idx_audit_sequence_timestamp", "sequence_number", "timestamp"),
        Index("idx_audit_action_actor", "action", "actor"),
    )

    def __repr__(self) -> str:
        seq = self.__dict__.get("sequence_number", 0)
        act = self.__dict__.get("action", "unknown")
        actor = self.__dict__.get("actor", "unknown")
        r_hash = str(self.__dict__.get("record_hash", ""))
        return (
            f"<AuditLog seq={seq} action={act} "
            f"actor={actor} hash={r_hash[:12]}...>"
        )
