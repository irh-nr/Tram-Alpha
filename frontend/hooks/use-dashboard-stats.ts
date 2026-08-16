"use client";

import { useMemo } from "react";
import type { Trade } from "@/types/trade";
import type { Signal } from "@/types/signal";
import type { JournalEntry } from "@/types/journal";
import {
  computePerformanceMetrics,
  buildEquityCurve,
  buildSymbolDistribution,
  buildEmotionCorrelation,
  buildMistakeTagStats,
  type PerformanceMetrics,
  type EquityPoint,
  type SymbolDistribution,
  type EmotionCorrelation,
  type MistakeTagStat,
} from "@/lib/analytics";

interface DashboardStats {
  metrics: PerformanceMetrics;
  equityCurve: EquityPoint[];
  symbolDistribution: SymbolDistribution[];
  emotionCorrelation: EmotionCorrelation[];
  mistakeTagStats: MistakeTagStat[];
  activeSignals: number;
  pendingSignals: number;
}

/**
 * Aggregates trades, signals, and journal data into dashboard statistics.
 * All computation is memoized for performance.
 */
export function useDashboardStats(
  trades: Trade[],
  signals: Signal[],
  journalEntries: JournalEntry[]
): DashboardStats {
  const metrics = useMemo(
    () => computePerformanceMetrics(trades),
    [trades]
  );

  const equityCurve = useMemo(
    () => buildEquityCurve(trades),
    [trades]
  );

  const symbolDistribution = useMemo(
    () => buildSymbolDistribution(trades),
    [trades]
  );

  const emotionCorrelation = useMemo(
    () => buildEmotionCorrelation(journalEntries),
    [journalEntries]
  );

  const mistakeTagStats = useMemo(
    () => buildMistakeTagStats(journalEntries),
    [journalEntries]
  );

  const activeSignals = useMemo(
    () => signals.filter((s) => s.status === "active").length,
    [signals]
  );

  const pendingSignals = useMemo(
    () => signals.filter((s) => s.status === "triggered").length,
    [signals]
  );

  return {
    metrics,
    equityCurve,
    symbolDistribution,
    emotionCorrelation,
    mistakeTagStats,
    activeSignals,
    pendingSignals,
  };
}
