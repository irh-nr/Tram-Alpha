# Session Handoff: Proceeding to Phase 5 (Alerts & Polish)

To continue development smoothly, paste the prompt below into the AI session tomorrow.

---

### Copy-Paste Prompt for the Next Session

```markdown
We are building the Tram crypto trading signal and journaling platform.
We have completed Phases 1–4: Foundation, Signal Engine, Trading Journal, and Dashboard & Analytics.

Please check:
- `docs/07_phase4_complete.md` for the Phase 4 completion summary.
- `knowledge/tram-project-state/artifacts/project_state.md` for platform configuration, active Supabase project ID (`upvvjuxgmoceiaijhkzp`), test user credentials, and active environment.

Our goal for today is to proceed to **Phase 5: Alerts & Polish**.

### Current State Recap
- **Backend**: FastAPI with signal/trade/journal services, EMA Crossover strategy (only implemented one — RSI Divergence + Volume Breakout are seeded in the DB but have no Python implementation yet), scanner engine with Binance WS, strategy registry with decorator-based auto-discovery.
- **Frontend**: Next.js 16 + TailwindCSS v4 + shadcn/ui, Recharts-based analytics dashboard, full trading journal with emotion tracking, real-time signal feed.
- **Database**: 9 tables with RLS — including an `alerts` table (columns: `id`, `user_id`, `channel`, `event_type`, `config` jsonb, `is_active`, `created_at`) that is currently unused.
- **Strategies in DB**: EMA Crossover (`1c2d64a2`), RSI Divergence (`588205b6`), Volume Breakout (`0e6765bb`). Only EMA Crossover has a Python implementation at `backend/app/strategies/ema_crossover.py`. The other two need to be built using the `BaseStrategy` ABC at `backend/app/strategies/base.py`.

### Phase 5 Objectives

1. **Telegram Alert Notifications (P0)**:
   - Implement a Telegram bot integration that sends alert messages when a new signal is detected by the scanner.
   - Backend: Create a notification service (`backend/app/services/notification_service.py`) that listens for new signal inserts (via Supabase Realtime or a post-save hook in the scanner engine) and dispatches formatted messages to Telegram via the Bot API.
   - Message format should include: symbol, direction (LONG/SHORT), entry price, stop loss, take profit, confidence %, strategy name, and timeframe.
   - Backend API: CRUD endpoints for alert preferences (`/api/alerts`) — users can configure their Telegram chat ID, toggle alerts on/off, and choose which event types to receive (new_signal, trade_closed, etc.).
   - Frontend: Alert settings page/section in `/dashboard/settings` where users can input their Telegram chat ID, test the connection, and toggle notification preferences.

2. **RSI Divergence Strategy (P1)**:
   - Implement `backend/app/strategies/rsi_divergence.py` inheriting from `BaseStrategy`.
   - Strategy logic: Detect bullish divergence (price making lower lows while RSI makes higher lows) and bearish divergence (price making higher highs while RSI makes lower highs).
   - Use the existing `CandleBuffer` and `IndicatorResult` infrastructure (RSI is already computed in the candle buffer).
   - Parameters: RSI period, lookback window for divergence detection, minimum RSI threshold for oversold/overbought zones.
   - Register via the `@register_strategy` decorator with DB UUID `588205b6-a602-4fe9-8d27-37eadc0f9c0f`.

3. **Volume Breakout Strategy (P1)**:
   - Implement `backend/app/strategies/volume_breakout.py` inheriting from `BaseStrategy`.
   - Strategy logic: Detect price breakouts from consolidation ranges accompanied by significant volume spikes (volume > N× average volume).
   - Use recent candles from `CandleBuffer` to identify consolidation (tight price range) followed by a breakout candle with high volume.
   - Parameters: consolidation period, volume multiplier threshold, ATR-based stop/target placement.
   - Register via `@register_strategy` decorator with DB UUID `0e6765bb-fe2c-4b85-a993-f61f11f10dca`.

4. **UX Polish & Responsiveness (P1)**:
   - Add page transition animations (fade/slide) between dashboard routes.
   - Ensure all dashboard pages are mobile-responsive (sidebar collapses, cards stack, charts resize).
   - Add a first-time user onboarding state — when no trades/signals exist, show a guided "Getting Started" message on the dashboard rather than empty grids.
   - Improve form validation UX with inline error messages and loading states on submit buttons.

5. **Calendar Heatmap (P2, if time permits)**:
   - Add a GitHub-style calendar heatmap to the analytics page showing trading activity intensity by day (number of trades or journal entries per day).
   - Color-coded by PnL: green gradient for profitable days, red for losing days, gray for inactive.

Let's begin by reviewing the existing strategies infrastructure (`backend/app/strategies/base.py`, `registry.py`, `ema_crossover.py`), the alerts table schema, and the settings page. Then plan the implementation order: Telegram notifications first (P0), followed by the two new strategies, then UX polish.
```
