# Changelog

All notable changes to the Tram project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.5.0] — 2026-06-14 — Phase 5: Alerts & Polish

### Added

#### P0 — Telegram Notification System

- **Notification Service** (`backend/app/services/notification_service.py`):
  - Telegram Bot API integration via `httpx`
  - HTML-formatted signal messages with emoji, entry/SL/TP/confidence
  - Test connection endpoint for verifying chat ID
  - Batch dispatch to all subscribed users via `alerts` table lookup
  - Smart price formatting (2dp for BTC, 8dp for small-cap tokens)

- **Alerts CRUD API** (`backend/app/api/routes/alerts.py`):
  - `GET /api/alerts` — list user's alert subscriptions
  - `POST /api/alerts` — create alert with duplicate detection
  - `PATCH /api/alerts/:id` — update config or active state
  - `DELETE /api/alerts/:id` — remove alert subscription
  - `POST /api/alerts/test-telegram` — send test message

- **Signal → Notification Hook** (`backend/app/scanner/engine.py`):
  - After signal persistence, dispatches via `asyncio.create_task` (non-blocking)
  - Queries all active `new_signal` + `telegram` alerts, sends formatted message

- **Frontend Alerts** (`frontend/hooks/use-alerts.ts`, `frontend/types/alert.ts`):
  - TanStack Query hooks for CRUD operations + test connection mutation
  - Alert type definitions with channel/event_type unions

- **Settings Page Full Rewrite** (`frontend/app/dashboard/settings/page.tsx`):
  - Telegram Chat ID input with save functionality
  - Test Connection button with success/error feedback
  - Event type toggles (New Signal, Trade Closed, Journal Reminder)
  - Setup instructions with BotFather and @userinfobot links
  - Loading/disabled states for all interactive elements

#### P1 — RSI Divergence Strategy

- **`backend/app/strategies/rsi_divergence.py`** (UUID: `588205b6-a602-4fe9-8d27-37eadc0f9c0f`):
  - Bullish divergence: price lower low + RSI higher low
  - Bearish divergence: price higher high + RSI lower high
  - Swing pivot detection via local minima/maxima search
  - Parameters: RSI period, lookback, oversold/overbought thresholds
  - Confidence scoring: RSI zone + divergence strength + volume
  - Default timeframe: 4h

#### P1 — Volume Breakout Strategy

- **`backend/app/strategies/volume_breakout.py`** (UUID: `0e6765bb-fe2c-4b85-a993-f61f11f10dca`):
  - Consolidation detection via range width analysis
  - Breakout: close above/below consolidation range
  - Volume spike confirmation (default 2× average)
  - Candle body strength filter (min 50% body-to-range)
  - ATR-based risk management with range boundary stop floor
  - Confidence scoring: tightness + volume expansion + breakout magnitude
  - Default timeframe: 1h

#### P2 — Calendar Heatmap

- **`frontend/components/dashboard/calendar-heatmap.tsx`**:
  - GitHub-style year heatmap with daily trading activity
  - Green = profitable, Red = losing, Blue = journal-only, Amber = break-even
  - Year navigation with forward/back arrows
  - PnL tooltips with trade count and journal entries
  - Horizontal scroll on mobile, responsive legend
  - Integrated into Analytics page between equity curve and metrics

#### P1 — UX Polish

- **Mobile responsive sidebar**: Auto-collapses below 768px, overlay backdrop on mobile
- **Responsive header**: Search hidden on mobile, tighter gaps, Live indicator hidden on xs
- **Dashboard layout**: Dynamic margin for sidebar state, fade-in page transitions
- **Content padding**: Smaller padding on mobile (`p-4`) scaling to desktop (`p-6`)

### Changed

- **Strategy Registry** (`backend/app/strategies/registry.py`):
  - `auto_discover()` now dynamically imports all `.py` modules in the strategies package
  - Previously hardcoded to only import `ema_crossover` — new strategies were silently ignored

- **DB Migration**: `alerts.event_type` CHECK expanded to include `journal_reminder`

### Fixed

- **Strategy auto-discovery**: New strategy files (RSI Divergence, Volume Breakout) are now automatically found and registered without manual import statements

## [Unreleased]

### Added


- **Watchlist Management (Full-Stack)** — Frontend + backend integration for managing monitored trading pairs.
  - **Backend API endpoints**:
    - `GET /api/scanner/watchlist` — returns the current symbol list from the live scanner engine.
    - `POST /api/scanner/watchlist` — adds a symbol, triggers historical candle backfill (200 candles per timeframe) and WebSocket reconnection.
    - `DELETE /api/scanner/watchlist/:symbol` — removes a symbol, cleans up cooldowns, and triggers WebSocket reconnection.
  - **Engine methods**: `ScannerEngine.add_symbol()` / `remove_symbol()` / `_restart_ws()` — runtime watchlist modification with automatic backfill and live WS reconnect.
  - **Frontend**: `/dashboard/watchlist` page with search input, autocomplete suggestions, remove buttons, loading skeleton, and animated empty state.
  - `useWatchlist` hook connected to real backend endpoints — server response is the source of truth.
  - `api.delete()` upgraded to return parsed JSON response body (generic `<T>`).
  - Sidebar navigation link added between Signals and Journal.

