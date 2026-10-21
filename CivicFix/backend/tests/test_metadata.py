import io
import pytest
import piexif
from PIL import Image, ImageDraw

from app.services.metadata import (
    InvalidImageError,
    analyze_metadata,
    dms_to_decimal,
    haversine_m,
)


def decimal_to_dms(deg_float: float):
    """Converts a decimal degree coordinate to EXIF DMS rational tuples."""
    deg = int(abs(deg_float))
    min_float = (abs(deg_float) - deg) * 60.0
    minute = int(min_float)
    sec_float = (min_float - minute) * 60.0
    sec = int(round(sec_float * 10000))
    return ((deg, 1), (minute, 1), (sec, 10000))


def build_test_jpeg(
    scene_id: int = 1,
    lat: float | None = None,
    lon: float | None = None,
    timestamp: str | None = None,
    size: tuple[int, int] = (250, 250),
    include_exif: bool = True,
) -> bytes:
    """Generates an in-memory JPEG with injected piexif metadata and distinct visual scene content."""
    w, h = size
    r = (scene_id * 67) % 256
    g = (scene_id * 131) % 256
    b = (scene_id * 197) % 256
    img = Image.new("RGB", size, color=(r, g, b))
    draw = ImageDraw.Draw(img)

    if scene_id % 2 == 0:
        draw.rectangle([20, 20, w - 20, h - 20], fill=((r + 80) % 256, (g + 40) % 256, (b + 20) % 256))
        draw.ellipse([40, 40, w - 40, h - 40], fill=((r + 150) % 256, (g + 100) % 256, (b + 80) % 256))
    else:
        draw.polygon([(20, h - 20), (w // 2, 20), (w - 20, h - 20)], fill=((r + 90) % 256, (g + 50) % 256, (b + 110) % 256))
        draw.line([(0, h // 2), (w, h // 2)], fill=(255, 255, 0), width=6)

    buf = io.BytesIO()

    if not include_exif:
        img.save(buf, format="JPEG")
        return buf.getvalue()

    gps_ifd: dict = {}
    if lat is not None and lon is not None:
        lat_ref = b"N" if lat >= 0 else b"S"
        lon_ref = b"E" if lon >= 0 else b"W"
        gps_ifd[piexif.GPSIFD.GPSLatitude] = decimal_to_dms(lat)
        gps_ifd[piexif.GPSIFD.GPSLatitudeRef] = lat_ref
        gps_ifd[piexif.GPSIFD.GPSLongitude] = decimal_to_dms(lon)
        gps_ifd[piexif.GPSIFD.GPSLongitudeRef] = lon_ref

    exif_ifd: dict = {}
    if timestamp:
        exif_ifd[piexif.ExifIFD.DateTimeOriginal] = timestamp.encode("utf-8")

    zeroth_ifd = {piexif.ImageIFD.Make: b"CivicFix Camera"}

    exif_dict = {
        "0th": zeroth_ifd,
        "Exif": exif_ifd,
        "GPS": gps_ifd,
    }
    exif_bytes = piexif.dump(exif_dict)
    img.save(buf, format="JPEG", exif=exif_bytes)
    return buf.getvalue()


# 1. DMS conversion correctness with known coordinate (Bengaluru: 12.9716 N, 77.5946 E)
def test_dms_conversion_known_coordinates():
    # 12 deg, 58 min, 17.76 sec
    lat_dms = ((12, 1), (58, 1), (1776, 100))
    # 77 deg, 35 min, 40.56 sec
    lon_dms = ((77, 1), (35, 1), (4056, 100))

    lat_val = dms_to_decimal(lat_dms, b"N")
    lon_val = dms_to_decimal(lon_dms, b"E")

    assert lat_val is not None
    assert lon_val is not None
    assert abs(lat_val - 12.9716) < 1e-4
    assert abs(lon_val - 77.5946) < 1e-4

    # Test South and West references
    lat_south = dms_to_decimal(lat_dms, "S")
    lon_west = dms_to_decimal(lon_dms, "W")
    assert lat_south is not None and abs(lat_south - (-12.9716)) < 1e-4
    assert lon_west is not None and abs(lon_west - (-77.5946)) < 1e-4

    # Test guard against zero denominator
    invalid_dms = ((12, 0), (58, 1), (1776, 100))
    assert dms_to_decimal(invalid_dms, "N") is None

    # Test empty or incomplete DMS
    assert dms_to_decimal([], "N") is None
    assert dms_to_decimal(((12, 1), (58, 1)), "N") is None


# 2. Haversine distance ~ known distance
def test_haversine_known_distance():
    # Bengaluru coordinates
    lat1, lon1 = 12.9716, 77.5946
    # 0.0002 degrees latitude difference is ~22.24 meters
    lat2, lon2 = 12.9718, 77.5946

    dist = haversine_m(lat1, lon1, lat2, lon2)
    assert 22.0 <= dist <= 22.5

    # Same point should have 0 distance
    assert haversine_m(lat1, lon1, lat1, lon1) == 0.0


# 3. 25m threshold boundary test
def test_distance_threshold_boundary():
    lat1, lon1 = 12.9716, 77.5946
    lat_within, lon_within = 12.9718, 77.5946
    lat_exceed, lon_exceed = 12.9720, 77.5946

    before = build_test_jpeg(scene_id=1, lat=lat1, lon=lon1, timestamp="2026:10:17 10:00:00")
    after_within = build_test_jpeg(scene_id=2, lat=lat_within, lon=lon_within, timestamp="2026:10:17 11:00:00")
    after_exceed = build_test_jpeg(scene_id=2, lat=lat_exceed, lon=lon_exceed, timestamp="2026:10:17 11:00:00")

    # Test within 25m
    res_within = analyze_metadata(before, after_within, max_distance_m=25.0)
    assert res_within.distance_m is not None
    assert res_within.distance_m <= 25.0
    assert res_within.location_mismatch is False
    assert not any("LOCATION_MISMATCH" in f for f in res_within.flags)
    assert res_within.score == 100.0

    # Test exceeding 25m
    res_exceed = analyze_metadata(before, after_exceed, max_distance_m=25.0)
    assert res_exceed.distance_m is not None
    assert res_exceed.distance_m > 25.0
    assert res_exceed.location_mismatch is True
    assert any("LOCATION_MISMATCH" in f for f in res_exceed.flags)
    assert res_exceed.score <= 10.0


# 4. Timestamp inversion test
def test_timestamp_inversion():
    lat, lon = 12.9716, 77.5946
    before = build_test_jpeg(scene_id=1, lat=lat, lon=lon, timestamp="2026:10:17 14:00:00")
    after_inverted = build_test_jpeg(scene_id=2, lat=lat, lon=lon, timestamp="2026:10:17 10:00:00")

    res = analyze_metadata(before, after_inverted)
    assert res.timestamp_valid is False
    assert "TIMESTAMP_SEQUENCE_INVALID" in res.flags
    # Score penalty: 100 - 40 = 60
    assert res.score == 60.0

    # Equal timestamps (after <= before)
    after_equal = build_test_jpeg(scene_id=2, lat=lat, lon=lon, timestamp="2026:10:17 14:00:00")
    res_equal = analyze_metadata(before, after_equal)
    assert res_equal.timestamp_valid is False
    assert "TIMESTAMP_SEQUENCE_INVALID" in res_equal.flags

    # Valid sequence (after > before)
    after_valid = build_test_jpeg(scene_id=2, lat=lat, lon=lon, timestamp="2026:10:17 15:00:00")
    res_valid = analyze_metadata(before, after_valid)
    assert res_valid.timestamp_valid is True
    assert "TIMESTAMP_SEQUENCE_INVALID" not in res_valid.flags


# 5. Missing EXIF test
def test_missing_exif():
    before = build_test_jpeg(scene_id=1, include_exif=False)
    after = build_test_jpeg(scene_id=2, include_exif=False)

    res = analyze_metadata(before, after)
    assert res.before_gps is None
    assert res.after_gps is None
    assert res.distance_m is None
    assert res.location_mismatch is False
    assert res.timestamp_valid is None
    assert "GPS_MISSING_BEFORE" in res.flags
    assert "GPS_MISSING_AFTER" in res.flags
    assert "TIMESTAMP_MISSING" in res.flags
    assert "EXIF_STRIPPED" in res.flags
    # Score calculation: 100 - 30 (GPS before) - 30 (GPS after) - 10 (Timestamp missing) - 15 (EXIF stripped) = 15.0
    assert res.score == 15.0


# 6. Duplicate image test (re-upload)
def test_duplicate_image():
    lat, lon = 12.9716, 77.5946
    image_bytes = build_test_jpeg(scene_id=1, lat=lat, lon=lon, timestamp="2026:10:17 10:00:00")

    # Identical image uploaded as before and after
    res = analyze_metadata(image_bytes, image_bytes)
    assert res.phash_distance == 0
    assert res.is_duplicate_or_reupload is True
    assert "NEAR_IDENTICAL_IMAGES: possible re-upload" in res.flags
    # Identical timestamp (inverted <=) -40, duplicate -60 => 0.0
    assert res.score == 0.0


# 7. Slightly cropped duplicate detection
def test_slightly_cropped_duplicate():
    img = Image.new("RGB", (320, 320), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    for i in range(0, 320, 20):
        draw.line([(0, i), (320, 320 - i)], fill=((i * 3) % 255, (i * 7) % 255, 120), width=3)
    draw.rectangle([40, 40, 280, 280], outline=(200, 20, 20), width=5)
    draw.ellipse([80, 80, 240, 240], fill=(20, 120, 200))

    # Crop 15% from borders
    cropped = img.crop((35, 35, 285, 285))

    buf_before = io.BytesIO()
    img.save(buf_before, format="JPEG")
    before_bytes = buf_before.getvalue()

    buf_after = io.BytesIO()
    cropped.save(buf_after, format="JPEG")
    after_bytes = buf_after.getvalue()

    res = analyze_metadata(before_bytes, after_bytes)
    assert res.is_duplicate_or_reupload is True
    assert "CROPPED_REUPLOAD" in res.flags


# 8. Corrupted or invalid image bytes raising InvalidImageError
def test_corrupted_image_bytes():
    valid = build_test_jpeg(scene_id=1, lat=12.9716, lon=77.5946, timestamp="2026:10:17 10:00:00")
    corrupted = b"not-a-valid-jpeg-stream-of-bytes-at-all"

    with pytest.raises(InvalidImageError, match="before"):
        analyze_metadata(corrupted, valid)

    with pytest.raises(InvalidImageError, match="after"):
        analyze_metadata(valid, corrupted)

    with pytest.raises(InvalidImageError):
        analyze_metadata(b"", valid)
