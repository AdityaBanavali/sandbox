"""Metadata and geo-verification service for CivicFix AI.

Extracts EXIF metadata (GPS coordinates, timestamps, camera details),
computes geodetic distances, analyzes image perceptual hashes to detect
re-uploads or crops, and evaluates submission authenticity.
"""

from __future__ import annotations

import io
import logging
import math
from datetime import datetime
from typing import Any, Optional, Union

import imagehash
import piexif
from PIL import Image, ImageOps

from app.schemas import GpsPoint, MetadataResult
from app.services.errors import InvalidImageError

logger = logging.getLogger(__name__)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes the great-circle distance between two GPS coordinates in meters.

    Uses the Earth radius constant 6371008.8 meters.

    Args:
        lat1: Latitude of first coordinate in decimal degrees.
        lon1: Longitude of first coordinate in decimal degrees.
        lat2: Latitude of second coordinate in decimal degrees.
        lon2: Longitude of second coordinate in decimal degrees.

    Returns:
        Distance in meters.
    """
    earth_radius_m = 6371008.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return earth_radius_m * c


def dms_to_decimal(dms: Any, ref: Any) -> Optional[float]:
    """Converts EXIF degrees/minutes/seconds rational tuples to decimal degrees.

    Args:
        dms: Sequence of 3 rationals ((deg_num, deg_den), (min_num, min_den), (sec_num, sec_den))
             or sequence of numeric values.
        ref: Direction reference indicator (e.g. 'N', 'S', 'E', 'W' as str or bytes).

    Returns:
        Decimal degrees as float, or None if conversion fails or denominator is zero.
    """
    if not dms or len(dms) < 3:
        return None

    values: list[float] = []
    for comp in dms[:3]:
        if isinstance(comp, (tuple, list)) and len(comp) >= 2:
            num, den = comp[0], comp[1]
            if den == 0:
                return None
            values.append(float(num) / float(den))
        elif isinstance(comp, (int, float)):
            values.append(float(comp))
        else:
            return None

    deg, minutes, sec = values[0], values[1], values[2]
    decimal = deg + (minutes / 60.0) + (sec / 3600.0)

    if ref is not None:
        ref_str = (
            ref.decode("utf-8", errors="ignore").strip().upper()
            if isinstance(ref, bytes)
            else str(ref).strip().upper()
        )
        if ref_str in ("S", "W"):
            decimal = -decimal

    return decimal


def parse_exif_timestamp(raw_val: Any) -> Optional[str]:
    """Parses EXIF timestamp formats into standard ISO 8601 string.

    Args:
        raw_val: Raw EXIF date/time field (bytes or str).

    Returns:
        ISO 8601 formatted timestamp string or None if unparseable.
    """
    if not raw_val:
        return None

    val_str = (
        raw_val.decode("utf-8", errors="ignore").strip().rstrip("\x00")
        if isinstance(raw_val, bytes)
        else str(raw_val).strip()
    )

    formats = (
        "%Y:%m:%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y:%m:%d %H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
    )
    for fmt in formats:
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.isoformat()
        except ValueError:
            continue

    logger.warning("Unrecognized EXIF timestamp format: %s", val_str)
    return None


def _load_image(image_bytes: bytes, label: str) -> Image.Image:
    """Loads and validates an image from raw bytes with orientation correction."""
    if not image_bytes:
        raise InvalidImageError(f"{label.capitalize()} image bytes are empty.")

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
    except Exception as exc:
        logger.error("Failed to decode %s image: %s", label, exc)
        raise InvalidImageError(f"Corrupted or invalid {label} image: {exc}") from exc

    try:
        img = ImageOps.exif_transpose(img)
    except Exception as exc:
        logger.warning("exif_transpose failed for %s image: %s", label, exc)

    return img


def _extract_exif_dict(image_bytes: bytes, img: Image.Image, label: str) -> tuple[dict, bool]:
    """Extracts raw EXIF dictionary safely.

    Returns:
        A tuple of (exif_dict, is_stripped).
    """
    exif_dict: Optional[dict] = None

    try:
        exif_dict = piexif.load(image_bytes)
    except Exception as exc:
        logger.debug("piexif.load from raw bytes failed for %s: %s", label, exc)

    if not exif_dict and hasattr(img, "info") and img.info.get("exif"):
        try:
            exif_dict = piexif.load(img.info["exif"])
        except Exception as exc:
            logger.debug("piexif.load from img.info['exif'] failed for %s: %s", label, exc)

    if not exif_dict:
        return {}, True

    has_0th = bool(exif_dict.get("0th"))
    has_exif = bool(exif_dict.get("Exif"))
    has_gps = bool(exif_dict.get("GPS"))
    has_interop = bool(exif_dict.get("Interop"))
    has_1st = bool(exif_dict.get("1st"))

    if not (has_0th or has_exif or has_gps or has_interop or has_1st):
        return exif_dict, True

    return exif_dict, False


def _extract_gps(exif_dict: dict, label: str) -> Optional[GpsPoint]:
    """Extracts and validates GPS coordinates from an EXIF dict."""
    try:
        gps_ifd = exif_dict.get("GPS")
        if not gps_ifd:
            return None

        lat_dms = gps_ifd.get(piexif.GPSIFD.GPSLatitude)
        lat_ref = gps_ifd.get(piexif.GPSIFD.GPSLatitudeRef)
        lon_dms = gps_ifd.get(piexif.GPSIFD.GPSLongitude)
        lon_ref = gps_ifd.get(piexif.GPSIFD.GPSLongitudeRef)

        if not (lat_dms and lat_ref and lon_dms and lon_ref):
            return None

        lat = dms_to_decimal(lat_dms, lat_ref)
        lon = dms_to_decimal(lon_dms, lon_ref)

        if lat is None or lon is None:
            return None

        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            logger.warning(
                "Extracted GPS coordinate out of valid range for %s: lat=%s, lon=%s",
                label,
                lat,
                lon,
            )
            return None

        return GpsPoint(lat=float(lat), lon=float(lon))
    except Exception as exc:
        logger.warning("Error reading GPS from EXIF for %s: %s", label, exc)
        return None


def _extract_timestamp(exif_dict: dict, label: str) -> Optional[str]:
    """Extracts timestamp from DateTimeOriginal or DateTime tags."""
    try:
        exif_ifd = exif_dict.get("Exif", {})
        zeroth_ifd = exif_dict.get("0th", {})

        raw_ts = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal)
        if not raw_ts:
            raw_ts = zeroth_ifd.get(piexif.ImageIFD.DateTime)

        if not raw_ts:
            return None

        return parse_exif_timestamp(raw_ts)
    except Exception as exc:
        logger.warning("Error reading timestamp from EXIF for %s: %s", label, exc)
        return None


def analyze_metadata(
    before_bytes: bytes,
    after_bytes: bytes,
    max_distance_m: float = 25.0,
) -> MetadataResult:
    """Analyzes metadata and image hashing for BEFORE and AFTER photos.

    Scoring model (deterministic 0-100):
      - Initial score: 100.0
      - Location mismatch (distance > max_distance_m): score = min(score, 10.0)
      - Missing GPS: -30.0 applied once per image without GPS
      - Invalid timestamp sequence (after <= before): -40.0
      - Missing timestamp (either image missing): -10.0
      - Duplicate/re-upload detected (pHash distance <= 5 or crop match): -60.0
      - EXIF stripped entirely: -15.0 extra penalty
      - Final score clamped to [0.0, 100.0]

    Args:
        before_bytes: Raw byte buffer of the BEFORE image.
        after_bytes: Raw byte buffer of the AFTER image.
        max_distance_m: Maximum acceptable distance threshold in meters.

    Returns:
        MetadataResult detailing GPS, timestamp sequence, perceptual hash distance,
        anti-spoofing flags, and composite metadata score.

    Raises:
        InvalidImageError: If either image cannot be decoded or is corrupted.
    """
    img_before = _load_image(before_bytes, "before")
    img_after = _load_image(after_bytes, "after")

    flags: list[str] = []

    # 1. EXIF and GPS Extraction
    exif_before, stripped_before = _extract_exif_dict(before_bytes, img_before, "before")
    exif_after, stripped_after = _extract_exif_dict(after_bytes, img_after, "after")

    before_gps = _extract_gps(exif_before, "before")
    after_gps = _extract_gps(exif_after, "after")

    if before_gps is None:
        flags.append("GPS_MISSING_BEFORE")
    if after_gps is None:
        flags.append("GPS_MISSING_AFTER")

    # 2. Distance and Location Check
    distance_m: Optional[float] = None
    location_mismatch = False

    if before_gps is not None and after_gps is not None:
        distance_m = haversine_m(
            before_gps.lat, before_gps.lon, after_gps.lat, after_gps.lon
        )
        if distance_m > max_distance_m:
            location_mismatch = True
            flags.append(
                f"LOCATION_MISMATCH: {distance_m:.1f}m apart (limit {max_distance_m}m)"
            )

    # 3. Timestamp Sequence Verification
    before_ts = _extract_timestamp(exif_before, "before")
    after_ts = _extract_timestamp(exif_after, "after")
    timestamp_valid: Optional[bool] = None

    if before_ts is not None and after_ts is not None:
        try:
            dt_before = datetime.fromisoformat(before_ts)
            dt_after = datetime.fromisoformat(after_ts)
            if dt_after <= dt_before:
                timestamp_valid = False
                flags.append("TIMESTAMP_SEQUENCE_INVALID")
            else:
                timestamp_valid = True
        except Exception as exc:
            logger.warning("Failed to parse ISO timestamps for comparison: %s", exc)
            timestamp_valid = None
            flags.append("TIMESTAMP_MISSING")
    else:
        timestamp_valid = None
        flags.append("TIMESTAMP_MISSING")

    # 4. EXIF Stripped Flag
    is_exif_stripped = stripped_before or stripped_after
    if is_exif_stripped:
        flags.append("EXIF_STRIPPED")

    # 5. Perceptual Hashing & Duplicate / Crop Detection
    img_before_rgb = img_before.convert("RGB")
    img_after_rgb = img_after.convert("RGB")

    phash_before_obj = imagehash.phash(img_before_rgb, hash_size=8)
    phash_after_obj = imagehash.phash(img_after_rgb, hash_size=8)
    phash_before_str = str(phash_before_obj)
    phash_after_str = str(phash_after_obj)
    phash_distance = int(phash_before_obj - phash_after_obj)

    is_duplicate_or_reupload = False

    is_cropped_match = False
    try:
        crh_before = imagehash.crop_resistant_hash(img_before_rgb)
        crh_after = imagehash.crop_resistant_hash(img_after_rgb)
        if crh_before.matches(crh_after):
            is_cropped_match = True
    except Exception as exc:
        logger.warning("crop_resistant_hash comparison failed: %s", exc)

    if phash_distance <= 5:
        is_duplicate_or_reupload = True
        flags.append("NEAR_IDENTICAL_IMAGES: possible re-upload")
    elif is_cropped_match:
        is_duplicate_or_reupload = True
        flags.append("CROPPED_REUPLOAD")

    # 6. Score Calculation
    score = 100.0

    if location_mismatch:
        score = min(score, 10.0)

    if before_gps is None:
        score -= 30.0

    if after_gps is None:
        score -= 30.0

    if timestamp_valid is False:
        score -= 40.0
    elif timestamp_valid is None:
        score -= 10.0

    if is_duplicate_or_reupload:
        score -= 60.0

    if is_exif_stripped:
        score -= 15.0

    score = max(0.0, min(100.0, score))

    return MetadataResult(
        before_gps=before_gps,
        after_gps=after_gps,
        distance_m=round(distance_m, 2) if distance_m is not None else None,
        before_timestamp=before_ts,
        after_timestamp=after_ts,
        timestamp_valid=timestamp_valid,
        phash_before=phash_before_str,
        phash_after=phash_after_str,
        phash_distance=phash_distance,
        is_duplicate_or_reupload=is_duplicate_or_reupload,
        location_mismatch=location_mismatch,
        flags=flags,
        score=score,
    )
