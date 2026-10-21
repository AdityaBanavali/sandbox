"""
Pydantic schemas for MITRE ATT&CK mapping management.
"""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MitreMappingBase(BaseModel):
    tactic_name: str = Field(..., description="MITRE Tactic name", examples=["Exfiltration"])
    technique_id: str = Field(..., description="MITRE Technique ID", examples=["T1048"])
    technique_name: str = Field(..., description="MITRE Technique name", examples=["Exfiltration Over Alternative Protocol"])
    subtechnique_id: Optional[str] = Field(None, description="Subtechnique ID", examples=["T1048.003"])
    description: str = Field(..., description="Technique operational description")
    url: Optional[str] = Field(None, description="Official MITRE ATT&CK URL reference")


class MitreMappingCreate(MitreMappingBase):
    pass


class MitreMappingRead(MitreMappingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
