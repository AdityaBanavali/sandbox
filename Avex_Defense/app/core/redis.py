"""
Redis connection management and Pub/Sub publisher for real-time threat alerts.
"""

import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global async Redis client pool
_redis_client: Optional[aioredis.Redis] = None

# Standard Pub/Sub channels
THREAT_ALERTS_CHANNEL = "cyber:threat:alerts"
AUDIT_EVENTS_CHANNEL = "cyber:audit:events"


async def get_redis_client() -> aioredis.Redis:
    """
    Returns or initializes the async Redis client instance.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            health_check_interval=30,
        )
    return _redis_client


async def close_redis_client() -> None:
    """
    Closes the Redis client pool on application shutdown.
    """
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


async def publish_event(channel: str, message: Any) -> int:
    """
    Serializes and publishes a JSON payload to a Redis Pub/Sub channel.
    Returns the number of subscribers that received the message.
    """
    try:
        client = await get_redis_client()
        serialized = json.dumps(message, default=str)
        return await client.publish(channel, serialized)
    except Exception as exc:
        logger.error("Failed to publish event to Redis channel %s: %s", channel, exc)
        return 0
