# Tram — Phase 1 Scaffolding Complete ✅

## What's Built

### Frontend (Next.js + TypeScript + Tailwind + shadcn/ui)
- ✅ App shell with dark-first trading theme
- ✅ Collapsible sidebar with navigation
- ✅ Header with search, live indicator, notifications
- ✅ Dashboard with stats grid, active signals, recent trades
- ✅ Login & signup pages with Supabase Auth integration
- ✅ 6 placeholder pages (signals, journal, analytics, strategies, settings)
- ✅ Supabase client (browser + server + middleware)
- ✅ Auth middleware with route protection
- ✅ API client with auto JWT attachment
- ✅ TanStack Query provider with trading-optimized defaults
- ✅ Zustand store for UI state
- ✅ TypeScript types (Signal, Trade)
- ✅ Utility functions (formatPrice, formatCurrency, getPnlColor, etc.)

### Backend (Python FastAPI)
- ✅ FastAPI app factory with CORS, rate limiting, structured logging
- ✅ JWT verification for Supabase tokens
- ✅ PostgREST client for database operations
- ✅ Pydantic models (Signal, Trade) with validation
- ✅ Signal service (list, get with filtering + pagination)
- ✅ Trade service (CRUD with auto-close on exit price)
- ✅ Signal & Trade REST endpoints
- ✅ Health check endpoints
- ✅ Full project structure ready for scanner, strategies, workers

## Screenshots

### Dashboard
![Dashboard Page](C:/Users/irhmana/.gemini/antigravity/brain/eb15297d-be6d-4792-aaec-786077ba6fd8/dashboard_page_1779707740351.png)

### Login
![Login Page](C:/Users/irhmana/.gemini/antigravity/brain/eb15297d-be6d-4792-aaec-786077ba6fd8/login_page_1779707754403.png)

## Running Locally

```bash
# Frontend (already running at http://localhost:3000)
cd frontend && npm run dev

# Backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

## What's Needed Before Phase 2

1. **Supabase Project** — Configure your `SUPABASE_ACCESS_TOKEN` in the MCP server settings so I can create the project and apply the database schema migration
2. **Replace `.env.local`** placeholder values with real Supabase credentials once the project is created

## Phase 2 Preview (Signal Engine)

Next, we'll build:
- Binance WebSocket client (kline streams)
- Candle buffer + indicator calculations (EMA, RSI, Volume)
- Strategy base class + EMA Crossover strategy
- Scanner engine (main loop)
- Signals page with live data via Supabase Realtime
