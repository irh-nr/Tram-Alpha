import asyncio
from app.services.notification_service import get_notification_service

async def test():
    import os
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "your-chat-id")
    s = get_notification_service()
    r = await s.test_telegram_connection(chat_id)
    print(r)

asyncio.run(test())
