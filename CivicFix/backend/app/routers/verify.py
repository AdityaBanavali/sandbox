"""Verification API router for CivicFix AI.

Accepts contractor submission photos (BEFORE and AFTER), validates uploads,
coordinates multi-layer analysis (Metadata, OpenCV Vision, Gemini Multimodal Audit),
computes Trust Scores, and returns comprehensive verification reports.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import get_settings
from app.schemas import (
    AuditResult,
    MetadataResult,
    VerifyResponse,
    VisionResult,
)
from app.services.auditor import _sniff_mime_type, audit_repair
from app.services.errors import InvalidImageError
from app.services.metadata import analyze_metadata
from app.services.trust import compute_trust
from app.services.vision import VisionArtifacts, analyze_vision, encode_jpeg_b64

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Verification"])

ALLOWED_ISSUE_TYPES = {"pothole", "garbage", "drain", "other"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


async def _read_and_validate_file(
    file: UploadFile,
    label: str,
    max_bytes: int,
) -> bytes:
    """Reads uploaded file with a hard size cap, validates MIME type and magic bytes."""
    content = bytearray()
    chunk_size = 64 * 1024

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        content.extend(chunk)
        if len(content) > max_bytes:
            max_mb = max_bytes // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"{label.capitalize()} image exceeds maximum upload size limit of {max_mb}MB",
            )

    data = bytes(content)
    if len(data) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"{label.capitalize()} image is empty.",
        )

    # Validate declared MIME type
    declared_mime = (file.content_type or "").lower().strip()
    if declared_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content-type '{declared_mime}' for {label} image. Allowed: image/jpeg, image/png, image/webp",
        )

    # Sniff magic bytes
    sniffed_mime = _sniff_mime_type(data)
    if sniffed_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Invalid file signature for {label} image. Allowed: image/jpeg, image/png, image/webp",
        )

    return data


@router.post(
    "/verify-fix",
    response_model=VerifyResponse,
    summary="Verify municipal work fix",
    description="Upload BEFORE and AFTER photographs to perform anti-spoofing metadata analysis, OpenCV visual registration, and Gemini multimodal auditing.",
)
async def verify_fix(
    before_image: UploadFile = File(..., description="Complaint / Before repair photo"),
    after_image: UploadFile = File(..., description="Claimed resolution / After repair photo"),
    issue_type: str = Form("pothole", description="Type of municipal defect: pothole, garbage, drain, other"),
) -> VerifyResponse:
    start_time = time.perf_counter()
    settings = get_settings()

    # 1. Input Validation
    normalized_issue_type = issue_type.lower().strip()
    if normalized_issue_type not in ALLOWED_ISSUE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid issue_type '{issue_type}'. Allowed types: {', '.join(sorted(ALLOWED_ISSUE_TYPES))}",
        )

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    before_bytes = await _read_and_validate_file(before_image, "before", max_bytes)
    after_bytes = await _read_and_validate_file(after_image, "after", max_bytes)

    warnings: list[str] = []

    # 2. Layer 1: Metadata & Geodetic Verification
    try:
        metadata_res = await asyncio.to_thread(
            analyze_metadata, before_bytes, after_bytes, settings.MAX_GPS_DISTANCE_M
        )
    except InvalidImageError:
        raise
    except Exception as exc:
        logger.exception("Unexpected error in metadata stage: %s", exc)
        warnings.append(f"Metadata stage encountered an error: {exc}")
        metadata_res = MetadataResult(
            before_gps=None,
            after_gps=None,
            distance_m=None,
            before_timestamp=None,
            after_timestamp=None,
            timestamp_valid=None,
            phash_before=None,
            phash_after=None,
            phash_distance=None,
            is_duplicate_or_reupload=False,
            location_mismatch=False,
            flags=["METADATA_ANALYSIS_FAILED"],
            score=50.0,
        )

    # 3. Concurrent Execution of Layer 2 (Vision) and Layer 3 (Multimodal Audit)
    audit_context = {
        "issue_type": normalized_issue_type,
        "metadata_flags": metadata_res.flags,
    }

    vision_task = asyncio.to_thread(analyze_vision, before_bytes, after_bytes)
    audit_task = asyncio.to_thread(audit_repair, before_bytes, after_bytes, audit_context)

    vision_outcome, audit_outcome = await asyncio.gather(
        vision_task, audit_task, return_exceptions=True
    )

    # Handle Vision Outcome
    vision_res: VisionResult
    artifacts: Optional[VisionArtifacts] = None

    if isinstance(vision_outcome, InvalidImageError):
        raise vision_outcome
    elif isinstance(vision_outcome, Exception):
        logger.exception("Unexpected error in vision stage: %s", vision_outcome)
        warnings.append(f"Vision stage encountered an error: {vision_outcome}")
        vision_res = VisionResult(
            keypoints_before=0,
            keypoints_after=0,
            good_matches=0,
            inliers=0,
            alignment_succeeded=False,
            change_magnitude=0.0,
            roughness_before=None,
            roughness_after=None,
            roughness_drop_ratio=None,
            flags=["VISION_ANALYSIS_FAILED"],
            score=50.0,
        )
    else:
        vision_res, artifacts = vision_outcome

    # Handle Audit Outcome
    audit_res: AuditResult
    if isinstance(audit_outcome, Exception):
        logger.exception("Unexpected error in audit stage: %s", audit_outcome)
        warnings.append(f"Audit stage encountered an error: {audit_outcome}")
        audit_res = AuditResult(
            verdict="PARTIALLY_RESOLVED",
            confidence_score=0.0,
            defect_detected_before="N/A",
            status_observed_after="N/A",
            repair_quality_notes="Automated audit encountered an unexpected error.",
            requires_field_reinspection=True,
            red_flags=["AUDIT_ANALYSIS_FAILED"],
            source="fallback",
            score=50.0,
        )
    else:
        audit_res = audit_outcome

    # 4. Synthesize Trust Score
    trust_score, trust_status, breakdown = compute_trust(
        metadata=metadata_res,
        vision=vision_res,
        audit=audit_res,
        warnings=warnings,
    )

    # 5. Build Base64 Image Representations
    before_b64 = base64.b64encode(before_bytes).decode("utf-8")
    after_b64 = base64.b64encode(after_bytes).decode("utf-8")
    aligned_after_b64 = (
        encode_jpeg_b64(artifacts.aligned_after)
        if artifacts and artifacts.aligned_after is not None
        else None
    )
    diff_heatmap_b64 = (
        encode_jpeg_b64(artifacts.diff_heatmap)
        if artifacts and artifacts.diff_heatmap is not None
        else None
    )

    processing_ms = int(round((time.perf_counter() - start_time) * 1000))

    return VerifyResponse(
        trust_score=trust_score,
        status=trust_status,
        breakdown=breakdown,
        metadata=metadata_res,
        vision=vision_res,
        audit=audit_res,
        before_image_b64=before_b64,
        after_image_b64=after_b64,
        aligned_after_image_b64=aligned_after_b64,
        diff_heatmap_b64=diff_heatmap_b64,
        processing_ms=processing_ms,
        warnings=warnings,
    )
