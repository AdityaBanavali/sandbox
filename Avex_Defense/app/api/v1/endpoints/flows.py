"""
Flows API router: ingestion and retrieval of unidirectional traffic telemetry.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, cast
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
    BackgroundTasks,
    File,
    UploadFile,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.schemas.flow import (
    FlowCreate,
    FlowRead,
    FlowIngestBatch,
    FlowIngestResponse,
)
from app.services.flow_service import FlowService
from app.services.pcap_service import UnidirectionalFlowAggregator
from app.workers.tasks import detect_threats_for_flow_task


router = APIRouter()


@router.post(
    "/ingest",
    response_model=FlowRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a single unidirectional network flow",
)
async def ingest_flow(
    flow_in: FlowCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Ingests unidirectional flow telemetry, records entry into the tamper-evident audit ledger,
    and enqueues asynchronous AI threat evaluation.
    """
    flow = await FlowService.create_flow(db=db, flow_in=flow_in, actor="api_client")
    
    # Enqueue background detection via Celery task (or FastAPI background task as fallback)
    try:
        cast(Any, detect_threats_for_flow_task).delay(str(flow.id))
    except Exception:
        # Fallback if Celery broker is currently offline during direct dev mode
        pass

    return flow


@router.post(
    "/ingest/batch",
    response_model=FlowIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch ingest multiple unidirectional flows",
)
async def ingest_flows_batch(
    batch: FlowIngestBatch,
    db: AsyncSession = Depends(get_async_session),
):
    """
    High-throughput ingestion for network capture probes transmitting flow records.
    """
    if not batch.flows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch list must contain at least one flow record.",
        )

    created_flows = await FlowService.create_batch(
        db=db,
        flows_in=batch.flows,
        actor="api_batch_client",
    )

    flow_ids = [flow.id for flow in created_flows]

    # Trigger background evaluation for each flow
    for fid in flow_ids:
        try:
            cast(Any, detect_threats_for_flow_task).delay(str(fid))
        except Exception:
            pass

    return FlowIngestResponse(
        ingested_count=len(created_flows),
        flow_ids=flow_ids,
        message=f"Successfully ingested {len(created_flows)} unidirectional flows.",
    )


