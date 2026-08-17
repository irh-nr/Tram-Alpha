# Tram — Folder Structure & Implementation Roadmap

## Folder Structure

```
tram/
├── frontend/                          # Next.js App
│   ├── app/
│   │   ├── (auth)/                    # Auth route group (no layout chrome)
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/               # Main app route group (shared layout)
│   │   │   ├── layout.tsx             # Sidebar + header layout
│   │   │   ├── page.tsx               # Dashboard home
│   │   │   ├── signals/page.tsx
│   │   │   ├── journal/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── strategies/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── layout.tsx                 # Root layout (providers, fonts)
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components
│   │   ├── layout/                    # Sidebar, Header, MobileNav
│   │   ├── charts/                    # TradingView Lightweight Charts wrappers
│   │   ├── dashboard/                 # Dashboard-specific widgets
│   │   ├── signals/                   # Signal cards, tables, filters
│   │   ├── journal/                   # Trade entry forms, journal cards
│   │   ├── analytics/                 # Metric cards, chart panels
│   │   └── common/                    # Shared: LoadingSpinner, EmptyState, etc.
│   ├── hooks/
│   │   ├── use-signals.ts             # TanStack Query hooks for signals
│   │   ├── use-trades.ts
│   │   ├── use-analytics.ts
│   │   ├── use-realtime.ts            # Supabase realtime subscription hook
│   │   └── use-auth.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser Supabase client
│   │   │   ├── server.ts              # Server component Supabase client
│   │   │   └── middleware.ts          # Auth middleware helper
│   │   ├── api.ts                     # FastAPI client (axios/fetch wrapper)
│   │   ├── utils.ts                   # Formatting, calculations
│   │   └── constants.ts               # App-wide constants
│   ├── services/
│   │   ├── signals.service.ts         # API calls for signals
│   │   ├── trades.service.ts
│   │   ├── analytics.service.ts
│   │   └── strategies.service.ts
│   ├── store/
│   │   ├── ui.store.ts                # UI state (sidebar, modals, theme)
│   │   └── filters.store.ts           # Active filters, selected timeframe
│   ├── types/
│   │   ├── signal.ts
│   │   ├── trade.ts
│   │   ├── strategy.ts
│   │   ├── analytics.ts
│   │   └── database.ts                # Supabase generated types
│   ├── middleware.ts                   # Next.js auth middleware
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.local.example
│
├── backend/                            # Python FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py                # Dependency injection (auth, db)
│   │   │   ├── routes/
│   │   │   │   ├── signals.py
│   │   │   │   ├── trades.py
│   │   │   │   ├── analytics.py
│   │   │   │   ├── strategies.py
│   │   │   │   ├── watchlists.py
│   │   │   │   └── health.py
│   │   │   └── websocket/
│   │   │       └── prices.py          # Live price WS proxy
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic Settings
│   │   │   ├── security.py            # JWT verification
│   │   │   └── logging.py             # Structured logging setup
│   │   ├── models/
│   │   │   ├── signal.py              # Pydantic schemas
│   │   │   ├── trade.py
│   │   │   ├── strategy.py
│   │   │   └── analytics.py
│   │   ├── services/
│   │   │   ├── signal_service.py
│   │   │   ├── trade_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── alert_service.py       # Telegram/Discord dispatch
│   │   ├── strategies/
│   │   │   ├── base.py                # Abstract strategy class
│   │   │   ├── registry.py            # Strategy discovery & registration
│   │   │   ├── ema_crossover.py
│   │   │   ├── rsi_divergence.py
│   │   │   └── breakout.py
│   │   ├── scanner/
│   │   │   ├── engine.py              # Main scanner loop
│   │   │   ├── binance_ws.py          # Binance WebSocket client
│   │   │   └── candle_buffer.py       # In-memory candle management
│   │   ├── db/
│   │   │   ├── client.py              # Supabase Python client
│   │   │   └── repositories/          # Data access layer
│   │   │       ├── signal_repo.py
│   │   │       ├── trade_repo.py
│   │   │       └── strategy_repo.py
│   │   ├── workers/
│   │   │   └── scanner_worker.py      # Entrypoint for background scanner
│   │   └── main.py                    # FastAPI app factory
│   ├── tests/
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
│
├── docs/                               # Project documentation
├── docker-compose.yml                  # Local dev (optional)
├── .gitignore
└── README.md
```

### Why This Structure?

- **Route groups** `(auth)` and `(dashboard)` — different layouts without URL nesting
- **Feature-based components** — `components/signals/`, `components/journal/` — easy to find, easy to delete
- **Services layer** on both frontend and backend — API calls are not scattered across components
- **Strategy module** is self-contained — add a file, register it, done
- **Scanner is separate from API** — `workers/scanner_worker.py` is its own entrypoint (`python -m app.workers.scanner_worker`)

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
> Goal: Working app shell with auth, database, and project infrastructure

