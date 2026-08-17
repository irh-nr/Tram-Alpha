import asyncio
import os
from datetime import datetime, UTC
import sys
import pprint

# Add backend dir to python path
sys.path.insert(0, os.path.abspath('backend'))

from app.services.notification_service import get_notification_service
from app.core.config import get_settings

async def main():
    settings = get_settings()
    print(f"Bot Token Configured: {bool(settings.telegram_bot_token)}")
    if not settings.telegram_bot_token:
        print("Error: No bot token configured in .env")
        return

    notifier = get_notification_service()
    
    # Mock signal data
    signal_data = {
        'symbol': 'TESTUSDT',
        'direction': 'long',
        'timeframe': '1h',
        'entry_price': 65000.50,
        'stop_loss': 64000.00,
        'take_profit': 67000.00,
        'confidence': 85.5,
        'risk_reward': 2.0,
        'strategy_name': 'EMA Crossover',
        'detected_at': datetime.now(UTC).isoformat()
    }
    
    print("Dispatching notification...")
    sent_count = await notifier.notify_new_signal(signal_data)
    print(f"Notifications sent: {sent_count}")

if __name__ == '__main__':
    asyncio.run(main())
