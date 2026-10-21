"""
MITRE ATT&CK API router: retrieve TTP mappings, tactics overview, and trigger seed operations.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.schemas.mitre import MitreMappingRead, MitreMappingCreate
from app.schemas.alert import AlertRead
from app.services.mitre_service import MitreService

router = APIRouter()


@router.get(
    "",
    response_model=List[MitreMappingRead],
    summary="List all registered MITRE ATT&CK techniques",
)
async def list_mitre_techniques(
    limit: int = 100,
    db: AsyncSession = Depends(get_async_session),
):
    return await MitreService.list_all(db=db, limit=limit)


@router.get(
    "/tactics",
    status_code=status.HTTP_200_OK,
    summary="Retrieve grouped MITRE tactics overview with alert metrics",
)
async def get_tactics_overview(
    db: AsyncSession = Depends(get_async_session),
) -> List[Dict[str, Any]]:
    """
    Returns an aggregated list of all adversary tactics, the techniques registered
    under each tactic, and the count of threat alerts attributed to each.
    """
    return await MitreService.get_tactics_overview(db=db)


@router.get(
    "/tactics/{tactic_name}/alerts",
    response_model=List[AlertRead],
    summary="Retrieve all alerts classified under a specific MITRE tactic",
)
async def get_alerts_by_tactic(
    tactic_name: str,
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Returns all alerts mapped to techniques belonging to the specified MITRE tactic
    (e.g., 'Exfiltration', 'Discovery', 'Command and Control').
    """
    alerts, total = await MitreService.get_alerts_by_tactic(
        db=db,
        tactic_name=tactic_name,
        skip=skip,
        limit=limit,
    )
    response.headers["X-Total-Count"] = str(total)
    return alerts


@router.post(
    "/seed",
    status_code=status.HTTP_200_OK,
    summary="Seed default unidirectional IP threat techniques",
)
async def seed_mitre_defaults(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    added = await MitreService.seed_defaults(db=db)
    return {
        "status": "success",
        "newly_seeded_count": added,
        "message": f"Seeded {added} MITRE ATT&CK techniques into the database.",
    }


@router.post(
    "",
    response_model=MitreMappingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new MITRE technique mapping",
)
async def create_mitre_mapping(
    technique_in: MitreMappingCreate,
    db: AsyncSession = Depends(get_async_session),
):
    existing = await MitreService.get_by_technique_id(db=db, technique_id=technique_in.technique_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Technique ID {technique_in.technique_id} is already registered.",
        )
    return await MitreService.create(db=db, obj_in=technique_in)


@router.get(
    "/{technique_id}",
    response_model=MitreMappingRead,
    summary="Lookup a specific technique by ID (e.g. T1048)",
)
async def get_mitre_technique(
    technique_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    mapping = await MitreService.get_by_technique_id(db=db, technique_id=technique_id)
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Technique {technique_id} not found.",
        )
    return mapping
