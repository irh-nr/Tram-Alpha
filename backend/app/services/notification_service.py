"""Tram Backend - Notification Service.

Handles dispatching notifications to users via Telegram.
Triggered by signal creation, trade closures, etc.

The service queries the `alerts` table to find users with active
alert subscriptions for the given event type and channel, then
delivers the message via the appropriate transport (Telegram Bot API).
"""

import httpx
from datetime import datetime, UTC

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.client import get_supabase_client

logger = get_logger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}"


class NotificationService:
    """Dispatches notifications via Telegram Bot API."""

    def __init__(self):
        self._settings = get_settings()

    @property
    def _bot_token(self) -> str:
        return self._settings.telegram_bot_token

    @property
    def _is_configured(self) -> bool:
        return bool(self._bot_token)

    # ── Telegram Transport ───────────────────────────────────────

    async def send_telegram_message(self, chat_id: str, text: str) -> bool:
        """Send a message via Telegram Bot API.

        Returns True if the message was sent successfully.
        """
        if not self._is_configured:
            logger.warning("telegram_not_configured")
            return False

        url = f"{TELEGRAM_API_BASE.format(token=self._bot_token)}/sendMessage"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                })

                if response.status_code == 200:
                    logger.info("telegram_message_sent", chat_id=chat_id)
                    return True
                else:
                    logger.error(
                        "telegram_send_failed",
                        chat_id=chat_id,
                        status=response.status_code,
                        body=response.text,
                    )
                    return False

        except Exception as e:
            logger.error("telegram_send_error", chat_id=chat_id, error=str(e))
            return False

    async def test_telegram_connection(self, chat_id: str) -> dict:
        """Send a test message to verify Telegram connectivity.

        Returns a result dict with success status and message.
        """
        test_message = (
            "✅ <b>Tram Connection Test</b>\n\n"
            "Your Telegram notifications are working!\n"
            "You'll receive alerts for new trading signals here.\n\n"
            f"🕐 {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}"
        )

        success = await self.send_telegram_message(chat_id, test_message)

        if success:
            return {"success": True, "message": "Test message sent successfully"}
        else:
            return {
                "success": False,
                "message": "Failed to send test message. Check your Chat ID and bot token.",
            }

    # ── Signal Notification ──────────────────────────────────────

    def format_signal_message(self, signal_data: dict) -> str:
        """Format a signal into a Telegram-friendly HTML message."""
        direction = signal_data.get("direction", "unknown")
        symbol = signal_data.get("symbol", "UNKNOWN")
        strategy = signal_data.get("strategy_name", "Unknown")
        timeframe = signal_data.get("timeframe", "?")

        emoji = "🟢" if direction == "long" else "🔴"
        direction_label = "LONG" if direction == "long" else "SHORT"

        entry = signal_data.get("entry_price", 0)
        sl = signal_data.get("stop_loss", 0)
        tp = signal_data.get("take_profit", 0)
        confidence = signal_data.get("confidence", 0)
        rr = signal_data.get("risk_reward", 0)

        detected_at = signal_data.get("detected_at", "")
        if detected_at:
            try:
                dt = datetime.fromisoformat(detected_at.replace("Z", "+00:00"))
                timestamp = dt.strftime("%Y-%m-%d %H:%M UTC")
            except (ValueError, AttributeError):
                timestamp = detected_at
        else:
            timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")

        # Format prices smartly — use more decimals for small prices
        def fmt_price(p: float) -> str:
            if p >= 100:
                return f"${p:,.2f}"
            elif p >= 1:
                return f"${p:,.4f}"
            else:
                return f"${p:,.8f}"

        rr_line = f"📈 Risk/Reward: 1:{rr:.1f}\n" if rr else ""

        message = (
            f"{emoji} <b>{direction_label} Signal — {symbol}</b>\n\n"
            f"📊 Strategy: {strategy}\n"
            f"⏱ Timeframe: {timeframe}\n"
            f"💰 Entry: {fmt_price(entry)}\n"
            f"🛑 Stop Loss: {fmt_price(sl)}\n"
            f"🎯 Take Profit: {fmt_price(tp)}\n"
            f"{rr_line}"
            f"🔥 Confidence: {confidence:.1f}%\n"
            f"🕐 {timestamp}"
        )

        return message

    async def notify_new_signal(self, signal_data: dict) -> int:
        """Dispatch notifications for a new signal to all subscribed users.

        Queries the alerts table for users with:
        - channel = 'telegram'
        - event_type = 'new_signal'
        - is_active = true

        Returns the number of notifications successfully sent.
        """
        if not self._is_configured:
            return 0

        message = self.format_signal_message(signal_data)

        # Find all active telegram alert subscriptions for new_signal
        try:
            client = await get_supabase_client()
            result = await (
                client.from_("alerts")
                .select("id, user_id, config")
                .eq("channel", "telegram")
                .eq("event_type", "new_signal")
                .eq("is_active", True)
                .execute()
            )
        except Exception as e:
            logger.error("notification_query_error", error=str(e))
            return 0

        sent_count = 0
        for alert in result.data:
            config = alert.get("config", {}) or {}
            chat_id = config.get("chat_id")

            if not chat_id:
                logger.debug(
                    "notification_skip_no_chat_id",
                    alert_id=alert["id"],
                    user_id=alert["user_id"],
                )
                continue

            success = await self.send_telegram_message(str(chat_id), message)
            if success:
                sent_count += 1

        logger.info(
            "signal_notifications_dispatched",
            total_alerts=len(result.data),
            sent=sent_count,
            symbol=signal_data.get("symbol"),
        )

        return sent_count


# Module-level singleton
_notification_service: NotificationService | None = None


def get_notification_service() -> NotificationService:
    """Get or create the notification service singleton."""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
