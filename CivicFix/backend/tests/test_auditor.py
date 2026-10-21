import os
from unittest.mock import MagicMock
import pytest

from app.config import Settings
from app.schemas import AuditResult
from app.services.auditor import GeminiAuditSchema, _compute_audit_score, audit_repair


class MockGeminiResponse:
    def __init__(self, parsed=None, text=None):
        self.parsed = parsed
        self.text = text


@pytest.fixture
def fake_images():
    # Minimal 1x1 JPEG bytes
    jpeg_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
        b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342"
        b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
        b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
        b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    )
    return jpeg_bytes, jpeg_bytes


# 1. Valid JSON parse via resp.parsed
def test_valid_json_parsed(monkeypatch, fake_images):
    monkeypatch.setattr(
        "app.services.auditor.get_settings",
        lambda: Settings(GEMINI_API_KEY="fake_key_123"),
    )

    expected_schema = GeminiAuditSchema(
        verdict="RESOLVED",
        confidence_score=0.95,
        defect_detected_before="Deep pothole with visible aggregates",
        status_observed_after="Compacted asphalt flush with surface",
        repair_quality_notes="High quality hot-mix asphalt repair",
        requires_field_reinspection=False,
        red_flags=[],
    )

    def mock_call_gemini(*args, **kwargs):
        return MockGeminiResponse(parsed=expected_schema)

    monkeypatch.setattr("app.services.auditor._call_gemini", mock_call_gemini)

    b1, b2 = fake_images
    res = audit_repair(b1, b2, context={"issue_type": "pothole"})

    assert isinstance(res, AuditResult)
    assert res.source == "gemini"
    assert res.verdict == "RESOLVED"
    assert res.confidence_score == 0.95
    assert res.score == 95.0
    assert res.requires_field_reinspection is False
    assert res.red_flags == []


# 2. Fenced-JSON parse via resp.text
def test_fenced_json_text_parse(monkeypatch, fake_images):
    monkeypatch.setattr(
        "app.services.auditor.get_settings",
        lambda: Settings(GEMINI_API_KEY="fake_key_123"),
    )

    fenced_text = """```json
{
  "verdict": "PARTIALLY_RESOLVED",
  "confidence_score": 0.8,
  "defect_detected_before": "Large garbage dump along curb",
  "status_observed_after": "Debris moved to footpath; bags remain",
  "repair_quality_notes": "Incomplete cleanup",
  "requires_field_reinspection": true,
  "red_flags": ["Waste relocated rather than cleared"]
}
```"""

    def mock_call_gemini(*args, **kwargs):
        return MockGeminiResponse(parsed=None, text=fenced_text)

    monkeypatch.setattr("app.services.auditor._call_gemini", mock_call_gemini)

    b1, b2 = fake_images
    res = audit_repair(b1, b2, context={"issue_type": "garbage"})

    assert res.source == "gemini"
    assert res.verdict == "PARTIALLY_RESOLVED"
    assert res.confidence_score == 0.8
    # 40 + 20 * 0.8 = 56.0
    assert res.score == 56.0
    assert res.requires_field_reinspection is True
    assert "Waste relocated rather than cleared" in res.red_flags


# 3. Invalid verdict string triggers fallback
def test_invalid_verdict_triggers_fallback(monkeypatch, fake_images):
    monkeypatch.setattr(
        "app.services.auditor.get_settings",
        lambda: Settings(GEMINI_API_KEY="fake_key_123"),
    )

    invalid_text = """{
  "verdict": "COMPLETELY_FIXED_PERFECTLY",
  "confidence_score": 0.9,
  "defect_detected_before": "Pothole",
  "status_observed_after": "Fixed",
  "repair_quality_notes": "Ok",
  "requires_field_reinspection": false,
  "red_flags": []
}"""

    def mock_call_gemini(*args, **kwargs):
        return MockGeminiResponse(parsed=None, text=invalid_text)

    monkeypatch.setattr("app.services.auditor._call_gemini", mock_call_gemini)

    b1, b2 = fake_images
    res = audit_repair(b1, b2)

    assert res.source == "fallback"
    assert res.verdict == "PARTIALLY_RESOLVED"
    assert res.score == 50.0
    assert any("LLM_AUDIT_UNAVAILABLE" in f for f in res.red_flags)


