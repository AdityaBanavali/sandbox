import io
import json
from pathlib import Path
from unittest.mock import patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.main import app
from app.schemas import (
    AuditResult,
    DemoFixture,
    GpsPoint,
    MetadataResult,
    TrustBreakdown,
    VerifyResponse,
    VisionResult,
)
from app.services.errors import InvalidImageError
from app.services.trust import compute_trust
from app.services.vision import VisionArtifacts

# Helper minimal 1x1 valid JPEG bytes
VALID_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
)


def make_dummy_metadata(score: float = 80.0, location_mismatch: bool = False, duplicate: bool = False) -> MetadataResult:
    return MetadataResult(
        before_gps=GpsPoint(lat=12.9716, lon=77.5946),
        after_gps=GpsPoint(lat=12.9718, lon=77.5946),
        distance_m=22.2,
        before_timestamp="2026-10-17T10:00:00",
        after_timestamp="2026-10-17T11:00:00",
        timestamp_valid=True,
        phash_before="1234",
        phash_after="5678",
        phash_distance=20,
        is_duplicate_or_reupload=duplicate,
        location_mismatch=location_mismatch,
        flags=[],
        score=score,
    )


def make_dummy_vision(score: float = 80.0) -> VisionResult:
    return VisionResult(
        keypoints_before=100,
        keypoints_after=100,
        good_matches=40,
        inliers=35,
        alignment_succeeded=True,
        change_magnitude=0.15,
        roughness_before=500.0,
        roughness_after=100.0,
        roughness_drop_ratio=0.8,
        flags=[],
        score=score,
    )


def make_dummy_audit(score: float = 80.0, verdict: str = "RESOLVED", conf: float = 0.9, source: str = "gemini") -> AuditResult:
    return AuditResult(
        verdict=verdict,  # type: ignore[arg-type]
        confidence_score=conf,
        defect_detected_before="Pothole",
        status_observed_after="Flush repair",
        repair_quality_notes="Good asphalt work",
        requires_field_reinspection=False,
        red_flags=[],
        source=source,  # type: ignore[arg-type]
        score=score,
    )


# ==============================================================================
# Unit Tests: compute_trust Threshold Boundaries and Hard Overrides
# ==============================================================================

def test_compute_trust_boundaries():
    # Boundary 49.9 -> REJECTED_FRAUD
    # 0.3*50 + 0.3*50 + 0.4*49.75 = 15 + 15 + 19.9 = 49.9
    m = make_dummy_metadata(score=50.0)
    v = make_dummy_vision(score=50.0)
    a = make_dummy_audit(score=49.75)
    score, status, _ = compute_trust(m, v, a)
    assert score == 49.9
    assert status == "REJECTED_FRAUD"

    # Boundary 50.0 -> NEEDS_REVIEW
    # 0.3*50 + 0.3*50 + 0.4*50 = 50.0
    a50 = make_dummy_audit(score=50.0)
    score50, status50, _ = compute_trust(m, v, a50)
    assert score50 == 50.0
    assert status50 == "NEEDS_REVIEW"

    # Boundary 79.9 -> NEEDS_REVIEW
    # 0.3*80 + 0.3*80 + 0.4*79.75 = 24 + 24 + 31.9 = 79.9
    m80 = make_dummy_metadata(score=80.0)
    v80 = make_dummy_vision(score=80.0)
    a79 = make_dummy_audit(score=79.75)
    score79, status79, _ = compute_trust(m80, v80, a79)
    assert score79 == 79.9
    assert status79 == "NEEDS_REVIEW"

    # Boundary 80.0 -> APPROVED
    # 0.3*80 + 0.3*80 + 0.4*80 = 80.0
    a80 = make_dummy_audit(score=80.0)
    score80, status80, _ = compute_trust(m80, v80, a80)
    assert score80 == 80.0
    assert status80 == "APPROVED"


def test_compute_trust_hard_overrides():
    # 1. Location mismatch overrides to REJECTED_FRAUD and caps score at 30
    m_loc = make_dummy_metadata(score=100.0, location_mismatch=True)
    v = make_dummy_vision(score=100.0)
    a = make_dummy_audit(score=100.0)
    score, status, _ = compute_trust(m_loc, v, a)
    assert status == "REJECTED_FRAUD"
    assert score == 30.0

    # 2. Suspicious spoof with confidence >= 0.6 overrides to REJECTED_FRAUD
    m = make_dummy_metadata(score=90.0)
    a_spoof = make_dummy_audit(score=0.0, verdict="SUSPICIOUS_SPOOF", conf=0.7)
    score_spoof, status_spoof, _ = compute_trust(m, v, a_spoof)
    assert status_spoof == "REJECTED_FRAUD"

    # 3. Duplicate re-upload overrides to REJECTED_FRAUD
    m_dup = make_dummy_metadata(score=90.0, duplicate=True)
    score_dup, status_dup, _ = compute_trust(m_dup, v, a)
    assert status_dup == "REJECTED_FRAUD"


