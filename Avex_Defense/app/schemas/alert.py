"""
Pydantic schemas for Threat Alerts.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.mitre import MitreMappingRead


class AlertBase(BaseModel):
    flow_id: uuid.UUID = Field(..., description="Source unidirectional flow UUID")
    mitre_mapping_id: Optional[uuid.UUID] = Field(None, description="Linked MITRE ATT&CK technique UUID")
    severity: str = Field("MEDIUM", description="Alert severity level (LOW, MEDIUM, HIGH, CRITICAL)")
    severity_score: float = Field(..., ge=0.0, le=10.0, description="Severity score from 0.0 to 10.0")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model detection confidence 0.0 to 1.0")
    behavior_class: str = Field(..., description="Threat classification label", examples=["DNS Tunneling Exfiltration"])
    status: str = Field("NEW", description="Triage status (NEW, INVESTIGATING, RESOLVED, FALSE_POSITIVE)")
    model_version: str = Field("v1.0.0", description="AI Model artifact version")
    explanation: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Explainability feature metrics")


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    status: Optional[str] = Field(None, description="Updated status: NEW, INVESTIGATING, RESOLVED, FALSE_POSITIVE")
    severity: Optional[str] = Field(None, description="Updated severity: LOW, MEDIUM, HIGH, CRITICAL")


class AlertRead(AlertBase):
    id: uuid.UUID
    timestamp: datetime
    created_at: datetime
    updated_at: datetime
    mitre_mapping: Optional[MitreMappingRead] = None

    model_config = ConfigDict(from_attributes=True)
