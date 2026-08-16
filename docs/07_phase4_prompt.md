# Session Handoff: Proceeding to Phase 4 (Dashboard & Analytics)

To continue development smoothly, paste the prompt below into the AI session tomorrow.

---

### Copy-Paste Prompt for the Next Session

```markdown
We are building the Tram crypto trading signal and journaling platform. 
We have successfully completed Phase 1 (Foundation), Phase 2 (Signal Engine), and Phase 3 (Trading Journal & CRUD). 

Please check:
- `docs/06_phase3_complete.md` for a summary of Phase 3 deliverables.
- `knowledge/tram-project-state/artifacts/project_state.md` for the current platform configuration, active Supabase project ID (`upvvjuxgmoceiaijhkzp`), test user credentials, and active environment.

Our goal for today is to proceed to Phase 4: Dashboard & Analytics.
Currently, the main Dashboard page (`frontend/app/dashboard/page.tsx`) uses placeholder/dummy statistics and mocks.

Here are our objectives for Phase 4:

1. **Dashboard Data Integration (P0)**:
   - Use our existing React hooks (`useTrades` and `useJournal` or specialized hooks) to populate the main Dashboard dashboard cards (Total PnL, Win Rate, Trades Count, Active/Pending Signals).
   - Display a list of the latest live trading signals (real database values using `useSignals`/`useRealtimeSignals` instead of mock signals).
   - Display a list of recent active trades in a simplified table or grid.

2. **Equity Curve & Performance Charts (P0)**:
   - Implement an interactive Equity Curve chart.
   - Use a lightweight, premium charting solution (e.g., Recharts, or lightweight-charts by TradingView) to display cumulative profit/loss over time based on closed trade histories (`pnl_amount` and close times).
   - Make it highly aesthetic: modern dark-theme styling, neon gradient fills, and smooth tooltip behaviors.

3. **Performance Metrics Suite (P0/P1)**:
   - Compute and display advanced performance metrics on the dashboard/analytics page:
     - Sharpe Ratio (using risk-free rate assumption or simple std dev of trade returns)
     - Maximum Drawdown (peak-to-trough drop in equity)
     - Average Risk-to-Reward Ratio (RR) achieved
     - Profit Factor (gross profit / gross loss)
     - Average Win vs Average Loss size

4. **Trade Distribution & Psych Analytics (P1)**:
   - Create a chart showing trade distribution by symbol or by emotional state (e.g., how emotional state at trade open/close correlates with PnL).
   - Visualize mistake tags to highlight the user's most common trading pitfalls (e.g. FOMO, No plan).

Let's begin by reviewing `frontend/app/dashboard/page.tsx`, deciding on a charting library (Recharts is a standard, lightweight choice that integrates beautifully with Tailwind v4), and planning the layout for these real-time charts and metrics.
```
