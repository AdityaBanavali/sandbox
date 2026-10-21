from typing import Literal, Optional
from pydantic import BaseModel, Field


class GpsPoint(BaseModel):
    lat: float
    lon: float


class MetadataResult(BaseModel):
    before_gps: Optional[GpsPoint] = None
    after_gps: Optional[GpsPoint] = None
    distance_m: Optional[float] = None
    before_timestamp: Optional[str] = None
    after_timestamp: Optional[str] = None
    timestamp_valid: Optional[bool] = None
    phash_before: Optional[str] = None
    phash_after: Optional[str] = None
    phash_distance: Optional[int] = None
    is_duplicate_or_reupload: bool
    location_mismatch: bool
    flags: list[str] = Field(default_factory=list)
    score: float = Field(..., ge=0.0, le=100.0)


class VisionResult(BaseModel):
    keypoints_before: int
    keypoints_after: int
    good_matches: int
    inliers: int
    alignment_succeeded: bool
    change_magnitude: float = Field(..., ge=0.0, le=1.0)
    roughness_before: Optional[float] = None
    roughness_after: Optional[float] = None
    roughness_drop_ratio: Optional[float] = None
    flags: list[str] = Field(default_factory=list)
    score: float = Field(..., ge=0.0, le=100.0)


Verdict = Literal["RESOLVED", "PARTIALLY_RESOLVED", "NOT_REPAIRED", "SUSPICIOUS_SPOOF"]


class AuditResult(BaseModel):
    verdict: Verdict
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    defect_detected_before: str
    status_observed_after: str
    repair_quality_notes: str
    requires_field_reinspection: bool
    red_flags: list[str] = Field(default_factory=list)
    source: Literal["gemini", "fallback"]
    score: float = Field(..., ge=0.0, le=100.0)


class TrustBreakdown(BaseModel):
    metadata: float
    vision: float
    llm: float


TrustStatus = Literal["APPROVED", "NEEDS_REVIEW", "REJECTED_FRAUD"]


class VerifyResponse(BaseModel):
    trust_score: float
    status: TrustStatus
    breakdown: TrustBreakdown
    metadata: MetadataResult
    vision: VisionResult
    audit: AuditResult
    before_image_b64: Optional[str] = None
    after_image_b64: Optional[str] = None
    aligned_after_image_b64: Optional[str] = None
    diff_heatmap_b64: Optional[str] = None
    processing_ms: int
    warnings: list[str] = Field(default_factory=list)


class DemoFixture(BaseModel):
    id: str
    label: str
    description: str
    expected_status: TrustStatus
    result: VerifyResponse