def test_compute_trust_fallback_downgrades_approved():
    # Composite score 90.0 would be APPROVED, but audit source is "fallback"
    m = make_dummy_metadata(score=90.0)
    v = make_dummy_vision(score=90.0)
    a_fb = make_dummy_audit(score=90.0, source="fallback")
    warnings: list[str] = []
    score, status, _ = compute_trust(m, v, a_fb, warnings=warnings)
    assert score == 90.0
    assert status == "NEEDS_REVIEW"
    assert any("downgraded" in w for w in warnings)


# ==============================================================================
# Integration Tests: FastAPI Endpoints via AsyncClient
# ==============================================================================

@pytest.mark.anyio
async def test_timing_middleware():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert "X-Process-Time" in resp.headers


@pytest.mark.anyio
async def test_verify_fix_happy_path(monkeypatch):
    monkeypatch.setattr(
        "app.routers.verify.analyze_metadata",
        lambda *args, **kwargs: make_dummy_metadata(score=90.0),
    )
    monkeypatch.setattr(
        "app.routers.verify.analyze_vision",
        lambda *args, **kwargs: (make_dummy_vision(score=90.0), VisionArtifacts(aligned_after=None, diff_heatmap=None, defect_roi=None)),
    )
    monkeypatch.setattr(
        "app.routers.verify.audit_repair",
        lambda *args, **kwargs: make_dummy_audit(score=90.0),
    )

    files = {
        "before_image": ("before.jpg", VALID_JPEG_BYTES, "image/jpeg"),
        "after_image": ("after.jpg", VALID_JPEG_BYTES, "image/jpeg"),
    }
    data = {"issue_type": "pothole"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/verify-fix", files=files, data=data)

    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["trust_score"] == 90.0
    assert res_data["status"] == "APPROVED"
    assert res_data["breakdown"]["metadata"] == 90.0
    assert res_data["breakdown"]["vision"] == 90.0
    assert res_data["breakdown"]["llm"] == 90.0
    assert res_data["processing_ms"] >= 0


@pytest.mark.anyio
async def test_verify_fix_oversized_file(monkeypatch):
    # Set MAX_UPLOAD_MB to 1MB and attempt to send 1.5MB
    monkeypatch.setattr(
        "app.routers.verify.get_settings",
        lambda: Settings(MAX_UPLOAD_MB=1),
    )

    oversized = VALID_JPEG_BYTES + (b"\x00" * (1024 * 1024 + 100))
    files = {
        "before_image": ("before.jpg", oversized, "image/jpeg"),
        "after_image": ("after.jpg", VALID_JPEG_BYTES, "image/jpeg"),
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/verify-fix", files=files, data={"issue_type": "pothole"})

    assert resp.status_code == 413
    assert "exceeds maximum upload size" in resp.json()["detail"]


@pytest.mark.anyio
async def test_verify_fix_wrong_mime():
    files = {
        "before_image": ("before.txt", b"plain text content", "text/plain"),
        "after_image": ("after.jpg", VALID_JPEG_BYTES, "image/jpeg"),
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/verify-fix", files=files, data={"issue_type": "pothole"})

    assert resp.status_code == 415


@pytest.mark.anyio
async def test_verify_fix_corrupted_image(monkeypatch):
    def mock_invalid(*args, **kwargs):
        raise InvalidImageError("Corrupted before image header")

    monkeypatch.setattr("app.routers.verify.analyze_metadata", mock_invalid)

    files = {
        "before_image": ("before.jpg", VALID_JPEG_BYTES, "image/jpeg"),
        "after_image": ("after.jpg", VALID_JPEG_BYTES, "image/jpeg"),
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/verify-fix", files=files, data={"issue_type": "pothole"})

    assert resp.status_code == 422
    assert "Corrupted before image" in resp.json()["detail"]


@pytest.mark.anyio
async def test_verify_fix_location_mismatch_override(monkeypatch):
    monkeypatch.setattr(
        "app.routers.verify.analyze_metadata",
        lambda *args, **kwargs: make_dummy_metadata(score=90.0, location_mismatch=True),
    )
    monkeypatch.setattr(
        "app.routers.verify.analyze_vision",
        lambda *args, **kwargs: (make_dummy_vision(score=90.0), VisionArtifacts(None, None, None)),
    )
    monkeypatch.setattr(
        "app.routers.verify.audit_repair",
        lambda *args, **kwargs: make_dummy_audit(score=90.0),
    )

    files = {
        "before_image": ("before.jpg", VALID_JPEG_BYTES, "image/jpeg"),
        "after_image": ("after.jpg", VALID_JPEG_BYTES, "image/jpeg"),
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/verify-fix", files=files, data={"issue_type": "pothole"})

    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "REJECTED_FRAUD"
    assert res["trust_score"] <= 30.0


@pytest.mark.anyio
async def test_verify_fix_fallback_audit_prevents_approved(monkeypatch):
    monkeypatch.setattr(
        "app.routers.verify.analyze_metadata",
        lambda *args, **kwargs: make_dummy_metadata(score=95.0),
    )
    monkeypatch.setattr(
        "app.routers.verify.analyze_vision",
        lambda *args, **kwargs: (make_dummy_vision(score=95.0), VisionArtifacts(None, None, None)),
    )
    monkeypatch.setattr(
        "app.routers.verify.audit_repair",
        lambda *args, **kwargs: make_dummy_audit(score=95.0, source="fallback"),
    )

    files = {
        "before_image": ("before.jpg", VALID_JPEG_BYTES, "image/jpeg"),
        "after_image": ("after.jpg", VALID_JPEG_BYTES, "image/jpeg"),
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/verify-fix", files=files, data={"issue_type": "pothole"})

    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "NEEDS_REVIEW"
    assert any("downgraded" in w for w in res["warnings"])


# ==============================================================================
# Demo Fixtures Endpoint Tests
# ==============================================================================

@pytest.mark.anyio
async def test_demo_fixtures_empty_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.routers.fixtures.get_settings",
        lambda: Settings(FIXTURES_DIR=tmp_path),
    )
    # Clear in-memory cache
    import app.routers.fixtures as fix_mod
    fix_mod._cached_fixtures = {}
    fix_mod._cached_dir_mtime = 0.0

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/demo-fixtures")

    assert resp.status_code == 200
    assert resp.json() == []
    assert "X-Fixtures-Hint" in resp.headers


@pytest.mark.anyio
async def test_demo_fixtures_populated_dir(tmp_path, monkeypatch):
    sample_verify = VerifyResponse(
        trust_score=85.0,
        status="APPROVED",
        breakdown=TrustBreakdown(metadata=85.0, vision=85.0, llm=85.0),
        metadata=make_dummy_metadata(score=85.0),
        vision=make_dummy_vision(score=85.0),
        audit=make_dummy_audit(score=85.0),
        before_image_b64=None,
        after_image_b64=None,
        aligned_after_image_b64=None,
        diff_heatmap_b64=None,
        processing_ms=120,
        warnings=[],
    )
    fixture_item = DemoFixture(
        id="demo_pothole_1",
        label="Legitimate Pothole Repair",
        description="Fresh hot-mix asphalt filling on Residency Road",
        expected_status="APPROVED",
        result=sample_verify,
    )

    fixture_file = tmp_path / "demo_pothole_1.json"
    fixture_file.write_text(fixture_item.model_dump_json(), encoding="utf-8")

    monkeypatch.setattr(
        "app.routers.fixtures.get_settings",
        lambda: Settings(FIXTURES_DIR=tmp_path),
    )
    import app.routers.fixtures as fix_mod
    fix_mod._cached_fixtures = {}
    fix_mod._cached_dir_mtime = 0.0

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp_list = await client.get("/api/v1/demo-fixtures")
        resp_single = await client.get("/api/v1/demo-fixtures/demo_pothole_1")
        resp_404 = await client.get("/api/v1/demo-fixtures/non_existent_fixture")

    assert resp_list.status_code == 200
    assert len(resp_list.json()) == 1
    assert resp_list.json()[0]["id"] == "demo_pothole_1"

    assert resp_single.status_code == 200
    assert resp_single.json()["id"] == "demo_pothole_1"

    assert resp_404.status_code == 404
