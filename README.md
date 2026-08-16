# Tram — Crypto Trading Signals & Journal

> Professional crypto trading signal detection, trade journaling, and performance analytics platform.

## Architecture

```
Frontend (Next.js :3000)  →  FastAPI Backend (:8000)  →  Supabase PostgreSQL
                                     ↕
                              Scanner Engine (embedded)
                                     ↕
                           Binance WebSocket (realtime candles)
                                     ↕
                           Strategy Engine → Signals → Supabase → Realtime to Frontend
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.12+
- Supabase project

### 1. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm install
npm run dev
```

### 2. Backend

The backend runs the REST API and the market scanner **in a single process** — no separate worker needed.

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux/Bash:
source .venv/Scripts/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env with your Supabase credentials
uvicorn app.main:app --reload --port 8000
```

The scanner engine starts automatically during app startup. If it fails to initialize (e.g. missing DB credentials), the API will still start — the scanner status endpoint will report the error.

<details>
<summary><strong>Advanced: Standalone Scanner Worker (production)</strong></summary>

For production deployments, you can run the scanner as a separate process for better isolation. Open a new terminal:

```bash
cd backend
.venv\Scripts\activate  # or source .venv/bin/activate
python -m app.workers.scanner_worker
# Optional: specify symbols and timeframes
python -m app.workers.scanner_worker --symbols BTCUSDT,ETHUSDT --timeframes 1h,4h
```

> **Note:** When running as a standalone worker, the `/api/scanner/status` endpoint won't reflect the worker's state (separate process memory). Use this mode only when you set up IPC (Redis, DB polling, etc.) for status sharing.

</details>

### 3. Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Project Structure

```
tram/
├── frontend/          # Next.js App Router
│   ├── app/           # Pages and layouts
│   ├── components/    # UI components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities, API client, Supabase
│   ├── store/         # Zustand state management
│   └── types/         # TypeScript type definitions
│
├── backend/           # Python FastAPI
│   └── app/
│       ├── api/       # REST routes + WebSocket
│       ├── core/      # Config, security, logging
│       ├── db/        # Supabase client + repositories
│       ├── models/    # Pydantic schemas
│       ├── services/  # Business logic
│       ├── strategies/# Signal detection strategies
│       ├── scanner/   # Market scanner engine
│       └── workers/   # Background worker entrypoints
│
└── docs/              # Documentation
```

## Tech Stack

| Layer       | Technology                                  |
| ----------- | ------------------------------------------- |
| Frontend    | Next.js, TypeScript, TailwindCSS, shadcn/ui |
| State       | TanStack Query, Zustand                     |
| Charts      | Lightweight Charts (TradingView)            |
| Backend     | FastAPI, Python                             |
| Database    | Supabase PostgreSQL                         |
| Auth        | Supabase Auth                               |
| Realtime    | Supabase Realtime                           |
| Market Data | Binance API / WebSocket                     |

## Troubleshooting

| Symptom                                        | Cause                                                                                    | Fix                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Scanner status returns 500                     | `websockets` v16 removed `.open` property                                                | Fixed in `binance_ws.py` — uses `.state.name == "OPEN"` instead          |
| Scanner shows `strategies: 0` at startup       | `@register_strategy` decorator stored property object as dict key instead of string name | Fixed in `registry.py` — properly resolves property descriptors          |
| Verbose WebSocket debug logs flood the console | `websockets` v16 default log level is DEBUG                                              | Set `WEBSOCKETS_LOG_LEVEL=WARNING` env var or suppress in logging config |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## License

Private — All rights reserved.