# 4. Exception with retries (transient 503) -> fallback
def test_transient_exception_retries_and_falls_back(monkeypatch, fake_images):
    monkeypatch.setattr(
        "app.services.auditor.get_settings",
        lambda: Settings(GEMINI_API_KEY="fake_key_123"),
    )

    call_count = 0
    sleep_calls = []

    def mock_call_gemini(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise RuntimeError("503 Service Temporarily Unavailable")

    monkeypatch.setattr("app.services.auditor._call_gemini", mock_call_gemini)
    monkeypatch.setattr("time.sleep", lambda s: sleep_calls.append(s))

    b1, b2 = fake_images
    res = audit_repair(b1, b2)

    assert call_count == 3
    assert len(sleep_calls) == 2
    assert res.source == "fallback"
    assert res.verdict == "PARTIALLY_RESOLVED"
    assert res.score == 50.0
    assert any("503" in f for f in res.red_flags)


# 5. Missing GEMINI_API_KEY -> fallback without calling Gemini
def test_missing_api_key_falls_back(monkeypatch, fake_images):
    monkeypatch.setattr(
        "app.services.auditor.get_settings",
        lambda: Settings(GEMINI_API_KEY=""),
    )

    mock_call = MagicMock()
    monkeypatch.setattr("app.services.auditor._call_gemini", mock_call)

    b1, b2 = fake_images
    res = audit_repair(b1, b2)

    assert mock_call.call_count == 0
    assert res.source == "fallback"
    assert res.verdict == "PARTIALLY_RESOLVED"
    assert res.score == 50.0
    assert any("GEMINI_API_KEY" in f for f in res.red_flags)


# 6. Score mapping for all four verdicts
def test_score_mapping_for_all_verdicts():
    # RESOLVED -> 100 * conf
    assert _compute_audit_score("RESOLVED", 0.90) == 90.0
    assert _compute_audit_score("RESOLVED", 1.0) == 100.0
    assert _compute_audit_score("RESOLVED", 0.0) == 0.0

    # PARTIALLY_RESOLVED -> 40 + 20 * conf
    assert _compute_audit_score("PARTIALLY_RESOLVED", 0.50) == 50.0
    assert _compute_audit_score("PARTIALLY_RESOLVED", 1.0) == 60.0
    assert _compute_audit_score("PARTIALLY_RESOLVED", 0.0) == 40.0

    # NOT_REPAIRED -> 20 * (1 - conf)
    assert _compute_audit_score("NOT_REPAIRED", 0.0) == 20.0
    assert _compute_audit_score("NOT_REPAIRED", 0.50) == 10.0
    assert _compute_audit_score("NOT_REPAIRED", 1.0) == 0.0

    # SUSPICIOUS_SPOOF -> 0
    assert _compute_audit_score("SUSPICIOUS_SPOOF", 0.99) == 0.0
    assert _compute_audit_score("SUSPICIOUS_SPOOF", 0.0) == 0.0


# 7. Optional live test (skipped unless GEMINI_API_KEY is present in environment)
@pytest.mark.live
def test_live_gemini_audit(fake_images):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        pytest.skip("GEMINI_API_KEY environment variable not set.")

    b1, b2 = fake_images
    res = audit_repair(b1, b2)
    assert isinstance(res, AuditResult)
    assert res.verdict in ("RESOLVED", "PARTIALLY_RESOLVED", "NOT_REPAIRED", "SUSPICIOUS_SPOOF")
    assert 0.0 <= res.confidence_score <= 1.0
    assert 0.0 <= res.score <= 100.0
