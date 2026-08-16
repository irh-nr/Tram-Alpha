import type { Trade } from "@/types/trade";
import type { JournalEntry } from "@/types/journal";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface EquityPoint {
  date: string;       // ISO string or formatted date
  timestamp: number;  // Unix ms for sorting
  equity: number;     // Cumulative PnL
  pnl: number;        // Individual trade PnL
  symbol: string;
  tradeId: string;
}

export interface PerformanceMetrics {
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  avgRiskReward: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgTradeDuration: number;        // hours
  consecutiveWins: number;
  consecutiveLosses: number;
  expectancy: number;
}

export interface SymbolDistribution {
  symbol: string;
  trades: number;
  totalPnl: number;
  winRate: number;
  avgPnl: number;
}

export interface EmotionCorrelation {
  emotion: string;
  emoji: string;
  trades: number;
  avgPnl: number;
  winRate: number;
}

export interface MistakeTagStat {
  tag: string;
  count: number;
  avgPnl: number;
  percentage: number;  // of total journal entries
}

// ────────────────────────────────────────────────────────────
// Equity Curve
// ────────────────────────────────────────────────────────────

/**
 * Build equity curve from closed trades, sorted by exit time.
 */
export function buildEquityCurve(trades: Trade[]): EquityPoint[] {
  const closed = trades
    .filter((t) => t.status === "closed" && t.exit_time && t.pnl_amount !== null)
    .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

  let cumulative = 0;
  return closed.map((trade) => {
    cumulative += trade.pnl_amount;
    const d = new Date(trade.exit_time!);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      timestamp: d.getTime(),
      equity: parseFloat(cumulative.toFixed(2)),
      pnl: trade.pnl_amount,
      symbol: trade.symbol,
      tradeId: trade.id,
    };
  });
}

// ────────────────────────────────────────────────────────────
// Performance Metrics
// ────────────────────────────────────────────────────────────

/**
 * Compute all performance metrics from an array of trades.
 */
