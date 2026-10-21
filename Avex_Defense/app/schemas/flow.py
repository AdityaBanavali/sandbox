"""
Pydantic schemas for Unidirectional Flow telemetry ingestion and retrieval.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FlowBase(BaseModel):
    # 5-Tuple
    src_ip: str = Field(..., description="Source IPv4 or IPv6 address", examples=["192.168.10.45"])
    dst_ip: str = Field(..., description="Destination IPv4 or IPv6 address", examples=["10.0.0.88"])
    src_port: int = Field(..., ge=0, le=65535, description="Source Layer 4 port", examples=[49152])
    dst_port: int = Field(..., ge=0, le=65535, description="Destination Layer 4 port", examples=[53])
    protocol: str = Field(..., description="Transport protocol (e.g. TCP, UDP, ICMP)", examples=["UDP"])

    # Timestamps & Duration
    start_time: datetime = Field(..., description="Timestamp of first observed packet in flow")
    end_time: datetime = Field(..., description="Timestamp of last observed packet in flow")
    duration_ms: float = Field(0.0, ge=0.0, description="Flow duration in milliseconds")

    # Volume Statistics
    packet_count: int = Field(1, ge=1, description="Total packet count in unidirectional direction")
    byte_count: int = Field(0, ge=0, description="Total byte count in unidirectional direction")

    # Packet Size Distribution
    packet_size_mean: float = Field(0.0, ge=0.0)
    packet_size_std: float = Field(0.0, ge=0.0)
    packet_size_min: float = Field(0.0, ge=0.0)
    packet_size_max: float = Field(0.0, ge=0.0)

    # Inter-Arrival Time (IAT) Distribution
    iat_mean: float = Field(0.0, ge=0.0, description="Mean inter-arrival time in milliseconds")
    iat_std: float = Field(0.0, ge=0.0)
    iat_min: float = Field(0.0, ge=0.0)
    iat_max: float = Field(0.0, ge=0.0)

    # Entropy & Extended Features
    payload_entropy: Optional[float] = Field(None, ge=0.0, le=8.0, description="Shannon entropy of payload")
    features: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Extensible ML features")


class FlowCreate(FlowBase):
    pass


class FlowRead(FlowBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FlowIngestBatch(BaseModel):
    flows: List[FlowCreate] = Field(..., description="List of unidirectional flows to ingest")


class FlowIngestResponse(BaseModel):
    ingested_count: int
    flow_ids: List[uuid.UUID]
    message: str
