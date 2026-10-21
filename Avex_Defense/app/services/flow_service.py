"""
Flow Service for ingesting, validating, and retrieving unidirectional network traffic flows.
"""

import math
import uuid
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.flow import Flow
from app.schemas.flow import FlowCreate
from app.services.audit_service import AuditService


def calculate_shannon_entropy(payload_bytes: bytes) -> float:
    """
    Calculates the Shannon entropy (0.0 to 8.0) of arbitrary network payload bytes.
    High entropy (~7.5+) typically indicates encrypted, compressed, or covert payloads.
    """
    if not payload_bytes:
        return 0.0
    length = len(payload_bytes)
    counts = Counter(payload_bytes)
    entropy = 0.0
    for count in counts.values():
        p_x = count / length
        entropy -= p_x * math.log2(p_x)
    return round(entropy, 4)


class FlowService:
    @staticmethod
    async def create_flow(
        db: AsyncSession,
        flow_in: FlowCreate,
        actor: str = "flow_collector",
    ) -> Flow:
        """
        Ingests a single unidirectional flow record and logs the event to the audit ledger.
        """
        db_flow = Flow(
            src_ip=flow_in.src_ip,
            dst_ip=flow_in.dst_ip,
            src_port=flow_in.src_port,
            dst_port=flow_in.dst_port,
            protocol=flow_in.protocol.upper(),
            start_time=flow_in.start_time,
            end_time=flow_in.end_time,
            duration_ms=flow_in.duration_ms,
            packet_count=flow_in.packet_count,
            byte_count=flow_in.byte_count,
            packet_size_mean=flow_in.packet_size_mean,
            packet_size_std=flow_in.packet_size_std,
            packet_size_min=flow_in.packet_size_min,
            packet_size_max=flow_in.packet_size_max,
            iat_mean=flow_in.iat_mean,
            iat_std=flow_in.iat_std,
            iat_min=flow_in.iat_min,
            iat_max=flow_in.iat_max,
            payload_entropy=flow_in.payload_entropy,
            features=flow_in.features or {},
        )
        db.add(db_flow)
        await db.flush()

        # Commit to tamper-evident audit ledger
        await AuditService.append_async(
            db=db,
            action="FLOW_INGESTED",
            record_payload={
                "flow_id": str(db_flow.id),
                "5_tuple": f"{db_flow.src_ip}:{db_flow.src_port} -> {db_flow.dst_ip}:{db_flow.dst_port} [{db_flow.protocol}]",
                "packets": db_flow.packet_count,
                "bytes": db_flow.byte_count,
                "entropy": db_flow.payload_entropy,
            },
            actor=actor,
        )

        return db_flow

    @staticmethod
    async def create_batch(
        db: AsyncSession,
        flows_in: List[FlowCreate],
        actor: str = "flow_collector_batch",
    ) -> List[Flow]:
        """
        Efficiently ingests a batch of unidirectional flows.
        """
        created_flows: List[Flow] = []
        for flow_in in flows_in:
            db_flow = Flow(
                src_ip=flow_in.src_ip,
                dst_ip=flow_in.dst_ip,
                src_port=flow_in.src_port,
                dst_port=flow_in.dst_port,
                protocol=flow_in.protocol.upper(),
                start_time=flow_in.start_time,
                end_time=flow_in.end_time,
                duration_ms=flow_in.duration_ms,
                packet_count=flow_in.packet_count,
                byte_count=flow_in.byte_count,
                packet_size_mean=flow_in.packet_size_mean,
                packet_size_std=flow_in.packet_size_std,
                packet_size_min=flow_in.packet_size_min,
                packet_size_max=flow_in.packet_size_max,
                iat_mean=flow_in.iat_mean,
                iat_std=flow_in.iat_std,
                iat_min=flow_in.iat_min,
                iat_max=flow_in.iat_max,
                payload_entropy=flow_in.payload_entropy,
                features=flow_in.features or {},
            )
            db.add(db_flow)
            created_flows.append(db_flow)

        await db.flush()

        # Record batch ingestion event in audit log
        await AuditService.append_async(
            db=db,
            action="FLOWS_BATCH_INGESTED",
            record_payload={
                "batch_size": len(created_flows),
                "flow_ids": [str(f.id) for f in created_flows[:50]],
            },
            actor=actor,
        )

        return created_flows

    @staticmethod
    async def get_by_id(db: AsyncSession, flow_id: uuid.UUID) -> Optional[Flow]:
        stmt = select(Flow).where(Flow.id == flow_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def list_flows(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
        src_ip: Optional[str] = None,
        dst_ip: Optional[str] = None,
        src_port: Optional[int] = None,
        dst_port: Optional[int] = None,
        protocol: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        min_packets: Optional[int] = None,
        min_bytes: Optional[int] = None,
        min_entropy: Optional[float] = None,
        max_entropy: Optional[float] = None,
    ) -> Tuple[List[Flow], int]:
        """
        Retrieves historical unidirectional flows with flexible 5-tuple, temporal, and statistical filtering.
        """
        filters = []
        if src_ip:
            filters.append(Flow.src_ip == src_ip)
        if dst_ip:
            filters.append(Flow.dst_ip == dst_ip)
        if src_port is not None:
            filters.append(Flow.src_port == src_port)
        if dst_port is not None:
            filters.append(Flow.dst_port == dst_port)
        if protocol:
            filters.append(Flow.protocol == protocol.upper())
        if start_time:
            filters.append(Flow.start_time >= start_time)
        if end_time:
            filters.append(Flow.end_time <= end_time)
        if min_packets is not None:
            filters.append(Flow.packet_count >= min_packets)
        if min_bytes is not None:
            filters.append(Flow.byte_count >= min_bytes)
        if min_entropy is not None:
            filters.append(Flow.payload_entropy >= min_entropy)
        if max_entropy is not None:
            filters.append(Flow.payload_entropy <= max_entropy)

        # Count total
        count_stmt = select(func.count(Flow.id))
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Query page ordered chronologically
        stmt = select(Flow).order_by(Flow.start_time.desc()).offset(skip).limit(limit)
        if filters:
            stmt = stmt.where(and_(*filters))

        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_flow_stats_summary(db: AsyncSession) -> Dict[str, Any]:
        """
        Aggregates statistical metrics across all captured unidirectional flows:
        - Total flows count
        - Total packets and total bytes transmitted
        - Protocol breakdown (TCP, UDP, ICMP)
        - Average payload entropy
        - Earliest and latest observed timestamps
        - Top talkers (Source IPs and Destination IPs)
        """
        total_stmt = select(
            func.count(Flow.id),
            func.coalesce(func.sum(Flow.packet_count), 0),
            func.coalesce(func.sum(Flow.byte_count), 0),
            func.coalesce(func.avg(Flow.payload_entropy), 0.0),
            func.min(Flow.start_time),
            func.max(Flow.end_time),
        )
        total_res = await db.execute(total_stmt)
        flow_count, total_pkts, total_bytes, avg_ent, min_time, max_time = total_res.first() or (0, 0, 0, 0.0, None, None)

        # Protocol distribution
        proto_stmt = select(Flow.protocol, func.count(Flow.id)).group_by(Flow.protocol)
        proto_res = await db.execute(proto_stmt)
        by_protocol = {row[0]: row[1] for row in proto_res.all()}

        # Top source IPs
        src_stmt = (
            select(Flow.src_ip, func.count(Flow.id), func.sum(Flow.byte_count))
            .group_by(Flow.src_ip)
            .order_by(desc(func.count(Flow.id)))
            .limit(5)
        )
        src_res = await db.execute(src_stmt)
        top_src_ips = [
            {"src_ip": row[0], "flows": row[1], "bytes": row[2] or 0}
            for row in src_res.all()
        ]

        # Top destination IPs
        dst_stmt = (
            select(Flow.dst_ip, func.count(Flow.id), func.sum(Flow.byte_count))
            .group_by(Flow.dst_ip)
            .order_by(desc(func.count(Flow.id)))
            .limit(5)
        )
        dst_res = await db.execute(dst_stmt)
        top_dst_ips = [
            {"dst_ip": row[0], "flows": row[1], "bytes": row[2] or 0}
            for row in dst_res.all()
        ]

        return {
            "total_flows": flow_count,
            "total_packets": int(total_pkts),
            "total_bytes": int(total_bytes),
            "avg_payload_entropy": round(float(avg_ent), 4),
            "by_protocol": by_protocol,
            "earliest_flow": min_time.isoformat() if min_time else None,
            "latest_flow": max_time.isoformat() if max_time else None,
            "top_source_ips": top_src_ips,
            "top_dest_ips": top_dst_ips,
        }
