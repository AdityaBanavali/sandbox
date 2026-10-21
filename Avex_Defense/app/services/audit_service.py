"""
Cryptographic Audit Service for Tamper-Evident Hash-Chained Ledger.
Implements SHA-256 chained hashing with canonical JSON serialization across
both relational database tables and append-only flat file storage ("blockchain-lite" ledger).
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.audit import AuditLog, GENESIS_HASH

logger = logging.getLogger("cyber_defense.audit")

DEFAULT_LEDGER_FILE = os.getenv("AUDIT_LEDGER_FILE", "logs/audit_ledger.jsonl")


def canonical_json(data: Dict[str, Any]) -> str:
    """
    Serializes a dictionary into a deterministic canonical JSON string.
    Keys are sorted and no extraneous whitespace is introduced.
    """
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


def compute_record_hash(
    sequence_number: int,
    timestamp: datetime,
    action: str,
    actor: str,
    previous_hash: str,
    payload: Dict[str, Any],
) -> str:
    """
    Computes SHA-256 hash over all immutable fields of an audit record:
    SHA-256(sequence || ISO timestamp || action || actor || previous_hash || canonical_json(payload))
    """
    if timestamp.tzinfo is None:
        ts_str = timestamp.replace(tzinfo=timezone.utc).isoformat()
    else:
        ts_str = timestamp.astimezone(timezone.utc).isoformat()

    payload_str = canonical_json(payload)
    preimage = f"{sequence_number}|{ts_str}|{action}|{actor}|{previous_hash}|{payload_str}".encode("utf-8")
    return hashlib.sha256(preimage).hexdigest()


def append_entry_to_file(entry: Dict[str, Any], file_path: str = DEFAULT_LEDGER_FILE) -> None:
    """
    Atomically appends a verified audit ledger entry to the physical append-only flat file.
    """
    try:
        dir_name = os.path.dirname(file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        with open(file_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, sort_keys=True, default=str) + "\n")
    except Exception as exc:
        logger.error("Failed to append audit record to file %s: %s", file_path, exc)


class AuditService:
    """
    Service managing atomic append and verification of hash-chained audit logs across
    database tables and physical append-only flat file ledgers.
    """

    @staticmethod
    async def append_async(
        db: AsyncSession,
        action: str,
        record_payload: Dict[str, Any],
        actor: str = "system",
        file_path: str = DEFAULT_LEDGER_FILE,
    ) -> AuditLog:
        """
        Asynchronously appends a new verified record to the hash-chained audit log in both
        the PostgreSQL database and the forensic flat file ledger.
        """
        # Serialize audit log appends across concurrent requests/workers
        try:
            await db.execute(text("SELECT pg_advisory_xact_lock(145261)"))
        except Exception:
            pass

        # Fetch the latest record in the chain
        stmt = select(AuditLog).order_by(AuditLog.sequence_number.desc()).limit(1)
        result = await db.execute(stmt)
        latest_record = result.scalars().first()

        if latest_record is None:
            sequence_number = 1
            previous_hash = GENESIS_HASH
        else:
            sequence_number = latest_record.sequence_number + 1
            previous_hash = latest_record.record_hash

        now_utc = datetime.now(timezone.utc)
        record_hash = compute_record_hash(
            sequence_number=sequence_number,
            timestamp=now_utc,
            action=action,
            actor=actor,
            previous_hash=previous_hash,
            payload=record_payload,
        )

        audit_entry = AuditLog(
            sequence_number=sequence_number,
            timestamp=now_utc,
            action=action,
            actor=actor,
            previous_hash=previous_hash,
            record_payload=record_payload,
            record_hash=record_hash,
        )

        db.add(audit_entry)
        await db.flush()

        # Simultaneously append to append-only flat file ledger
        file_entry = {
            "sequence_number": sequence_number,
            "timestamp": now_utc.isoformat(),
            "action": action,
            "actor": actor,
            "previous_hash": previous_hash,
            "record_payload": record_payload,
            "record_hash": record_hash,
        }
        append_entry_to_file(file_entry, file_path=file_path)

        return audit_entry

    @staticmethod
    def append_sync(
        session: Session,
        action: str,
        record_payload: Dict[str, Any],
        actor: str = "system",
        file_path: str = DEFAULT_LEDGER_FILE,
    ) -> AuditLog:
        """
        Synchronously appends a new verified record to the hash-chained audit log
        (used by Celery workers and CLI utilities).
        """
        # Serialize audit log appends across concurrent worker processes
        try:
            session.execute(text("SELECT pg_advisory_xact_lock(145261)"))
        except Exception:
            pass

        latest_record = (
            session.query(AuditLog)
            .order_by(AuditLog.sequence_number.desc())
            .first()
        )

        if latest_record is None:
            sequence_number = 1
            previous_hash = GENESIS_HASH
        else:
            sequence_number = latest_record.sequence_number + 1
            previous_hash = latest_record.record_hash

        now_utc = datetime.now(timezone.utc)
        record_hash = compute_record_hash(
            sequence_number=sequence_number,
            timestamp=now_utc,
            action=action,
            actor=actor,
            previous_hash=previous_hash,
            payload=record_payload,
        )

        audit_entry = AuditLog(
            sequence_number=sequence_number,
            timestamp=now_utc,
            action=action,
            actor=actor,
            previous_hash=previous_hash,
            record_payload=record_payload,
            record_hash=record_hash,
        )

        session.add(audit_entry)
        session.flush()

        # Simultaneously append to flat file
        file_entry = {
            "sequence_number": sequence_number,
            "timestamp": now_utc.isoformat(),
            "action": action,
            "actor": actor,
            "previous_hash": previous_hash,
            "record_payload": record_payload,
            "record_hash": record_hash,
        }
        append_entry_to_file(file_entry, file_path=file_path)

        return audit_entry

    @staticmethod
    async def verify_chain_async(
        db: AsyncSession,
    ) -> Tuple[bool, int, Optional[int], Optional[str], str]:
        """
        Verifies the cryptographic integrity of the database audit ledger from Genesis to Head.
        Returns:
            (is_valid, total_records, tampered_sequence_number, head_hash, message)
        """
        stmt = select(AuditLog).order_by(AuditLog.sequence_number.asc())
        result = await db.execute(stmt)
        records = result.scalars().all()

        total = len(records)
        if total == 0:
            return True, 0, None, None, "Audit database chain is empty; 0 records."

        expected_prev_hash = GENESIS_HASH

        for idx, record in enumerate(records):
            expected_seq = idx + 1
            # Check 1: Sequence continuity
            if record.sequence_number != expected_seq:
                return (
                    False,
                    total,
                    record.sequence_number,
                    record.record_hash,
                    f"Chain sequence broken at position {idx}: expected seq {expected_seq}, found {record.sequence_number}.",
                )

            # Check 2: Linkage to previous hash
            if record.previous_hash != expected_prev_hash:
                return (
                    False,
                    total,
                    record.sequence_number,
                    record.record_hash,
                    f"Tampering detected at seq {record.sequence_number}: previous_hash mismatch.",
                )

            # Check 3: Cryptographic hash self-consistency
            computed_hash = compute_record_hash(
                sequence_number=record.sequence_number,
                timestamp=record.timestamp,
                action=record.action,
                actor=record.actor,
                previous_hash=record.previous_hash,
                payload=record.record_payload,
            )

            if computed_hash != record.record_hash:
                return (
                    False,
                    total,
                    record.sequence_number,
                    record.record_hash,
                    f"Tampering detected at seq {record.sequence_number}: record_hash recalculation mismatch.",
                )

            expected_prev_hash = record.record_hash

        head_hash = records[-1].record_hash
        return (
            True,
            total,
            None,
            head_hash,
            f"Cryptographic integrity verified across all {total} database audit records.",
        )

    @staticmethod
    def verify_file_ledger(
        file_path: str = DEFAULT_LEDGER_FILE,
    ) -> Tuple[bool, int, Optional[int], Optional[str], str]:
        """
        Verifies the cryptographic integrity of the flat JSONL file ledger from Genesis to Head.
        """
        if not os.path.exists(file_path):
            return True, 0, None, None, f"Audit ledger file '{file_path}' does not exist yet."

        records: List[Dict[str, Any]] = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError as exc:
                        return False, len(records), None, None, f"Corrupt JSON line in file ledger: {exc}"

        total = len(records)
        if total == 0:
            return True, 0, None, None, "File ledger is empty; 0 records."

        expected_prev_hash = GENESIS_HASH

        for idx, rec in enumerate(records):
            expected_seq = idx + 1
            seq = rec.get("sequence_number")
            rec_hash = rec.get("record_hash")

            if not isinstance(seq, int) or seq != expected_seq:
                return False, total, seq if isinstance(seq, int) else None, rec_hash, f"File ledger sequence broken at position {idx}: expected {expected_seq}, found {seq}."

            prev_h = rec.get("previous_hash")
            if not isinstance(prev_h, str) or prev_h != expected_prev_hash:
                return False, total, seq, rec_hash, f"File ledger tampering detected at seq {seq}: previous_hash mismatch."

            ts_raw = rec.get("timestamp")
            if not ts_raw:
                return False, total, seq, rec_hash, f"Missing timestamp at seq {seq}."
            ts = datetime.fromisoformat(ts_raw)

            action = rec.get("action", "")
            actor = rec.get("actor", "")
            payload = rec.get("record_payload", {})

            computed = compute_record_hash(
                sequence_number=seq,
                timestamp=ts,
                action=action,
                actor=actor,
                previous_hash=prev_h,
                payload=payload,
            )
            if computed != rec_hash:
                return False, total, seq, rec_hash, f"File ledger tampering detected at seq {seq}: cryptographic hash recalculation mismatch."

            expected_prev_hash = rec_hash

        head_hash = records[-1].get("record_hash")
        return True, total, None, head_hash, f"Cryptographic integrity verified across all {total} file ledger records."

    @staticmethod
    async def verify_cross_consistency(
        db: AsyncSession,
        file_path: str = DEFAULT_LEDGER_FILE,
    ) -> Tuple[bool, int, str]:
        """
        Cross-verifies that the database ledger and the physical file ledger match 1:1.
        Ensures identical record counts, sequences, and cryptographic hashes.
        """
        # DB records
        stmt = select(AuditLog).order_by(AuditLog.sequence_number.asc())
        db_records = (await db.execute(stmt)).scalars().all()

        # File records
        file_records: List[Dict[str, Any]] = []
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        file_records.append(json.loads(line))

        db_len = len(db_records)
        file_len = len(file_records)

        if db_len != file_len:
            return (
                False,
                min(db_len, file_len),
                f"Ledger mismatch: Database has {db_len} records while flat file has {file_len} records.",
            )

        for idx, (db_rec, f_rec) in enumerate(zip(db_records, file_records)):
            if db_rec.sequence_number != f_rec.get("sequence_number"):
                return False, idx + 1, f"Sequence number mismatch at index {idx}: DB={db_rec.sequence_number}, File={f_rec.get('sequence_number')}."

            if db_rec.record_hash != f_rec.get("record_hash"):
                return False, idx + 1, f"Hash divergence at sequence {db_rec.sequence_number}: DB={db_rec.record_hash[:16]}... vs File={f_rec.get('record_hash', '')[:16]}..."

        return True, db_len, f"Dual storage cross-consistency verified across all {db_len} records."

    @staticmethod
    def read_file_ledger(
        file_path: str = DEFAULT_LEDGER_FILE,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Reads chronological records directly from the physical file ledger.
        """
        if not os.path.exists(file_path):
            return [], 0

        records: List[Dict[str, Any]] = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))

        total = len(records)
        # Return reverse chronological page
        reversed_records = list(reversed(records))
        page = reversed_records[skip : skip + limit]
        return page, total

    @staticmethod
    async def get_ledger_summary(
        db: AsyncSession,
        file_path: str = DEFAULT_LEDGER_FILE,
    ) -> Dict[str, Any]:
        """
        Returns high-level status of the cryptographic audit ledger.
        """
        db_count = (await db.execute(select(func.count(AuditLog.id)))).scalar_one()
        latest_stmt = select(AuditLog).order_by(AuditLog.sequence_number.desc()).limit(1)
        latest_db = (await db.execute(latest_stmt)).scalars().first()

        file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        file_records_count = 0
        latest_file_hash = None
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        file_records_count += 1
                        try:
                            latest_file_hash = json.loads(line.strip()).get("record_hash")
                        except Exception:
                            pass

        return {
            "database_ledger": {
                "total_records": db_count,
                "head_hash": latest_db.record_hash if latest_db else GENESIS_HASH,
                "genesis_hash": GENESIS_HASH,
            },
            "file_ledger": {
                "file_path": file_path,
                "file_size_bytes": file_size_bytes,
                "total_records": file_records_count,
                "head_hash": latest_file_hash or GENESIS_HASH,
            },
            "dual_ledger_in_sync": (db_count == file_records_count) and (
                (latest_db.record_hash if latest_db else GENESIS_HASH) == (latest_file_hash or GENESIS_HASH)
            ),
        }
