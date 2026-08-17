"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  DollarSign,
  BarChart3,
  Zap,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Hooks
import { useTrades } from "@/hooks/use-trades";
import { useSignals, useRealtimeSignals } from "@/hooks/use-signals";
import { useJournal } from "@/hooks/use-journal";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

// Chart components
import { EquityCurve } from "@/components/dashboard/equity-curve";
import { PerformanceMetricsGrid } from "@/components/dashboard/performance-metrics";

// Analytics helpers
import { formatCurrency as formatAnalyticsCurrency, formatPercent } from "@/lib/analytics";
import { useCurrency } from "@/hooks/use-currency";

export default function DashboardPage() {
  // ── Data fetching ────────────────────────────────────────
  const { trades, loading: tradesLoading } = useTrades({ limit: 200 });
  const { signals: fetchedSignals, loading: signalsLoading } = useSignals({ limit: 20 });
  const { signals: liveSignals, isConnected } = useRealtimeSignals(fetchedSignals);
  const { entries: journalEntries, loading: journalLoading } = useJournal({ limit: 200 });

  // ── Computed stats ───────────────────────────────────────
  const {
    metrics,
    equityCurve,
    activeSignals,
  } = useDashboardStats(trades, liveSignals, journalEntries);

  const { formatAmount, formatPrice, symbol: currencySymbol } = useCurrency();

  const isLoading = tradesLoading || signalsLoading;

  // Recent signals (latest 5 active)
  const recentSignals = useMemo(
    () =>
      liveSignals
        .filter((s) => s.status === "active")
        .slice(0, 5),
    [liveSignals]
  );

  // Recent trades (latest 5)
  const recentTrades = useMemo(
    () => trades.slice(0, 5),
    [trades]
  );

  // Stat cards
  const statCards = useMemo(
    () => [
      {
        label: "Total PnL",
        value: formatAmount(metrics.totalPnl),
        change: formatPercent(metrics.winRate - 50), // relative to breakeven
        trend: metrics.totalPnl >= 0 ? ("up" as const) : ("down" as const),
        icon: DollarSign,
        accentClass: metrics.totalPnl >= 0 ? "from-emerald-500/40" : "from-red-500/40",
      },
      {
        label: "Win Rate",
        value: `${metrics.winRate}%`,
        change: `${metrics.wins}W / ${metrics.losses}L`,
        trend: metrics.winRate >= 50 ? ("up" as const) : ("down" as const),
        icon: Target,
        accentClass: metrics.winRate >= 50 ? "from-emerald-500/40" : "from-amber-500/40",
      },
      {
        label: "Avg R:R",
        value: metrics.avgRiskReward > 0 ? `${metrics.avgRiskReward.toFixed(1)}:1` : "—",
        change: `${metrics.closedTrades} closed`,
        trend: metrics.avgRiskReward >= 2 ? ("up" as const) : ("down" as const),
        icon: BarChart3,
        accentClass: metrics.avgRiskReward >= 2 ? "from-emerald-500/40" : "from-amber-500/40",
      },
      {
        label: "Active Signals",
        value: `${activeSignals}`,
        change: isConnected ? "Live" : "Connecting...",
        trend: "up" as const,
        icon: Zap,
        accentClass: "from-primary/40",
      },
    ],
    [metrics, activeSignals, isConnected]
  );

  // ── Loading skeleton ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading your trading data...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your trading performance and active signals
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Realtime
            </Badge>
          )}
        </div>
      </div>

      {/* ── Stats Grid ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {stat.trend === "up" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                <span
                  className={`text-xs font-medium ${
                    stat.trend === "up" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {stat.change}
                </span>
              </div>
            </CardContent>
            {/* Gradient accent */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${stat.accentClass} via-transparent to-transparent`} />
          </Card>
        ))}
      </div>

      {/* ── Equity Curve + Active Signals ────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Equity Curve */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Equity Curve</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cumulative profit/loss over time
                </p>
              </div>
              {equityCurve.length > 0 && (
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${
                    metrics.totalPnl >= 0
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}
                >
                  {formatAmount(metrics.totalPnl)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <EquityCurve data={equityCurve} height={280} />
          </CardContent>
        </Card>

        {/* Active Signals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Active Signals</CardTitle>
              <Link href="/dashboard/signals">
                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-accent transition-colors gap-1">
                  <Activity className="h-3 w-3" />
                  View All
                  <ArrowRight className="h-3 w-3" />
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentSignals.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active signals</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Signals appear when the scanner detects opportunities
                  </p>
                </div>
              </div>
            ) : (
              recentSignals.map((signal) => {
                const timeDiff = Date.now() - new Date(signal.detected_at).getTime();
                const minutes = Math.floor(timeDiff / 60000);
                const timeAgo =
                  minutes < 60
                    ? `${minutes}m ago`
                    : `${Math.floor(minutes / 60)}h ago`;

                return (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between rounded-lg bg-accent/30 px-4 py-3 transition-all duration-200 hover:bg-accent/50 hover:translate-x-0.5"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${
                          signal.direction === "long"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-red-500/30 bg-red-500/10 text-red-400"
                        }`}
                      >
                        {signal.direction.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="text-sm font-semibold">{signal.symbol}</p>
                        <p className="text-xs text-muted-foreground">{signal.timeframe}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{signal.confidence}%</p>
                      <p className="text-xs text-muted-foreground">{timeAgo}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Performance Metrics ──────────────────────────── */}
      {metrics.closedTrades > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Performance Metrics</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Advanced analytics from {metrics.closedTrades} closed trades
              </p>
            </div>
            <Link href="/dashboard/analytics">
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-accent transition-colors gap-1">
                Full Analytics
                <ArrowRight className="h-3 w-3" />
              </Badge>
            </Link>
          </div>
          <PerformanceMetricsGrid metrics={metrics} />
        </div>
      )}

      {/* ── Recent Trades ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Trades</CardTitle>
            <Link href="/dashboard/journal">
              <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-accent transition-colors gap-1">
                View All
                <ArrowRight className="h-3 w-3" />
              </Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTrades.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No trades yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Record your first trade to see it here
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between rounded-lg bg-accent/30 px-4 py-3 transition-all duration-200 hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${
                        trade.direction === "long"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-red-500/30 bg-red-500/10 text-red-400"
                      }`}
                    >
                      {trade.direction.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="text-sm font-semibold">{trade.symbol}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-4 px-1.5 ${
                            trade.status === "open"
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                              : trade.status === "closed"
                              ? "border-white/10"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {trade.status}
                        </Badge>
                        {trade.timeframe && (
                          <span className="text-[10px] text-muted-foreground">
                            {trade.timeframe}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.status === "closed" ? (
                      <>
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            trade.pnl_amount > 0
                              ? "text-emerald-400"
                              : trade.pnl_amount < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {trade.pnl_amount === 0
                            ? "—"
                            : formatAmount(trade.pnl_amount)}
                        </p>
                        {trade.pnl_percent !== 0 && (
                          <p
                            className={`text-xs tabular-nums ${
                              trade.pnl_percent > 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {trade.pnl_percent > 0 ? "+" : ""}
                            {trade.pnl_percent.toFixed(1)}%
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-medium text-blue-400">
                        {formatPrice(trade.entry_price)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
