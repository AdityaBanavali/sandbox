"""
Celery background worker application instance.
Configured with Redis as message broker and result store.
"""

from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "threat_detector",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,        # 5 minutes max per task
    task_soft_time_limit=240,   # soft warning at 4 minutes
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
)

# Eagerly import tasks to ensure registration
import app.workers.tasks  # noqa: F401

