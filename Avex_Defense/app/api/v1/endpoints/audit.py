"""
Audit API router: tamper-evident ledger inspection, dual-storage verification, and cryptographic chain validation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogRead, AuditChainVerifyResponse
from app.services.audit_service import AuditService

router = APIRouter()


@router.get(
    "",
    response_model=List[AuditLogRead],
    summary="List chronological audit records from the database ledger",
)
async def list_audit_logs(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None, description="Filter by event action (e.g. ALERT_GENERATED, FLOW_INGESTED)"),
    actor: Optional[str] = Query(None, description="Filter by event actor"),
    start_time: Optional[datetime] = Query(None, description="Filter records on or after timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter records on or before timestamp"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Retrieves chronological audit entries with optional action and actor filters.
    Returns total count in 'X-Total-Count' response header.
    """
    filters = []
    if action:
        filters.append(AuditLog.action == action.upper())
    if actor:
        filters.append(AuditLog.actor.ilike(f"%{actor}%"))
    if start_time:
        filters.append(AuditLog.timestamp >= start_time)
    if end_time:
        filters.append(AuditLog.timestamp <= end_time)

    count_stmt = select(func.count(AuditLog.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(AuditLog).order_by(AuditLog.sequence_number.desc()).offset(skip).limit(limit)
    if filters:
        stmt = stmt.where(and_(*filters))

    result = await db.execute(stmt)
    response.headers["X-Total-Count"] = str(total)
    return list(result.scalars().all())


@router.get(
    "/summary",
    status_code=status.HTTP_200_OK,
    summary="Retrieve cryptographic audit ledger summary and synchronization status",
)
async def get_audit_summary(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Returns high-level forensic status across both database and physical file ledgers:
    - Total record counts
    - Current chain head SHA-256 hashes
    - Dual ledger sync state
    """
    return await AuditService.get_ledger_summary(db=db)


@router.get(
    "/ledger/file",
    status_code=status.HTTP_200_OK,
    summary="Read records directly from the physical append-only file ledger",
)
async def read_file_ledger_records(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> List[Dict[str, Any]]:
    """
    Reads entries directly from the physical JSONL audit file, useful for offline forensic auditing.
    """
    records, total = AuditService.read_file_ledger(skip=skip, limit=limit)
    response.headers["X-Total-Count"] = str(total)
    return records


@router.post(
    "/verify-chain",
    response_model=AuditChainVerifyResponse,
    summary="Cryptographically verify the database tamper-evident hash chain",
)
async def verify_audit_chain(
    db: AsyncSession = Depends(get_async_session),
):
    """
    Traverses all records in the database audit ledger from sequence 1 to Head,
    recalculating and verifying all SHA-256 links and payload preimages.
    Any alteration, deletion, or rogue injection will fail this verification.
    """
    valid, count, bad_seq, head_hash, message = await AuditService.verify_chain_async(db=db)
    return AuditChainVerifyResponse(
        verified=valid,
        total_records=count,
        tampered_sequence=bad_seq,
        head_hash=head_hash,
        message=message,
    )


@router.post(
    "/verify-file",
    response_model=AuditChainVerifyResponse,
    summary="Cryptographically verify the physical flat file ledger",
)
async def verify_file_ledger():
    """
    Traverses the physical append-only flat file ledger line-by-line,
    recalculating all SHA-256 hashes and previous hash pointers.
    """
    valid, count, bad_seq, head_hash, message = AuditService.verify_file_ledger()
    return AuditChainVerifyResponse(
        verified=valid,
        total_records=count,
        tampered_sequence=bad_seq,
        head_hash=head_hash,
        message=message,
    )


@router.post(
    "/verify-all",
    status_code=status.HTTP_200_OK,
    summary="Perform complete dual verification (Database + File + Cross-Consistency)",
)
async def verify_all_ledgers(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Executes forensic multi-ledger validation:
    1. Verifies database SHA-256 cryptographic chain.
    2. Verifies physical file ledger SHA-256 cryptographic chain.
    3. Cross-verifies 1:1 parity between database and file entries.
    """
    db_valid, db_count, db_bad_seq, db_head, db_msg = await AuditService.verify_chain_async(db=db)
    file_valid, file_count, file_bad_seq, file_head, file_msg = AuditService.verify_file_ledger()
    cross_valid, cross_count, cross_msg = await AuditService.verify_cross_consistency(db=db)

    overall_valid = db_valid and file_valid and cross_valid

    return {
        "overall_verified": overall_valid,
        "database_ledger": {
            "verified": db_valid,
            "total_records": db_count,
            "tampered_sequence": db_bad_seq,
            "head_hash": db_head,
            "status": db_msg,
        },
        "file_ledger": {
            "verified": file_valid,
            "total_records": file_count,
            "tampered_sequence": file_bad_seq,
            "head_hash": file_head,
            "status": file_msg,
        },
        "cross_consistency": {
            "verified": cross_valid,
            "matched_records": cross_count,
            "status": cross_msg,
        },
    }
