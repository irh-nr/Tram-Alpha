# Session Handoff: Proceeding to Phase 6 (Hardening & Polish)

To continue development smoothly, paste the prompt below into the AI session tomorrow.

---

### Copy-Paste Prompt for the Next Session

```markdown
We are building the Tram crypto trading signal and journaling platform.
We have completed Phases 1–5: Foundation, Signal Engine, Trading Journal, Dashboard & Analytics, and Alerts & Polish.

Please check:
- `docs/08_phase5_complete.md` for the Phase 5 completion summary.
- `knowledge/tram-project-state/artifacts/project_state.md` for platform configuration, active Supabase project ID (`upvvjuxgmoceiaijhkzp`), test user credentials, and active environment.

Our goal for today is to proceed to **Phase 6: Hardening & UI Polish**.

### Phase 6 Objectives

1. **Strategy Management Page**:
   - Replace the placeholder on the `/dashboard/strategies` page.
   - Fetch the available strategies (e.g., EMA Crossover, RSI Divergence, Volume Breakout) from the backend/database.
   - Allow users to view strategy details, and enable/disable specific strategies for their account. 

2. **Signal Filtering by Strategy**:
   - Update the `/dashboard/signals` page to allow filtering by strategy.
   - Update the `useSignals` hook in `frontend/hooks/use-signals.ts` to accept a `strategy_id` filter.
   - Update the `SignalFilters` component (`frontend/components/signals/signal-filters.tsx`) to include a dropdown to select a strategy.

3. **Signal Data Management (Cleanup)**:
   - Allow users to manually delete old signals or configure an automatic cleanup threshold (e.g., delete signals older than 7 days) to keep the signals feed relevant and performant.
   - You may need to add a `DELETE` route for signals or a bulk cleanup function in the backend, and trigger it via the UI or a background job.

4. **UI Polish & Error Fixes**:
   - Fix usability issues such as the missing "eye" button to view passwords on the login/signup screens.
   - Review and improve spacing, empty states, and overall visual polish across the dashboard.
   - Ensure loading states are consistent.

5. **Enrich the Settings Page**:
   - Expand the `/dashboard/settings` page.
   - Add new sections such as Profile details (Name, Avatar), and Data Management (Signal cleanup retention settings).

Let's begin by reviewing the `frontend/app/dashboard/strategies/page.tsx`, `frontend/components/signals/signal-filters.tsx`, and the authentication forms to plan our implementation for Phase 6.
```
