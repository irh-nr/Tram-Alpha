"use client";

import { useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Brain,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Trophy,
  Target,
  Flame,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Hooks
import { useTrades } from "@/hooks/use-trades";
import { useSignals } from "@/hooks/use-signals";
import { useJournal } from "@/hooks/use-journal";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

// Chart components
import { EquityCurve } from "@/components/dashboard/equity-curve";
import { PerformanceMetricsGrid } from "@/components/dashboard/performance-metrics";
import {
  SymbolDistributionChart,
  EmotionCorrelationChart,
} from "@/components/dashboard/trade-distribution";
import { MistakeTagsChart } from "@/components/dashboard/mistake-tags-chart";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";

// Analytics helpers
import { formatCurrency, formatPercent } from "@/lib/analytics";

export default function AnalyticsPage() {
  // ── Data fetching ────────────────────────────────────────
  const { trades, loading: tradesLoading } = useTrades({ limit: 500 });
  const { signals, loading: signalsLoading } = useSignals({ limit: 100 });
  const { entries: journalEntries, loading: journalLoading } = useJournal({ limit: 500 });

  const isLoading = tradesLoading || signalsLoading || journalLoading;

  // ── Computed stats ───────────────────────────────────────
  const {
    metrics,
    equityCurve,
    symbolDistribution,
    emotionCorrelation,
    mistakeTagStats,
  } = useDashboardStats(trades, signals, journalEntries);

  const closedTrades = useMemo(
    () => trades.filter((t) => t.status === "closed"),
    [trades]
  );

  // Minimum data threshold
  const hasEnoughData = closedTrades.length >= 2;

  // ── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading analytics data...</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Crunching numbers...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────
  if (!hasEnoughData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors gap-1">
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Badge>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              In-depth performance analysis and trading metrics
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Not Enough Data</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
              Close at least 2 trades to unlock detailed analytics, equity curves,
              and strategy comparisons. You currently have{" "}
              <span className="font-semibold text-foreground">{closedTrades.length}</span>{" "}
              closed trade{closedTrades.length !== 1 ? "s" : ""}.
            </p>
            <Link href="/dashboard/journal" className="mt-4">
              <Badge variant="secondary" className="cursor-pointer hover:bg-accent transition-colors">
                Go to Journal →
              </Badge>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors gap-1">
            <ArrowLeft className="h-3 w-3" />
            Dashboard
          </Badge>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            In-depth performance analysis from {metrics.closedTrades} closed trades
          </p>
        </div>
      </div>

      {/* ── Overview Cards ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Net Profit
                </p>
                <p className={`text-2xl font-bold tracking-tight ${metrics.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(metrics.totalPnl)}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${metrics.totalPnl >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <TrendingUp className={`h-5 w-5 ${metrics.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`} />
              </div>
            </div>
          </CardContent>
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${metrics.totalPnl >= 0 ? "from-emerald-500/40" : "from-red-500/40"} via-transparent to-transparent`} />
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Win Rate
                </p>
                <p className="text-2xl font-bold tracking-tight">{metrics.winRate}%</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.wins}W / {metrics.losses}L
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/40 via-transparent to-transparent" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profit Factor
                </p>
                <p className={`text-2xl font-bold tracking-tight ${metrics.profitFactor >= 1.5 ? "text-emerald-400" : "text-amber-400"}`}>
                  {metrics.profitFactor >= 999 ? "∞" : metrics.profitFactor.toFixed(2)}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${metrics.profitFactor >= 1.5 ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                <Shield className={`h-5 w-5 ${metrics.profitFactor >= 1.5 ? "text-emerald-400" : "text-amber-400"}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Gross profit / gross loss
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Max Drawdown
                </p>
                <p className={`text-2xl font-bold tracking-tight ${metrics.maxDrawdown > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {formatCurrency(-metrics.maxDrawdown)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <Flame className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.maxDrawdownPercent > 0 ? `${metrics.maxDrawdownPercent.toFixed(1)}% from peak` : "No drawdown"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Equity Curve (Full Width) ────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Equity Curve</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cumulative P&L across {equityCurve.length} trades
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${
                metrics.totalPnl >= 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {formatCurrency(metrics.totalPnl)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <EquityCurve data={equityCurve} height={350} />
        </CardContent>
      </Card>

      {/* ── Calendar Heatmap ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Trading Activity</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily trading and journaling activity heatmap
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <CalendarHeatmap trades={trades} journalEntries={journalEntries} />
        </CardContent>
      </Card>

      {/* ── Performance Metrics Grid ─────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Advanced Metrics</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Risk-adjusted returns, streak analysis, and trade characteristics
        </p>
        <PerformanceMetricsGrid metrics={metrics} />
      </div>

      {/* ── Distribution Charts ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Symbol */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">PnL by Symbol</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Performance breakdown per trading pair
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {symbolDistribution.length} pair{symbolDistribution.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <SymbolDistributionChart data={symbolDistribution} height={280} />
          </CardContent>
        </Card>

        {/* Emotion Correlation */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Emotion vs PnL
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How your emotional state correlates with trading results
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <EmotionCorrelationChart data={emotionCorrelation} height={280} />
          </CardContent>
        </Card>
      </div>

      {/* ── Mistake Tags Analysis ────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Trading Pitfalls
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Most common mistake tags and their average PnL impact
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {mistakeTagStats.length} tag{mistakeTagStats.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <MistakeTagsChart data={mistakeTagStats} />
        </CardContent>
      </Card>

      {/* ── Win/Loss Breakdown Table ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Detailed Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    All
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-emerald-400/70 uppercase tracking-wider">
                    Wins
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-red-400/70 uppercase tracking-wider">
                    Losses
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                <tr className="hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 px-3 font-medium">Count</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{metrics.closedTrades}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">{metrics.wins}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-400">{metrics.losses}</td>
                </tr>
                <tr className="hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 px-3 font-medium">Percentage</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">100%</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">{metrics.winRate}%</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-400">{(100 - metrics.winRate).toFixed(1)}%</td>
                </tr>
                <tr className="hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 px-3 font-medium">Total PnL</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${metrics.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(metrics.totalPnl)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                    {formatCurrency(metrics.avgWin * metrics.wins)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-400">
                    {formatCurrency(-(metrics.avgLoss * metrics.losses))}
                  </td>
                </tr>
                <tr className="hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 px-3 font-medium">Average</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {metrics.closedTrades > 0 ? formatCurrency(metrics.totalPnl / metrics.closedTrades) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                    {formatCurrency(metrics.avgWin)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-400">
                    {formatCurrency(-metrics.avgLoss)}
                  </td>
                </tr>
                <tr className="hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 px-3 font-medium">Largest</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">—</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                    {formatCurrency(metrics.largestWin)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-400">
                    {formatCurrency(metrics.largestLoss)}
                  </td>
                </tr>
                <tr className="hover:bg-accent/20 transition-colors">
                  <td className="py-2.5 px-3 font-medium">Max Streak</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">—</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">{metrics.consecutiveWins}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-red-400">{metrics.consecutiveLosses}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
