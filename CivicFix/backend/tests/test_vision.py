import cv2
import numpy as np
import pytest

from app.services.errors import InvalidImageError
from app.services.vision import VisionArtifacts, analyze_vision, encode_jpeg_b64


def to_jpeg_bytes(img: np.ndarray, quality: int = 90) -> bytes:
    """Encodes an OpenCV image to JPEG bytes."""
    success, buffer = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    assert success, "Failed to encode test image to JPEG"
    return buffer.tobytes()


def generate_blob_scene(seed: int = 42, size: tuple[int, int] = (400, 400)) -> np.ndarray:
    """Generates a rich textured image with pseudo-random geometric blobs and colors."""
    rng = np.random.RandomState(seed)
    w, h = size
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Base noise
    noise = rng.randint(40, 90, (h, w, 3), dtype=np.uint8)
    img = cv2.add(img, noise)

    for _ in range(60):
        cx = rng.randint(40, w - 40)
        cy = rng.randint(40, h - 40)
        r = rng.randint(6, 22)
        color = (int(rng.randint(50, 255)), int(rng.randint(50, 255)), int(rng.randint(50, 255)))
        cv2.circle(img, (cx, cy), r, color, -1)

    for _ in range(15):
        pt1 = (int(rng.randint(10, w - 10)), int(rng.randint(10, h - 10)))
        pt2 = (int(rng.randint(10, w - 10)), int(rng.randint(10, h - 10)))
        color = (int(rng.randint(50, 255)), int(rng.randint(50, 255)), int(rng.randint(50, 255)))
        cv2.line(img, pt1, pt2, color, 3)

    return img


# (a) The same scene shifted/rotated -> alignment succeeds with high inliers
def test_same_scene_shifted_rotated():
    base = generate_blob_scene(seed=42, size=(400, 400))

    # Apply 4-degree rotation and translation (+10, -8)
    center = (200, 200)
    rot_mat = cv2.getRotationMatrix2D(center, 4.0, 1.0)
    rot_mat[0, 2] += 10.0
    rot_mat[1, 2] += -8.0
    shifted = cv2.warpAffine(base, rot_mat, (400, 400))

    before_bytes = to_jpeg_bytes(base)
    after_bytes = to_jpeg_bytes(shifted)

    result, artifacts = analyze_vision(before_bytes, after_bytes)

    assert result.alignment_succeeded is True
    assert result.inliers >= 30
    assert result.good_matches >= 30
    assert result.change_magnitude <= 0.15
    assert "ALIGNMENT_FAILED: scenes may not match (possible different location)" not in result.flags
    assert artifacts.aligned_after is not None
    assert artifacts.aligned_after.shape == base.shape
    assert artifacts.diff_heatmap is not None
    assert artifacts.diff_heatmap.shape == base.shape
    assert artifacts.defect_roi is not None
    assert result.score > 40.0


# (b) Two unrelated textures -> alignment fails gracefully with the flag
def test_unrelated_textures_alignment_fails():
    im1 = generate_blob_scene(seed=101, size=(400, 400))

    # Create completely different scene structure (rectangles and grid lines)
    rng = np.random.RandomState(999)
    im2 = np.zeros((400, 400, 3), dtype=np.uint8)
    for _ in range(50):
        x = rng.randint(10, 350)
        y = rng.randint(10, 350)
        cv2.rectangle(im2, (x, y), (x + 35, y + 35), (int(rng.randint(50, 255)), int(rng.randint(50, 255)), int(rng.randint(50, 255))), -1)

    before_bytes = to_jpeg_bytes(im1)
    after_bytes = to_jpeg_bytes(im2)

    result, artifacts = analyze_vision(before_bytes, after_bytes)

    assert result.alignment_succeeded is False
    assert any("ALIGNMENT_FAILED" in f for f in result.flags)
    assert artifacts.aligned_after is not None
    assert artifacts.diff_heatmap is not None


# (c) A rough patch replaced by smooth patch -> positive roughness drop
def test_rough_patch_replaced_by_smooth_patch():
    base = generate_blob_scene(seed=202, size=(400, 400))

    # Before: inject high-frequency noise & cracks in central ROI
    before_img = base.copy()
    rng = np.random.RandomState(77)
    rough_patch = rng.randint(0, 255, (120, 120, 3), dtype=np.uint8)
    for i in range(10):
        cv2.line(rough_patch, (i * 12, 0), (i * 12, 120), (255, 255, 255), 2)
    before_img[140:260, 140:260] = rough_patch

    # After: smooth uniform compacted asphalt patch
    after_img = base.copy()
    smooth_patch = np.full((120, 120, 3), 110, dtype=np.uint8)
    smooth_patch = cv2.GaussianBlur(smooth_patch, (7, 7), 0)
    after_img[140:260, 140:260] = smooth_patch

    before_bytes = to_jpeg_bytes(before_img)
    after_bytes = to_jpeg_bytes(after_img)

    result, artifacts = analyze_vision(before_bytes, after_bytes)

    assert result.alignment_succeeded is True
    assert result.roughness_before is not None
    assert result.roughness_after is not None
    assert result.roughness_drop_ratio is not None
    assert result.roughness_drop_ratio > 0.20
    assert "SURFACE_ROUGHER_AFTER" not in result.flags
    assert "NO_SURFACE_SMOOTHING" not in result.flags
    assert result.score > 50.0


# (d) Tiny and blank images -> no crash, graceful degradation
def test_tiny_and_blank_images():
    # 1. Blank images
    blank_b = to_jpeg_bytes(np.zeros((100, 100, 3), dtype=np.uint8))
    blank_a = to_jpeg_bytes(np.full((100, 100, 3), 255, dtype=np.uint8))

    res_blank, art_blank = analyze_vision(blank_b, blank_a)
    assert res_blank.alignment_succeeded is False
    assert "INSUFFICIENT_FEATURES" in res_blank.flags
    assert art_blank.aligned_after is not None
    assert art_blank.diff_heatmap is not None

    # 2. Tiny images (12x12)
    tiny_b = to_jpeg_bytes(np.random.randint(0, 255, (12, 12, 3), dtype=np.uint8))
    tiny_a = to_jpeg_bytes(np.random.randint(0, 255, (12, 12, 3), dtype=np.uint8))

    res_tiny, art_tiny = analyze_vision(tiny_b, tiny_a)
    assert isinstance(res_tiny.score, float)
    assert art_tiny.aligned_after is not None
    assert art_tiny.diff_heatmap is not None


# (e) Corrupted bytes -> InvalidImageError
def test_corrupted_image_bytes():
    valid = to_jpeg_bytes(np.zeros((100, 100, 3), dtype=np.uint8))
    corrupted = b"not-a-valid-image-format-stream"

    with pytest.raises(InvalidImageError, match="before"):
        analyze_vision(corrupted, valid)

    with pytest.raises(InvalidImageError, match="after"):
        analyze_vision(valid, corrupted)

    with pytest.raises(InvalidImageError):
        analyze_vision(b"", valid)


# Helper: Base64 JPEG encoding
def test_encode_jpeg_b64():
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    b64_str = encode_jpeg_b64(img, quality=80)
    assert isinstance(b64_str, str)
    assert len(b64_str) > 0

    # None and empty array handling
    assert encode_jpeg_b64(None) == ""
    assert encode_jpeg_b64(np.array([])) == ""