- **Currency Toggle (USD/IDR)** — Global currency switching for all price displays.
  - **Toggle Component**: Animated pill toggle in the header (`CurrencyToggle`) switches between USD and IDR.
  - **Zustand Store**: `currency.store.ts` manages currency preference, live exchange rate (fetched from exchangerate-api, 30-min cache), and conversion logic. State persisted to `localStorage`.
  - **`useCurrency` Hook**: Provides `formatPrice()` (for crypto entry/SL/TP), `formatAmount()` (for PnL with ± sign), `convert()` (raw conversion), and `symbol` ($ or Rp).
  - **Pages Updated**: Dashboard, Signals (card + table views), Journal (trades table + cards), Close Trade dialog, Equity Curve chart, Performance Metrics grid — all now render in the selected currency.
  - IDR formatting uses proper Indonesian separators and abbreviations (K, M, B for large values).

- **Browser Notification System** — Signal alerts via the native Notification API.
  - Bell icon in header now toggles notifications on/off with visual state feedback.
  - `BellOff` icon and muted color when inactive; pulsing green dot when active.
  - `requestNotificationPermission()` prompts the browser on first activation.
  - Toggle state persisted to `localStorage` across sessions.
  - `triggerSignalNotification(signalData)` helper function ready for WebSocket integration.
  - `useNotifications` hook encapsulating permission, toggle, and loading state.

### Changed

- Header notification button upgraded from static badge to interactive toggle with permission management.

## [0.3.1] — 2026-06-03

### Fixed

#### Scanner Status 500 Error — `binance_ws.py`

**Problem**: `GET /api/scanner/status` returned HTTP 500.  
**Root Cause**: `websockets` v16 removed the legacy `.open` property on connections. The code in `BinanceWSClient.is_connected` was calling `self._ws.open`, which raised `AttributeError`, causing an unhandled exception in `ScannerEngine.get_status()`.  
**Fix**: Replaced `self._ws.open` with `self._ws.state.name == "OPEN"`, wrapped in a try/except for forward compatibility.  
**File**: `backend/app/scanner/binance_ws.py` (L214-221)

#### Strategy Registration Bug — `registry.py`

**Problem**: Scanner reported `strategies=0` at startup even though strategies existed in the database and the EMA Crossover strategy class was properly decorated.  
**Root Cause**: The `@register_strategy` decorator used `cls.__dict__.get("name")` to extract the strategy name. For `EMACrossoverStrategy`, `name` is defined as a `@property` on the class, so `cls.__dict__["name"]` returned the **property descriptor object** (which is truthy), not the string `"EMA Crossover"`. The strategy was registered under a property object key instead of the string name, so `initialize_from_classes()` could never match it against the DB names.  
**Fix**: Added `isinstance(raw_name, property)` check before using the value. If it's a property, calls `raw_name.fget(instance)` to get the actual string.  
**File**: `backend/app/strategies/registry.py` (L32-51)

#### Scanner Not Initialized — `main.py`

**Problem**: `GET /api/scanner/status` always returned `"Scanner not initialized. Run the scanner worker separately."` even when the scanner worker was running.  
**Root Cause**: The `scanner_worker.py` runs as a separate OS process. The module-level global `_scanner_engine` in `scanner.py` was never set because: (1) `set_scanner_engine()` was dead code — never called by anything, and (2) even if the worker called it, Python module globals are per-process and wouldn't be visible to the FastAPI process.  
**Fix**: Embedded the scanner engine directly in the FastAPI lifespan (`main.py`). On startup, creates `ScannerEngine`, initializes it, starts it as an `asyncio.Task`, and calls `set_scanner_engine(engine)`. On shutdown, gracefully stops the engine.  
**File**: `backend/app/main.py` (L21-57)

### Added

#### Historical Candle Backfill — `engine.py` + `binance_ws.py`

**Problem**: Scanner could not generate signals for 30+ hours after startup because candle buffers started empty and filled only from live WebSocket data (1 candle/hour on 1h timeframe, 30 needed).  
**Solution**: Added `fetch_historical_klines()` in `binance_ws.py` that fetches up to 200 historical candles per symbol/timeframe from the Binance REST API (`GET /api/v3/klines`). Called during `ScannerEngine.initialize()` via new `_backfill_buffers()` method. All 20 buffers (10 symbols × 2 timeframes) are immediately filled with 199 candles each — strategies can evaluate on the very first live candle close.  
**Files**: `backend/app/scanner/binance_ws.py`, `backend/app/scanner/engine.py`

### Removed

#### Seed Signal Data

Deleted all 8 seed/demo signals from the `signals` table in Supabase. The database now only contains real signals generated by the scanner engine. All signals displayed on the frontend are authentic.

### Known Issues

- **Verbose WebSocket logs**: `websockets` v16 emits frame-level debug logs by default. Set `WEBSOCKETS_LOG_LEVEL=WARNING` or add `logging.getLogger("websockets").setLevel(logging.WARNING)` to suppress.
- **Standalone worker mode**: The `scanner_worker.py` standalone process still works for running the scanner, but the `/api/scanner/status` endpoint won't reflect its state since they run in separate processes. IPC (Redis/DB) is needed for production separation.
