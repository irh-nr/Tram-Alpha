# Continuation Prompt — Copy & Send Tomorrow

---

```
Continue building the Tram crypto trading platform from where we left off.

Context:
- Project is at: d:\Irhamna File\Project\Programming\Tram
- Check the knowledge item "tram-project-state" for full project state
- Architecture & planning docs are saved in the project's docs/ folder:
  - docs/01_architecture.md — System topology, service responsibilities, data flows
  - docs/02_database_schema.md — Full SQL DDL for 8 tables, RLS, indexes
  - docs/03_structure_and_roadmap.md — Folder structure and 6-phase roadmap
  - docs/04_phase1_complete.md — Phase 1 completion summary
  - docs/appflow.PNG — App flow diagram
- Previous conversation: eb15297d-be6d-4792-aaec-786077ba6fd8

Current status:
- Phase 1 (Foundation) = ✅ COMPLETE
- Phase 2 (Signal Engine) = ⏳ NEXT
- Phase 3-6 = 🔲 Planned (see docs/03_structure_and_roadmap.md)

What needs to happen now:

1. CREATE the Supabase project "Tram" under Amna Corp (org: bzavgmuiqqasyqqxiyyr), region ap-southeast-1
2. APPLY the full database migration from docs/02_database_schema.md (8 tables: users, strategies, user_strategies, signals, trades, journal_entries, watchlists, alerts, performance_snapshots — with RLS, indexes, realtime publication)
3. GET the project credentials (URL, anon key, service role key, JWT secret)
4. UPDATE frontend/.env.local and create backend/.env with real credentials
5. TEST that auth flow works (signup → login → dashboard)
6. START Phase 2: Signal Engine
   - Binance WebSocket client for kline streams
   - Candle buffer + indicator calculations (EMA, RSI, Volume)
   - Strategy base class + registry pattern
   - EMA Crossover strategy implementation
   - Scanner engine main loop
   - Signals page with live data via Supabase Realtime

Remember: Think like a senior staff engineer. Production-quality code only. No toy examples.
```

---

> [!TIP]
> If Supabase still blocks project creation due to the free tier limit, you may also need to delete the `quick-recipe` project from: https://supabase.com/dashboard/project/mphijltemldenqacecle/settings/general
