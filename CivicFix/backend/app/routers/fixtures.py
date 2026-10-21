"""Demo fixtures router for CivicFix AI.

Loads pre-computed evaluation fixtures from disk with an in-memory cache,
allowing full frontend exploration and demo capabilities without requiring
live external API calls or network access.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Response

from app.config import get_settings
from app.schemas import DemoFixture

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Demo Fixtures"])

_cached_fixtures: dict[str, DemoFixture] = {}
_cached_dir_mtime: float = 0.0


def _load_fixtures() -> dict[str, DemoFixture]:
    """Loads and caches all *.json fixtures from FIXTURES_DIR."""
    global _cached_fixtures, _cached_dir_mtime

    settings = get_settings()
    fixtures_dir = Path(settings.FIXTURES_DIR)

    if not fixtures_dir.exists() or not fixtures_dir.is_dir():
        return {}

    try:
        current_mtime = fixtures_dir.stat().st_mtime
    except Exception:
        current_mtime = 0.0

    # Return cached fixtures if directory modification timestamp has not changed
    if _cached_fixtures and current_mtime == _cached_dir_mtime:
        return _cached_fixtures

    loaded: dict[str, DemoFixture] = {}
    json_files = list(fixtures_dir.glob("*.json"))

    for fpath in json_files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                raw_json = json.load(f)
            fixture = DemoFixture.model_validate(raw_json)
            loaded[fixture.id] = fixture
        except Exception as exc:
            logger.error("Failed to parse fixture at %s: %s", fpath, exc)

    _cached_fixtures = loaded
    _cached_dir_mtime = current_mtime
    return _cached_fixtures


@router.get(
    "/demo-fixtures",
    response_model=list[DemoFixture],
    summary="List all available demo fixtures",
    description="Returns pre-computed civic fix verification scenarios for live demonstrations and testing.",
)
async def list_demo_fixtures(response: Response) -> list[DemoFixture]:
    fixtures = _load_fixtures()
    if not fixtures:
        response.headers["X-Fixtures-Hint"] = (
            "Run 'python scripts/generate_fixtures.py' to populate demo fixtures."
        )
        return []

    return list(fixtures.values())


@router.get(
    "/demo-fixtures/{fixture_id}",
    response_model=DemoFixture,
    summary="Get single demo fixture by ID",
    description="Retrieves a specific pre-computed demo verification fixture by its identifier.",
)
async def get_demo_fixture(fixture_id: str) -> DemoFixture:
    fixtures = _load_fixtures()
    if fixture_id not in fixtures:
        raise HTTPException(
            status_code=404,
            detail=f"Fixture '{fixture_id}' not found",
        )
    return fixtures[fixture_id]
