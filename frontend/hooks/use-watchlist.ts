"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
}

/**
 * Hook for managing the scanner watchlist — the list of symbols
 * actively monitored by the backend scanner engine.
 *
 * Connected to:
 *   GET    /api/scanner/watchlist        → fetch current symbols
 *   POST   /api/scanner/watchlist        → add a symbol (triggers backfill + WS reconnect)
 *   DELETE /api/scanner/watchlist/:sym   → remove a symbol (triggers WS reconnect)
 */
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch current watchlist ───────────────────────────────────
  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ symbols: string[] }>("/scanner/watchlist");
      setWatchlist(
        data.symbols.map((s) => ({
          symbol: s.toUpperCase(),
          addedAt: new Date().toISOString(),
        }))
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch watchlist";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Add a new symbol to the watchlist ─────────────────────────
  const addCoin = useCallback(
    async (symbol: string) => {
      const normalized = symbol.toUpperCase().trim();
      if (!normalized) return;

      // Prevent duplicates on the client side
      if (watchlist.some((w) => w.symbol === normalized)) {
        setError(`${normalized} is already in your watchlist`);
        return;
      }

      setActionLoading(true);
      setError(null);
      try {
        const data = await api.post<{ symbols: string[] }>(
          "/scanner/watchlist",
          { symbol: normalized }
        );
        // Sync from server response — source of truth
        setWatchlist(
          data.symbols.map((s) => ({
            symbol: s.toUpperCase(),
            addedAt: new Date().toISOString(),
          }))
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to add symbol";
        setError(message);
      } finally {
        setActionLoading(false);
      }
    },
    [watchlist]
  );

  // ── Remove a symbol from the watchlist ────────────────────────
  const removeCoin = useCallback(async (symbol: string) => {
    const normalized = symbol.toUpperCase().trim();
    setActionLoading(true);
    setError(null);
    try {
      const data = await api.delete<{ symbols: string[] }>(`/scanner/watchlist/${normalized}`);
      // If the delete endpoint returns the updated list, use it
      if (data?.symbols) {
        setWatchlist(
          data.symbols.map((s: string) => ({
            symbol: s.toUpperCase(),
            addedAt: new Date().toISOString(),
          }))
        );
      } else {
        // Otherwise, remove client-side
        setWatchlist((prev) => prev.filter((w) => w.symbol !== normalized));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove symbol";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  return {
    watchlist,
    loading,
    error,
    actionLoading,
    addCoin,
    removeCoin,
    refetch: fetchWatchlist,
    clearError: () => setError(null),
  };
}