export function computePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");

  const wins = closed.filter((t) => t.pnl_amount > 0);
  const losses = closed.filter((t) => t.pnl_amount < 0);
  const breakeven = closed.filter((t) => t.pnl_amount === 0);

  const totalPnl = closed.reduce((sum, t) => sum + t.pnl_amount, 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl_amount, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl_amount, 0) / losses.length) : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl_amount)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl_amount)) : 0;

  // Profit Factor
  const grossProfit = wins.reduce((s, t) => s + t.pnl_amount, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl_amount, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Average R:R achieved
  const rrTrades = closed.filter((t) => t.rr_achieved && t.rr_achieved > 0);
  const avgRiskReward = rrTrades.length > 0
    ? rrTrades.reduce((s, t) => s + t.rr_achieved, 0) / rrTrades.length
    : 0;

  // Sharpe Ratio (simplified: mean return / std dev of returns)
  const returns = closed.map((t) => t.pnl_amount);
  const sharpeRatio = computeSharpeRatio(returns);

  // Max Drawdown
  const { maxDrawdown, maxDrawdownPercent } = computeMaxDrawdown(closed);

  // Average trade duration (hours)
  const durations = closed
    .filter((t) => t.entry_time && t.exit_time)
    .map((t) => {
      const entry = new Date(t.entry_time).getTime();
      const exit = new Date(t.exit_time!).getTime();
      return (exit - entry) / (1000 * 60 * 60); // hours
    });
  const avgTradeDuration = durations.length > 0
    ? durations.reduce((s, d) => s + d, 0) / durations.length
    : 0;

  // Consecutive wins/losses
  const { maxConsecutiveWins, maxConsecutiveLosses } = computeStreaks(closed);

  // Expectancy = (Win% × Avg Win) - (Loss% × Avg Loss)
  const winPct = closed.length > 0 ? wins.length / closed.length : 0;
  const lossPct = closed.length > 0 ? losses.length / closed.length : 0;
  const expectancy = (winPct * avgWin) - (lossPct * avgLoss);

  return {
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    totalTrades: trades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    largestWin: parseFloat(largestWin.toFixed(2)),
    largestLoss: parseFloat(largestLoss.toFixed(2)),
    profitFactor: parseFloat((profitFactor === Infinity ? 999 : profitFactor).toFixed(2)),
    avgRiskReward: parseFloat(avgRiskReward.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    avgTradeDuration: parseFloat(avgTradeDuration.toFixed(1)),
    consecutiveWins: maxConsecutiveWins,
    consecutiveLosses: maxConsecutiveLosses,
    expectancy: parseFloat(expectancy.toFixed(2)),
  };
}

// ────────────────────────────────────────────────────────────
// Distribution Analytics
// ────────────────────────────────────────────────────────────

/**
 * Build trade distribution grouped by symbol.
 */
export function buildSymbolDistribution(trades: Trade[]): SymbolDistribution[] {
  const closed = trades.filter((t) => t.status === "closed");
  const grouped = new Map<string, Trade[]>();

  for (const trade of closed) {
    const existing = grouped.get(trade.symbol) || [];
    existing.push(trade);
    grouped.set(trade.symbol, existing);
  }

  return Array.from(grouped.entries())
    .map(([symbol, symbolTrades]) => {
      const totalPnl = symbolTrades.reduce((s, t) => s + t.pnl_amount, 0);
      const wins = symbolTrades.filter((t) => t.pnl_amount > 0).length;
      return {
        symbol,
        trades: symbolTrades.length,
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        winRate: parseFloat(((wins / symbolTrades.length) * 100).toFixed(1)),
        avgPnl: parseFloat((totalPnl / symbolTrades.length).toFixed(2)),
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

/**
 * Correlate emotional state from journal entries with PnL from linked trades.
 */
export function buildEmotionCorrelation(
  entries: JournalEntry[]
): EmotionCorrelation[] {
  const emotionMap: Record<string, { emoji: string }> = {
    calm: { emoji: "😌" },
    confident: { emoji: "💪" },
    neutral: { emoji: "😐" },
    anxious: { emoji: "😰" },
    fearful: { emoji: "😨" },
    greedy: { emoji: "🤑" },
    frustrated: { emoji: "😤" },
  };

  const grouped = new Map<string, { pnls: number[]; count: number }>();

  for (const entry of entries) {
    if (!entry.emotional_state || !entry.trade) continue;
    const emotion = entry.emotional_state;
    const existing = grouped.get(emotion) || { pnls: [], count: 0 };
    existing.pnls.push(entry.trade.pnl_amount);
    existing.count++;
    grouped.set(emotion, existing);
  }

  return Array.from(grouped.entries())
    .map(([emotion, data]) => {
      const avgPnl = data.pnls.reduce((s, p) => s + p, 0) / data.pnls.length;
      const wins = data.pnls.filter((p) => p > 0).length;
      return {
        emotion,
        emoji: emotionMap[emotion]?.emoji || "❓",
        trades: data.count,
        avgPnl: parseFloat(avgPnl.toFixed(2)),
        winRate: parseFloat(((wins / data.count) * 100).toFixed(1)),
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

/**
 * Build mistake tag statistics from journal entries.
 */
export function buildMistakeTagStats(entries: JournalEntry[]): MistakeTagStat[] {
  const tagMap = new Map<string, { count: number; pnls: number[] }>();
  const entriesWithTags = entries.filter((e) => e.mistake_tags && e.mistake_tags.length > 0);

  for (const entry of entries) {
    if (!entry.mistake_tags) continue;
    for (const tag of entry.mistake_tags) {
      const existing = tagMap.get(tag) || { count: 0, pnls: [] };
      existing.count++;
      if (entry.trade) {
        existing.pnls.push(entry.trade.pnl_amount);
      }
      tagMap.set(tag, existing);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      avgPnl: data.pnls.length > 0
        ? parseFloat((data.pnls.reduce((s, p) => s + p, 0) / data.pnls.length).toFixed(2))
        : 0,
      percentage: entries.length > 0
        ? parseFloat(((data.count / entries.length) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ────────────────────────────────────────────────────────────
// Internal Helpers
// ────────────────────────────────────────────────────────────

function computeSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return mean / stdDev;
}

function computeMaxDrawdown(closedTrades: Trade[]): {
  maxDrawdown: number;
  maxDrawdownPercent: number;
} {
  if (closedTrades.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime()
  );

  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  let maxDdPct = 0;

  for (const trade of sorted) {
    equity += trade.pnl_amount;
    if (equity > peak) {
      peak = equity;
    }
    const dd = peak - equity;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  return { maxDrawdown: maxDd, maxDrawdownPercent: maxDdPct };
}

function computeStreaks(closedTrades: Trade[]): {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
} {
  let maxWins = 0;
  let maxLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  const sorted = [...closedTrades].sort(
    (a, b) => new Date(a.exit_time || a.created_at).getTime() -
              new Date(b.exit_time || b.created_at).getTime()
  );

  for (const trade of sorted) {
    if (trade.pnl_amount > 0) {
      currentWins++;
      currentLosses = 0;
      maxWins = Math.max(maxWins, currentWins);
    } else if (trade.pnl_amount < 0) {
      currentLosses++;
      currentWins = 0;
      maxLosses = Math.max(maxLosses, currentLosses);
    } else {
      currentWins = 0;
      currentLosses = 0;
    }
  }

  return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
}

// ────────────────────────────────────────────────────────────
// Formatting Helpers
// ────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const prefix = value >= 0 ? "+$" : "-$";
  if (abs >= 1000000) return `${prefix}${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${prefix}${(abs / 1000).toFixed(2)}K`;
  return `${prefix}${abs.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
