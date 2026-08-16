"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Trade, TradeCreate, TradeUpdate } from "@/types/trade";

/**
 * Hook for fetching trades from Supabase with RLS.
 */
export function useTrades(options?: {
  status?: string;
  symbol?: string;
  limit?: number;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("trades")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(options?.limit || 50);

      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.symbol) {
        query = query.eq("symbol", options.symbol);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setTrades((data || []) as Trade[]);
      setTotal(count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to fetch trades");
    } finally {
      setLoading(false);
    }
  }, [options?.status, options?.symbol, options?.limit]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  return { trades, loading, error, total, refetch: fetchTrades };
}

/**
 * Hook for trade mutations (create, update, delete).
 */
export function useTradeActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTrade = useCallback(async (trade: TradeCreate): Promise<Trade | null> => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error: insertError } = await supabase
        .from("trades")
        .insert({
          ...trade,
          user_id: user.id,
          entry_time: trade.entry_time || new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data as Trade;
    } catch (err: any) {
      setError(err.message || "Failed to create trade");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTrade = useCallback(
    async (tradeId: string, update: TradeUpdate): Promise<Trade | null> => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const updateData: any = { ...update };

        // Auto-set exit_time and status when closing
        if (update.exit_price && !update.exit_time) {
          updateData.exit_time = new Date().toISOString();
        }
        if (update.exit_price) {
          updateData.status = "closed";
        }

        const { data, error: updateError } = await supabase
          .from("trades")
          .update(updateData)
          .eq("id", tradeId)
          .select()
          .single();

        if (updateError) throw updateError;
        return data as Trade;
      } catch (err: any) {
        setError(err.message || "Failed to update trade");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteTrade = useCallback(async (tradeId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("trades")
        .delete()
        .eq("id", tradeId);

      if (deleteError) throw deleteError;
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to delete trade");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createTrade, updateTrade, deleteTrade, loading, error };
}
