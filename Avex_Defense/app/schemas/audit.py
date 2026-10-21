"""
Pydantic schemas for hash-chained tamper-evident audit logs.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class AuditLogBase(BaseModel):
    action: str = Field(..., description="Action or event identifier", examples=["ALERT_GENERATED"])
    actor: str = Field("system", description="Identity or service triggering the event")
    record_payload: Dict[str, Any] = Field(..., description="Canonical payload dictionary")


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogRead(AuditLogBase):
    id: int
    sequence_number: int
    timestamp: datetime
    previous_hash: str
    record_hash: str

    model_config = ConfigDict(from_attributes=True)


class AuditChainVerifyResponse(BaseModel):
    verified: bool = Field(..., description="True if cryptographic chain is completely intact")
    total_records: int = Field(..., description="Number of ledger records inspected")
    tampered_sequence: Optional[int] = Field(None, description="Sequence number of first broken record, if any")
    head_hash: Optional[str] = Field(None, description="SHA-256 hash of latest ledger head record")
    message: str = Field(..., description="Status summary of chain verification")
