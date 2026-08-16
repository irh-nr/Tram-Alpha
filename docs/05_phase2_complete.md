# Tram — Phase 2 Completion Summary

## Phase 2: Signal Engine ✅ COMPLETE

**Completed:** May 26, 2026

---

## Supabase Infrastructure (Pre-Phase 2)

### Project Created
- **Project ID:** `upvvjuxgmoceiaijhkzp`
- **Region:** `ap-southeast-1` (Singapore)
- **URL:** `https://upvvjuxgmoceiaijhkzp.supabase.co`
- **Organization:** Amna Corp (`bzavgmuiqqasyqqxiyyr`)

### Database Schema Applied
- 9 tables: `users`, `strategies`, `user_strategies`, `signals`, `trades`, `journal_entries`, `watchlists`, `alerts`, `performance_snapshots`
- RLS policies on all tables
- Realtime publication for `signals` and `trades`
- Auto-create user profile trigger on signup
- 3 seed strategies: EMA Crossover, RSI Divergence, Volume Breakout
- Security hardening: revoked public execute on trigger function

### Auth Flow Verified
- Signup → email confirmation → login → dashboard redirect ✅
- User profile auto-created via trigger ✅
- Frontend `.env.local` updated with real credentials ✅
- Backend `.env` created with real credentials ✅

---

## Backend — Signal Engine Components

### 1. Binance WebSocket Client (`scanner/binance_ws.py`)
- Combined stream connection for multiple symbols/timeframes
- Auto-reconnect with exponential backoff (1s → 60s max)
- Async callback dispatch for each candle
- Clean shutdown via cancellation
- Dataclass-based `Candle` with factory method for Binance payload parsing

### 2. Candle Buffer (`scanner/candle_buffer.py`)
- Fixed-size deque buffers (200 candles per symbol/timeframe)
- Numpy-based indicator calculations:
  - **EMA** (Exponential Moving Average)
  - **RSI** (Relative Strength Index) — Wilder's smoothing
  - **ATR** (Average True Range)
  - **Volume SMA** and volume ratio
- `CandleBufferManager` for multi-symbol/timeframe routing
- `IndicatorResult` dataclass with current + previous values for crossover detection

### 3. Strategy Base Class (`strategies/base.py`)
- Abstract `BaseStrategy` with: name, description, default_parameters, evaluate()
- `SignalProposal` — lightweight output with auto-computed R:R
- Strategy-specific indicator parameter overrides
- Fully stateless — all state in buffer/indicators

### 4. Strategy Registry (`strategies/registry.py`)
- `@register_strategy` decorator for auto-discovery
- Maps strategy classes to database UUIDs
- `auto_discover()` imports all strategy modules
- `initialize_from_classes()` bulk-registers with DB IDs

### 5. EMA Crossover Strategy (`strategies/ema_crossover.py`)
- Fast/slow EMA crossover detection with previous-bar comparison
- Multi-factor signal confirmation:
  - EMA spread minimum threshold
  - RSI overbought/oversold filter
  - Volume ratio minimum threshold
- ATR-based dynamic stop-loss and take-profit
- Configurable risk/reward target
- Confidence scoring (0-100) based on:
  - Base crossover (20pts)
  - EMA spread strength (0-30pts)
  - RSI confirmation (0-25pts)
  - Volume strength (0-25pts)

### 6. Scanner Engine (`scanner/engine.py`)
- Main loop: WS → buffer → strategy evaluation → DB persist
- Per-symbol/strategy signal cooldown (4-hour dedup)
- Runtime statistics tracking
- Status endpoint data for frontend monitoring
- Handles 10 symbols × 2 timeframes by default

### 7. Scanner Worker (`workers/scanner_worker.py`)
- Standalone entry point: `python -m app.workers.scanner_worker`
- CLI args: `--symbols`, `--timeframes`
- Graceful shutdown via SIGINT/SIGTERM
- Works on both Unix and Windows

### 8. API Routes
- `GET /api/strategies` — List strategies with user subscription status
- `POST /api/strategies/{id}/subscribe` — Subscribe to strategy
- `DELETE /api/strategies/{id}/subscribe` — Unsubscribe
- `GET /api/scanner/status` — Scanner health and stats

---

## Frontend — Signals Page

### New Components
- **`SignalCard`** — Rich card with direction badge, confidence ring chart, price levels grid, R:R display, strategy name, time-ago
- **`SignalFilters`** — Status dropdown, symbol quick-filter badges, search input
- **`ScannerStatusBar`** — Live connection status, strategy count, throughput stats, error count, uptime

### New Hooks
- **`useSignals()`** — Fetch signals from Supabase with RLS, filter by status/symbol
- **`useRealtimeSignals()`** — Supabase Realtime subscription for live INSERT/UPDATE
- **`useScannerStatus()`** — Poll backend scanner health endpoint

### Signals Page (`/dashboard/signals`)
- Full-featured signal display with Card and Table view toggle
- Quick stats bar: Total, Active, Long/Short split, Avg Confidence
- Symbol quick-filter badges (BTC, ETH, SOL, etc.)
- Status dropdown filter (Active, Triggered, Expired, Cancelled)
- Symbol search input
- Loading skeleton states
- Empty state with scanner start command
- Real-time updates via Supabase Realtime

---

## Files Created/Modified

### New Backend Files
```
backend/app/scanner/binance_ws.py      — Binance WebSocket client
backend/app/scanner/candle_buffer.py   — Candle buffer + indicators
backend/app/scanner/engine.py          — Scanner engine main loop
backend/app/strategies/base.py         — Strategy abstract base class
backend/app/strategies/registry.py     — Strategy discovery & registry
backend/app/strategies/ema_crossover.py — EMA Crossover implementation
backend/app/workers/scanner_worker.py  — Scanner worker entrypoint
backend/app/api/routes/strategies.py   — Strategy API routes
backend/app/api/routes/scanner.py      — Scanner status route
backend/.env                           — Real Supabase credentials
```

### New Frontend Files
```
frontend/hooks/use-signals.ts           — Signal data hooks
frontend/hooks/use-scanner.ts           — Scanner status hook
frontend/components/signals/signal-card.tsx    — Signal card component
frontend/components/signals/signal-filters.tsx — Filter bar component
frontend/components/signals/scanner-status.tsx — Scanner status bar
```

### Modified Files
```
frontend/.env.local    — Real Supabase credentials
backend/app/main.py    — Added strategies + scanner routes
frontend/app/dashboard/signals/page.tsx — Full signals page rewrite
```

---

## Dev Server Commands

```bash
# Frontend
cd frontend && npm run dev  # localhost:3000

# Backend API
cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# Scanner Worker (separate process)
cd backend && .venv\Scripts\activate && python -m app.workers.scanner_worker
# With custom symbols:
python -m app.workers.scanner_worker --symbols BTCUSDT,ETHUSDT --timeframes 1h
```

---

## What's Next — Phase 3: Trading Journal

| Task | Priority |
|------|----------|
| Trade CRUD API endpoints | P0 |
| Trade entry form (manual + import from signal) | P0 |
| Journal entry CRUD + trade linking | P0 |
| Journal page with filters and tags | P0 |
| Trade detail view with journal | P1 |
| Mistake tags + emotional state selector | P1 |
