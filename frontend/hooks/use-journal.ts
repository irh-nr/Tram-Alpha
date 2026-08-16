"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  JournalEntry,
  JournalCreate,
  JournalUpdate,
  JournalListResponse,
} from "@/types/journal";

/**
 * Hook for fetching journal entries from Supabase with RLS.
 */
export function useJournal(options?: {
  tradeId?: string;
  emotionalState?: string;
  tag?: string;
  limit?: number;
}) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("journal_entries")
        .select(
          "*, trades(id, symbol, direction, status, pnl_amount, pnl_percent, entry_price, exit_price)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .limit(options?.limit || 50);

      if (options?.tradeId) {
        query = query.eq("trade_id", options.tradeId);
      }
      if (options?.emotionalState) {
        query = query.eq("emotional_state", options.emotionalState);
      }
      if (options?.tag) {
        query = query.contains("mistake_tags", [options.tag]);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      const mapped: JournalEntry[] = (data || []).map((row: any) => ({
        ...row,
        trade: row.trades || null,
        trades: undefined,
      }));

      setEntries(mapped);
      setTotal(count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to fetch journal entries");
    } finally {
      setLoading(false);
    }
  }, [options?.tradeId, options?.emotionalState, options?.tag, options?.limit]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, error, total, refetch: fetchEntries };
}

/**
 * Hook for journal entry mutations.
 */
export function useJournalActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEntry = useCallback(
    async (entry: JournalCreate): Promise<JournalEntry | null> => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data, error: insertError } = await supabase
          .from("journal_entries")
          .insert({
            ...entry,
            user_id: user.id,
          })
          .select(
            "*, trades(id, symbol, direction, status, pnl_amount, pnl_percent, entry_price, exit_price)"
          )
          .single();

        if (insertError) throw insertError;

        return {
          ...data,
          trade: data.trades || null,
          trades: undefined,
        } as JournalEntry;
      } catch (err: any) {
        setError(err.message || "Failed to create journal entry");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateEntry = useCallback(
    async (
      entryId: string,
      update: JournalUpdate
    ): Promise<JournalEntry | null> => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        const { data, error: updateError } = await supabase
          .from("journal_entries")
          .update({
            ...update,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entryId)
          .select(
            "*, trades(id, symbol, direction, status, pnl_amount, pnl_percent, entry_price, exit_price)"
          )
          .single();

        if (updateError) throw updateError;

        return {
          ...data,
          trade: data.trades || null,
          trades: undefined,
        } as JournalEntry;
      } catch (err: any) {
        setError(err.message || "Failed to update journal entry");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteEntry = useCallback(
    async (entryId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { error: deleteError } = await supabase
          .from("journal_entries")
          .delete()
          .eq("id", entryId);

        if (deleteError) throw deleteError;
        return true;
      } catch (err: any) {
        setError(err.message || "Failed to delete journal entry");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createEntry, updateEntry, deleteEntry, loading, error };
}
