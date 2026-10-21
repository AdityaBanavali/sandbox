"""
WebSocket Gateway Manager for Real-Time Threat Alerting.
Manages active dashboard client connections, processes client-side filter preferences,
and continuously consumes and broadcasts alerts from Redis Pub/Sub.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect

from app.core.redis import get_redis_client, THREAT_ALERTS_CHANNEL

logger = logging.getLogger("cyber_defense.websocket")


class ClientSubscription:
    """
    Encapsulates a connected WebSocket client session and its filter criteria.
    """

    def __init__(
        self,
        websocket: WebSocket,
        client_id: str,
        min_severity: Optional[str] = None,
        tactics: Optional[List[str]] = None,
        behavior_classes: Optional[List[str]] = None,
    ):
        self.websocket = websocket
        self.client_id = client_id
        self.min_severity = min_severity.upper() if min_severity else None
        self.tactics = [t.lower() for t in tactics] if tactics else None
        self.behavior_classes = [b.lower() for b in behavior_classes] if behavior_classes else None

    def matches(self, alert_data: Dict[str, Any]) -> bool:
        """
        Determines if an incoming alert satisfies this client's filter criteria.
        """
        severity_order = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

        # Check severity threshold
        if self.min_severity and self.min_severity in severity_order:
            alert_sev = str(alert_data.get("severity", "")).upper()
            alert_sev_rank = severity_order.get(alert_sev, 0)
            target_sev_rank = severity_order.get(self.min_severity, 0)
            if alert_sev_rank < target_sev_rank:
                return False

        # Check MITRE tactic filter
        if self.tactics:
            alert_tactic = str(alert_data.get("tactic", "") or alert_data.get("tactic_name", "")).lower()
            mitre_data = alert_data.get("mitre_attack") or {}
            if isinstance(mitre_data, dict):
                alert_tactic = alert_tactic or str(mitre_data.get("tactic", "")).lower()

            if not any(t in alert_tactic for t in self.tactics):
                return False

        # Check behavior class filter
        if self.behavior_classes:
            alert_class = str(alert_data.get("behavior_class", "")).lower()
            if not any(b in alert_class for b in self.behavior_classes):
                return False

        return True


class WebSocketManager:
    """
    Central hub for managing client WebSocket connections and multiplexing Redis Pub/Sub events.
    """

    def __init__(self):
        self.active_clients: Dict[str, ClientSubscription] = {}
        self._redis_task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._lock = asyncio.Lock()

    @property
    def client_count(self) -> int:
        return len(self.active_clients)

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        min_severity: Optional[str] = None,
        tactics: Optional[List[str]] = None,
        behavior_classes: Optional[List[str]] = None,
    ) -> ClientSubscription:
        """
        Accepts and registers a new client WebSocket connection.
        """
        await websocket.accept()
        sub = ClientSubscription(
            websocket=websocket,
            client_id=client_id,
            min_severity=min_severity,
            tactics=tactics,
            behavior_classes=behavior_classes,
        )
        async with self._lock:
            self.active_clients[client_id] = sub
        logger.info("WebSocket client '%s' connected (active: %d)", client_id, len(self.active_clients))

        # Send initial connection handshake
        await self.send_json(
            websocket,
            {
                "event": "CONNECTED",
                "client_id": client_id,
                "active_filters": {
                    "min_severity": sub.min_severity,
                    "tactics": sub.tactics,
                    "behavior_classes": sub.behavior_classes,
                },
            },
        )
        return sub

    async def disconnect(self, client_id: str) -> None:
        """
        Removes a client connection upon close or disconnect.
        """
        async with self._lock:
            if client_id in self.active_clients:
                del self.active_clients[client_id]
        logger.info("WebSocket client '%s' disconnected (remaining: %d)", client_id, len(self.active_clients))

    async def update_filter(
        self,
        client_id: str,
        min_severity: Optional[str] = None,
        tactics: Optional[List[str]] = None,
        behavior_classes: Optional[List[str]] = None,
    ) -> bool:
        """
        Dynamically updates a client's subscription filter during an active session.
        """
        async with self._lock:
            sub = self.active_clients.get(client_id)
            if not sub:
                return False
            if min_severity is not None:
                sub.min_severity = min_severity.upper() if min_severity else None
            if tactics is not None:
                sub.tactics = [t.lower() for t in tactics] if tactics else None
            if behavior_classes is not None:
                sub.behavior_classes = [b.lower() for b in behavior_classes] if behavior_classes else None

        await self.send_json(
            sub.websocket,
            {
                "event": "FILTER_UPDATED",
                "client_id": client_id,
                "active_filters": {
                    "min_severity": sub.min_severity,
                    "tactics": sub.tactics,
                    "behavior_classes": sub.behavior_classes,
                },
            },
        )
        return True

    async def send_json(self, websocket: WebSocket, data: Dict[str, Any]) -> bool:
        """
        Safely sends a JSON payload to a single WebSocket.
        """
        try:
            await websocket.send_text(json.dumps(data, default=str))
            return True
        except Exception as exc:
            logger.debug("Error sending to websocket: %s", exc)
            return False

    async def broadcast_alert(self, alert_data: Dict[str, Any]) -> int:
        """
        Broadcasts an alert payload to all connected clients that match filter criteria.
        Returns the number of clients dispatched to.
        """
        sent_count = 0
        dead_clients: List[str] = []

        async with self._lock:
            clients_snapshot = list(self.active_clients.values())

        for sub in clients_snapshot:
            if sub.matches(alert_data):
                success = await self.send_json(sub.websocket, alert_data)
                if success:
                    sent_count += 1
                else:
                    dead_clients.append(sub.client_id)

        # Cleanup any disconnected clients discovered during broadcast
        if dead_clients:
            async with self._lock:
                for cid in dead_clients:
                    if cid in self.active_clients:
                        del self.active_clients[cid]

        return sent_count

    async def start_redis_listener(self) -> None:
        """
        Starts the background worker task that subscribes to the Redis alert channel.
        """
        if self._is_running:
            return
        self._is_running = True
        self._redis_task = asyncio.create_task(self._redis_subscriber_loop())
        logger.info("Started Redis Pub/Sub WebSocket listener loop.")

    async def stop_redis_listener(self) -> None:
        """
        Gracefully stops the Redis Pub/Sub subscriber task.
        """
        self._is_running = False
        if self._redis_task:
            self._redis_task.cancel()
            try:
                await self._redis_task
            except asyncio.CancelledError:
                pass
            self._redis_task = None
        logger.info("Stopped Redis Pub/Sub WebSocket listener loop.")

    async def _redis_subscriber_loop(self) -> None:
        """
        Internal loop listening to Redis Pub/Sub and broadcasting received alerts to WebSockets.
        """
        while self._is_running:
            try:
                client = await get_redis_client()
                pubsub = client.pubsub()
                await pubsub.subscribe(THREAT_ALERTS_CHANNEL)
                logger.info("Subscribed to Redis channel: %s", THREAT_ALERTS_CHANNEL)

                while self._is_running:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message.get("type") == "message":
                        raw_data = message.get("data")
                        if raw_data is not None:
                            try:
                                payload = json.loads(raw_data)
                                await self.broadcast_alert(payload)
                            except Exception as exc:
                                logger.error("Error decoding Redis alert payload: %s", exc)
                    await asyncio.sleep(0.01)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Redis Pub/Sub listener encountered error: %s. Reconnecting in 3s...", exc)
                await asyncio.sleep(3.0)


# Global singleton WebSocketManager instance
ws_manager = WebSocketManager()
