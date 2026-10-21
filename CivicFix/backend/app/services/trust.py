"""Trust scoring synthesis module for CivicFix AI.

Aggregates individual layer scores (Metadata, Vision, and Multimodal Audit),
enforces security hard overrides (anti-spoofing, location mismatch, duplicate detection),
applies verification guards, and computes composite Trust Score (0-100) and TrustStatus.
"""

from __future__ import annotations

from typing import Optional

from app.schemas import AuditResult, MetadataResult, TrustBreakdown, TrustStatus, VisionResult


def compute_trust(
    metadata: MetadataResult,
    vision: VisionResult,
    audit: AuditResult,
    warnings: Optional[list[str]] = None,
) -> tuple[float, TrustStatus, TrustBreakdown]:
    """Computes composite trust score, breakdown, and final resolution status.

    Scoring formula:
        Composite = round(0.30 * metadata.score + 0.30 * vision.score + 0.40 * audit.score, 1)

    Standard status thresholds:
        - APPROVED: score >= 80.0
        - NEEDS_REVIEW: 50.0 <= score < 80.0
        - REJECTED_FRAUD: score < 50.0

    Hard overrides (checked first):
        1. metadata.location_mismatch is True:
           - Overrides status to REJECTED_FRAUD.
           - Caps score at min(score, 30.0).
        2. audit.verdict == "SUSPICIOUS_SPOOF" with confidence >= 0.6:
           - Overrides status to REJECTED_FRAUD.
        3. metadata.is_duplicate_or_reupload is True:
           - Overrides status to REJECTED_FRAUD.

    Verification guard:
        - If the status evaluates to APPROVED but audit.source == "fallback" (meaning
          no multimodal AI audit was available to verify physical execution), the status
          is downgraded to NEEDS_REVIEW and an explanatory note is appended to warnings.

    Args:
        metadata: Result from metadata & geo-verification layer.
        vision: Result from computer vision alignment & surface roughness layer.
        audit: Result from Gemini multimodal inspection layer.
        warnings: Optional mutable list to append operational warnings to.

    Returns:
        A tuple of (composite_score, status, breakdown).
    """
    raw_score = 0.30 * metadata.score + 0.30 * vision.score + 0.40 * audit.score
    composite_score = round(max(0.0, min(100.0, raw_score)), 1)

    breakdown = TrustBreakdown(
        metadata=round(metadata.score, 1),
        vision=round(vision.score, 1),
        llm=round(audit.score, 1),
    )

    # 1. Evaluate Hard Overrides
    hard_override_fraud = False

    if metadata.location_mismatch:
        hard_override_fraud = True
        composite_score = min(composite_score, 30.0)

    if audit.verdict == "SUSPICIOUS_SPOOF" and audit.confidence_score >= 0.60:
        hard_override_fraud = True

    if metadata.is_duplicate_or_reupload:
        hard_override_fraud = True

    if hard_override_fraud:
        return composite_score, "REJECTED_FRAUD", breakdown

    # 2. Standard Thresholds
    status: TrustStatus
    if composite_score >= 80.0:
        status = "APPROVED"
    elif composite_score >= 50.0:
        status = "NEEDS_REVIEW"
    else:
        status = "REJECTED_FRAUD"

    # 3. Guard: Downgrade APPROVED if audit was fallback
    if status == "APPROVED" and audit.source == "fallback":
        status = "NEEDS_REVIEW"
        if warnings is not None:
            warnings.append(
                "AI audit unavailable (fallback mode): status downgraded from APPROVED to NEEDS_REVIEW."
            )

    return composite_score, status, breakdown
