"""Tram - Test Binance Connectivity (REST API & WebSocket)

Usage:
    python test_binance.py

This script tests:
1. REST API endpoint (fetching historical klines for BTCUSDT)
2. WebSocket stream endpoint (subscribing to live kline stream for BTCUSDT)
using the settings configured in backend/.env (direct, Binance Vision, Cloudflare Worker, or Proxy).
"""

import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("backend"))

from app.core.config import get_settings
from app.scanner.binance_ws import BinanceWSClient, fetch_historical_klines


async def main():
    settings = get_settings()

    print("=" * 60)
    print(" Tram Binance Connectivity Diagnostic Tool")
    print("=" * 60)
    print(f"• REST Base URL : {settings.binance_rest_base_url or 'https://api.binance.com/api/v3'}")
    print(f"• WS Base URL   : {settings.binance_ws_base_url or 'wss://stream.binance.com:9443/stream'}")
    print(f"• Proxy URL     : {settings.binance_proxy_url or '(None - Direct connection)'}")
    print("=" * 60)

    # ─── 1. Test REST API ─────────────────────────────────────────────
    print("\n[1/2] Testing Binance REST API (Historical Klines)...")
    try:
        candles = await fetch_historical_klines("BTCUSDT", "1h", limit=3)
        if candles:
            latest = candles[-1]
            print(f"  [SUCCESS] Successfully fetched {len(candles)} historical candles!")
            print(f"            Latest Close: ${latest.close:,.2f} at {latest.close_time} UTC")
        else:
            print("  [WARNING] REST API returned 0 candles (unexpected response format).")
    except Exception as e:
        print(f"  [FAILED] Could not connect to REST API: {type(e).__name__}: {e}")
        print("           If on eduroam/restricted network, try using Binance Vision or Cloudflare Worker.")

    # ─── 2. Test WebSocket Stream ────────────────────────────────────
    print("\n[2/2] Testing Binance WebSocket Stream (Live Klines)...")
    received_event = asyncio.Event()
    received_data = {}

    async def on_candle_received(candle):
        received_data["candle"] = candle
        received_event.set()

    client = BinanceWSClient(
        symbols=["BTCUSDT"],
        timeframes=["1h"],
        on_candle=on_candle_received,
    )

    ws_task = asyncio.create_task(client.start())

    try:
        # Wait up to 10 seconds for at least one live candle event
        await asyncio.wait_for(received_event.wait(), timeout=10.0)
        c = received_data.get("candle")
        if c:
            print(f"  [SUCCESS] Received live candle frame from WebSocket!")
            print(f"            Symbol: {c.symbol} | Close: ${c.close:,.2f} | Closed: {c.is_closed}")
    except asyncio.TimeoutError:
        print("  [TIMEOUT] WebSocket connected or pending, but received no candle within 10s.")
        print("            Check if WebSocket stream URL or port 9443 is blocked.")
    except Exception as e:
        print(f"  [FAILED] WebSocket connection failed: {type(e).__name__}: {e}")
    finally:
        await client.stop()
        ws_task.cancel()
        try:
            await ws_task
        except asyncio.CancelledError:
            pass

    print("\n" + "=" * 60)
    print(" Diagnostic Complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

