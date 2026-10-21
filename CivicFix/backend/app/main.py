"""CivicFix AI - Automated Municipal Work Verification Engine.

FastAPI main application entrypoint registering API routes, middleware,
CORS security, error handlers, and lifecycle hooks.
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import fixtures, verify
from app.services.errors import InvalidImageError

# Structured Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("civicfix.api")

settings = get_settings()

app = FastAPI(
    title="CivicFix AI",
    description=(
        "Automated proof-of-fix verification engine for municipal public works "
        "(BBMP potholes and garbage cleanup). Employs metadata/geodetic anti-spoofing, "
        "OpenCV feature registration and surface difference analysis, and Google Gemini "
        "multimodal inspection to synthesize an actionable Trust Score (0-100)."
    ),
    version="0.1.0",
    openapi_tags=[
        {
            "name": "Verification",
            "description": "Multi-layer verification pipeline for contractor before/after submissions.",
        },
        {
            "name": "Demo Fixtures",
            "description": "Pre-computed evaluation scenarios for instant demonstration and verification.",
        },
    ],
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Timing Middleware (X-Process-Time)
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{duration:.4f}s"
    return response


# Global Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(InvalidImageError)
async def invalid_image_handler(request: Request, exc: InvalidImageError):
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Health Check
@app.get(
    "/health",
    tags=["System"],
    summary="System Health Check",
    response_description="Returns system health status.",
)
async def health_check():
    return {"status": "ok"}


# Register API v1 Routers
app.include_router(verify.router, prefix="/api/v1")
app.include_router(fixtures.router, prefix="/api/v1")
