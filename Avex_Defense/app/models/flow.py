"""
Flow model representing unidirectional IP network traffic telemetry.
Captures 5-tuple flow identification, temporal properties, and extracted statistical features.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional, Any, Dict

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Uuid,
    JSON,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.alert import Alert


class Flow(Base, TimestampMixin):
    """
    Unidirectional IP Flow Telemetry Model.
    In unidirectional taps / data diodes, reverse direction metrics are absent.
    This table stores forward unidirectional flow stats, packet timing, entropy,
    and extensible statistical feature vectors for AI threat detection.
    """
    __tablename__ = "flows"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # 5-Tuple Network Identification
    src_ip: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    dst_ip: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    src_port: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    dst_port: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    protocol: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # e.g., 'TCP', 'UDP', 'ICMP', 'GRE'

    # Temporal Metrics
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Volume & Statistical Distribution Features
    packet_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    byte_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Packet Size Statistics (in bytes)
    packet_size_mean: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    packet_size_std: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    packet_size_min: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    packet_size_max: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Inter-Arrival Time (IAT) Statistics (in milliseconds)
    iat_mean: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    iat_std: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    iat_min: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    iat_max: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Payload Entropy (Shannon entropy: 0.0 - 8.0, critical for detecting encrypted/covert exfiltration)
    payload_entropy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Extensible Statistical & Behavioral Features (e.g. TCP flags, burstiness, quantiles)
    features: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        default=dict,
    )

    # Relationships
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert",
        back_populates="flow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("idx_flows_src_dst_time", "src_ip", "dst_ip", "start_time"),
        Index("idx_flows_protocol_dst_port", "protocol", "dst_port"),
    )

    def __repr__(self) -> str:
        fid = self.__dict__.get("id", "detached")
        sip = self.__dict__.get("src_ip", "0.0.0.0")
        sport = self.__dict__.get("src_port", 0)
        dip = self.__dict__.get("dst_ip", "0.0.0.0")
        dport = self.__dict__.get("dst_port", 0)
        proto = self.__dict__.get("protocol", "UNKNOWN")
        pkts = self.__dict__.get("packet_count", 0)
        return (
            f"<Flow {fid} {sip}:{sport} -> "
            f"{dip}:{dport} [{proto}] pkts={pkts}>"
        )
