"""
FastAPI Main Application Entrypoint for Cyber Defense Enclave:
AI-Based Detection of Cyber Threats in Unidirectional IP Traffic.
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.redis import get_redis_client, close_redis_client
from app.core.websocket import ws_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cyber_defense.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle context manager.
    Executes initialization and teardown tasks for databases and connection pools.
    """
    logger.info("Initializing %s (%s mode)...", settings.APP_NAME, settings.APP_ENV)

    # Verify Redis connectivity on startup
    try:
        redis = await get_redis_client()
        await redis.ping()
        logger.info("Successfully established connection to Redis pool.")
    except Exception as exc:
        logger.warning("Redis not reachable during startup initialization: %s", exc)

    # Start WebSocket real-time Redis Pub/Sub listener
    try:
        await ws_manager.start_redis_listener()
    except Exception as exc:
        logger.warning("Could not start WebSocket Redis listener on startup: %s", exc)

    yield

    # Clean up WebSocket listener and Redis client on shutdown
    logger.info("Shutting down %s, terminating connection pools...", settings.APP_NAME)
    try:
        await ws_manager.stop_redis_listener()
    except Exception:
        pass
    await close_redis_client()
    logger.info("Application teardown completed.")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Production-grade cybersecurity backend for **Cyber Defense Enclave: AI-Based Detection "
        "of Cyber Threats in Unidirectional IP Traffic** (Data Diodes & Unidirectional Taps).\n\n"
        "### Key Capabilities\n"
        "- **Unidirectional Flow Ingestion**: Captures forward 5-tuple metrics, timing distributions, Shannon entropy, and ML features.\n"
        "- **Threat Detection & Alerts**: Automated heuristic and ML threat classification with MITRE ATT&CK mapping.\n"
        "- **Cryptographic Tamper-Evident Audit Ledger**: SHA-256 hash-chained immutable logging.\n"
        "- **Asynchronous Processing**: Celery workers backed by Redis and live Pub/Sub event broadcasting."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing (CORS) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 Router
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

# Mount Dashboard Router at root level (/analysis and /tasks)
from app.api.v1.endpoints import dashboard
app.include_router(dashboard.router)


@app.get("/", include_in_schema=False)
async def root():
    """
    Root entrypoint providing system status, dashboard, and documentation links.
    """
    return {
        "title": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "analysis_dashboard": "/analysis",
        "tasks_dashboard": "/tasks",
        "docs": "/docs",
        "redoc": "/redoc",
        "api_v1": settings.API_V1_STR,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global unhandled exception handler ensuring structured error responses.
    """
    logger.exception("Unhandled error processing request %s %s: %s", request.method, request.url, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "An internal server error occurred.",
            "detail": str(exc) if settings.DEBUG else None,
        },
    )