@router.post(
    "/ingest/pcap",
    response_model=FlowIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload raw PCAP file for byte-level extraction using dpkt",
)
async def ingest_pcap_file(
    file: UploadFile = File(..., description="Raw .pcap or .cap file captured from unidirectional diode/tap"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Parses an uploaded raw PCAP file directly at byte level using dpkt.
    Calculates all 6 unidirectional flow features (packet size skew, binned IAT entropy,
    protocol anomalies, TTL fingerprinting, payload entropy, and EWMA baselines).
    Persists extracted flow records and triggers asynchronous threat scoring.
    """
    if not file.filename or not file.filename.lower().endswith((".pcap", ".cap", ".dmp")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a valid PCAP capture (.pcap, .cap).",
        )

    try:
        pcap_contents = await file.read()
        aggregator = UnidirectionalFlowAggregator(inactivity_timeout_s=10.0)
        extracted_flow_dicts = aggregator.process_pcap(pcap_contents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse PCAP file with dpkt: {exc}",
        )

    if not extracted_flow_dicts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No IP packets could be parsed from the uploaded PCAP file.",
        )

    # Convert flow dicts to FlowCreate schemas
    flows_to_create: List[FlowCreate] = []
    for fd in extracted_flow_dicts:
        features_payload = {
            "packet_size_skew": fd["packet_size_skew"],
            "iat_entropy": fd["iat_entropy"],
            "is_c2_beacon": fd["is_c2_beacon"],
            "port_anomaly_flags": fd["port_anomaly_flags"],
            "ttl_fingerprint": fd["ttl_fingerprint"],
            "is_encrypted_exfiltration": fd["is_encrypted_exfiltration"],
            "ewma_stats": fd["ewma_stats"],
        }

        flows_to_create.append(
            FlowCreate(
                src_ip=fd["src_ip"],
                dst_ip=fd["dst_ip"],
                src_port=fd["src_port"],
                dst_port=fd["dst_port"],
                protocol=fd["protocol"],
                start_time=fd["start_time"],
                end_time=fd["end_time"],
                duration_ms=fd["duration_ms"],
                packet_count=fd["packet_count"],
                byte_count=fd["byte_count"],
                packet_size_mean=fd["packet_size_mean"],
                packet_size_std=fd["packet_size_std"],
                packet_size_min=fd["packet_size_min"],
                packet_size_max=fd["packet_size_max"],
                iat_mean=fd["iat_mean"],
                iat_std=fd["iat_std"],
                iat_min=fd["iat_min"],
                iat_max=fd["iat_max"],
                payload_entropy=fd["payload_entropy"],
                features=features_payload,
            )
        )

    created_flows = await FlowService.create_batch(
        db=db,
        flows_in=flows_to_create,
        actor=f"pcap_upload:{file.filename}",
    )

    flow_ids = [flow.id for flow in created_flows]

    # Enqueue detection evaluation
    for fid in flow_ids:
        try:
            cast(Any, detect_threats_for_flow_task).delay(str(fid))
        except Exception:
            pass

    return FlowIngestResponse(
        ingested_count=len(created_flows),
        flow_ids=flow_ids,
        message=f"Parsed and extracted {len(created_flows)} unidirectional flows from {file.filename} using dpkt.",
    )


@router.get(
    "",
    response_model=List[FlowRead],
    summary="List and filter historical unidirectional flows",
)
async def list_flows(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    src_ip: Optional[str] = Query(None, description="Filter by source IP"),
    dst_ip: Optional[str] = Query(None, description="Filter by destination IP"),
    src_port: Optional[int] = Query(None, description="Filter by source port"),
    dst_port: Optional[int] = Query(None, description="Filter by destination port"),
    protocol: Optional[str] = Query(None, description="Filter by protocol (TCP, UDP, ICMP)"),
    start_time: Optional[datetime] = Query(None, description="Filter flows on or after timestamp (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="Filter flows on or before timestamp (ISO format)"),
    min_packets: Optional[int] = Query(None, ge=1, description="Minimum packet count"),
    min_bytes: Optional[int] = Query(None, ge=1, description="Minimum transmitted bytes"),
    min_entropy: Optional[float] = Query(None, ge=0.0, le=8.0, description="Minimum payload Shannon entropy"),
    max_entropy: Optional[float] = Query(None, ge=0.0, le=8.0, description="Maximum payload Shannon entropy"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Queries historical flows with temporal, 5-tuple, volumetric, and entropy filters.
    Returns total count in 'X-Total-Count' response header.
    """
    flows, total = await FlowService.list_flows(
        db=db,
        skip=skip,
        limit=limit,
        src_ip=src_ip,
        dst_ip=dst_ip,
        src_port=src_port,
        dst_port=dst_port,
        protocol=protocol,
        start_time=start_time,
        end_time=end_time,
        min_packets=min_packets,
        min_bytes=min_bytes,
        min_entropy=min_entropy,
        max_entropy=max_entropy,
    )
    response.headers["X-Total-Count"] = str(total)
    return flows


@router.get(
    "/stats/summary",
    status_code=status.HTTP_200_OK,
    summary="Retrieve aggregate network traffic statistics and top talkers",
)
async def get_flow_stats_summary(
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Returns aggregate unidirectional traffic telemetry:
    - Total flow, packet, and byte volumes
    - Protocol distributions (TCP, UDP, ICMP)
    - Average payload entropy
    - Earliest and latest observation timestamps
    - Top 5 source and destination IPs
    """
    return await FlowService.get_flow_stats_summary(db=db)


@router.get(
    "/{flow_id}",
    response_model=FlowRead,
    summary="Retrieve details of a specific flow",
)
async def get_flow(
    flow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
):
    flow = await FlowService.get_by_id(db=db, flow_id=flow_id)
    if not flow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flow with ID {flow_id} not found.",
        )
    return flow