| Task | Priority | Est. |
|------|----------|------|
| Scaffold Next.js with TailwindCSS + shadcn/ui | P0 | 2h |
| Scaffold FastAPI backend with project structure | P0 | 2h |
| Set up Supabase project + apply schema migration | P0 | 1h |
| Implement Supabase Auth (signup, login, middleware) | P0 | 3h |
| Build app shell layout (sidebar, header, routing) | P0 | 4h |
| FastAPI auth middleware (JWT verification) | P0 | 2h |
| Environment config + .env.example files | P0 | 1h |
| Basic health check endpoints | P0 | 30m |

**Deliverable:** User can sign up, log in, and see empty dashboard with navigation.

### Phase 2: Signal Engine (Week 2-3)
> Goal: Scanner detects signals and they appear on dashboard

| Task | Priority | Est. |
|------|----------|------|
| Binance WebSocket client (kline streams) | P0 | 3h |
| Candle buffer + indicator calculations (EMA, RSI, Volume) | P0 | 4h |
| Strategy base class + registry | P0 | 2h |
| EMA Crossover strategy implementation | P0 | 3h |
| Scanner engine (main loop, strategy execution) | P0 | 3h |
| Signal API endpoints (list, detail) | P0 | 2h |
| Signals page + signal cards UI | P0 | 4h |
| Supabase Realtime subscription for signals | P0 | 2h |

**Deliverable:** Scanner detects EMA crossover signals, saves to DB, dashboard updates live.

### Phase 3: Trading Journal (Week 3-4)
> Goal: Full trade journaling with manual entry and signal import

| Task | Priority | Est. |
|------|----------|------|
| Trade CRUD API endpoints | P0 | 3h |
| Trade entry form (manual + import from signal) | P0 | 4h |
| Journal entry CRUD + trade linking | P0 | 3h |
| Journal page with filters and tags | P0 | 4h |
| Trade detail view with journal | P1 | 3h |
| Mistake tags + emotional state selector | P1 | 2h |

**Deliverable:** User can log trades, write journal entries, tag mistakes.

### Phase 4: Dashboard & Analytics (Week 4-5)
> Goal: Data-rich dashboard with performance metrics

| Task | Priority | Est. |
|------|----------|------|
| Analytics computation service | P0 | 4h |
| Performance snapshot aggregation | P0 | 3h |
| Dashboard widgets (winrate, PnL, RR, equity) | P0 | 6h |
| Equity curve chart (Lightweight Charts) | P0 | 3h |
| Win/loss distribution chart | P1 | 2h |
| Strategy comparison view | P1 | 3h |
| Period selector (daily/weekly/monthly) | P1 | 2h |

**Deliverable:** Full dashboard with live metrics and interactive charts.

### Phase 5: Alerts & Polish (Week 5-6)
> Goal: Telegram alerts, additional strategies, UX polish

| Task | Priority | Est. |
|------|----------|------|
| Telegram bot integration | P1 | 3h |
| Alert configuration UI | P1 | 2h |
| Additional strategies (RSI divergence, breakout) | P1 | 4h |
| Watchlist management | P1 | 3h |
| Strategy configuration UI | P1 | 3h |
| Loading states, error boundaries, empty states | P1 | 3h |
| Responsive design polish | P1 | 3h |
| Settings page (preferences, API keys) | P2 | 2h |

**Deliverable:** Complete MVP with alerts, multiple strategies, polished UX.

### Phase 6: Hardening (Week 6-7)
> Goal: Production readiness

| Task | Priority | Est. |
|------|----------|------|
| Error handling audit | P0 | 2h |
| Rate limiting on API | P1 | 1h |
| Structured logging | P1 | 2h |
| Deployment configs (Vercel + Railway) | P0 | 3h |
| README + setup documentation | P1 | 2h |
| Basic test coverage (critical paths) | P1 | 4h |

---

## Best Practices for This Stack

1. **Supabase client per request** — Don't share a single Supabase client instance on the server. Create per-request clients with the user's JWT for proper RLS.

2. **TanStack Query as the data layer** — Every API call goes through a custom hook (`useSignals()`, `useTrades()`). Components never call `fetch` directly.

3. **Strategy pattern literally** — Each strategy is a Python class inheriting from `BaseStrategy`. The scanner iterates registered strategies. Adding a new one is a single file.

4. **Pre-aggregate analytics** — Never compute winrate from all trades on every dashboard load. Use `performance_snapshots` table updated on trade close.

5. **Supabase Realtime for push, TanStack Query for pull** — Realtime triggers a cache invalidation in TanStack Query, not a direct state update. This keeps the data flow unidirectional.

6. **Server Components for initial load** — Dashboard layout, navigation, and initial data fetch use Server Components. Charts and live widgets are Client Components.

7. **Generated columns in Postgres** — Risk/reward ratio is a `GENERATED ALWAYS AS` column. No application code needed to keep it in sync.

8. **Feature flags via strategy config** — Strategies are enabled/disabled via DB, not code deploys. Future: use this pattern for subscription features.
