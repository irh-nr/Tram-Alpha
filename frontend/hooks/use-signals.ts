"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Signal } from "@/types/signal";

/**
 * Hook for subscribing to Supabase Realtime signal events.
 * Listens for new signals inserted into the database and
 * provides a live-updating list.
 */
export function useRealtimeSignals(initialSignals: Signal[] = []) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setSignals(initialSignals);
  }, [initialSignals]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("signals-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "signals",
        },
        (payload) => {
          const newSignal = payload.new as Signal;
          setSignals((prev) => [newSignal, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "signals",
        },
        (payload) => {
          const updated = payload.new as Signal;
          setSignals((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { signals, isConnected };
}

/**
 * Hook for fetching signals from Supabase directly.
 * Uses the browser client with the user's session for RLS.
 */
export function useSignals(options?: {
  status?: string;
  symbol?: string;
  strategy_id?: string;
  limit?: number;
}) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("signals")
        .select("*, strategies(name)", { count: "exact" })
        .order("detected_at", { ascending: false })
        .limit(options?.limit || 50);

      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.symbol) {
        query = query.eq("symbol", options.symbol);
      }
      if (options?.strategy_id) {
        query = query.eq("strategy_id", options.strategy_id);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Map strategy name from join
      const mapped: Signal[] = (data || []).map((row: any) => ({
        ...row,
        strategy_name: row.strategies?.name || null,
        strategies: undefined,
      }));

      setSignals(mapped);
      setTotal(count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to fetch signals");
    } finally {
      setLoading(false);
    }
  }, [options?.status, options?.symbol, options?.strategy_id, options?.limit]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return { signals, loading, error, total, refetch: fetchSignals };
}
