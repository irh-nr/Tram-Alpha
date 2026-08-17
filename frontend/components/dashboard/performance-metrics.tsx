"use client";

import {
  TrendingUp,
  TrendingDown,
  Shield,
  Flame,
  Scale,
  Timer,
  Trophy,
  Skull,
  Sparkles,
  Target,
} from "lucide-react";
import type { PerformanceMetrics } from "@/lib/analytics";
import { formatPercent, formatDuration } from "@/lib/analytics";
import { useCurrency } from "@/hooks/use-currency";

interface PerformanceMetricsGridProps {
  metrics: PerformanceMetrics;
}

interface MetricCardData {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  tooltip?: string;
}

export function PerformanceMetricsGrid({ metrics }: PerformanceMetricsGridProps) {
  const { formatAmount, symbol: cs } = useCurrency();
  const cards: MetricCardData[] = [
    {
      label: "Sharpe Ratio",
      value: metrics.sharpeRatio.toFixed(2),
      subValue: metrics.sharpeRatio >= 1 ? "Good" : metrics.sharpeRatio >= 2 ? "Excellent" : "Below avg",
      icon: Shield,
      colorClass: metrics.sharpeRatio >= 1 ? "text-emerald-400" : "text-amber-400",
      bgClass: metrics.sharpeRatio >= 1 ? "bg-emerald-500/10" : "bg-amber-500/10",
      tooltip: "Risk-adjusted return (mean / std dev of trade returns)",
    },
    {
      label: "Max Drawdown",
      value: formatAmount(-metrics.maxDrawdown),
      subValue: metrics.maxDrawdownPercent > 0 ? `${metrics.maxDrawdownPercent.toFixed(1)}%` : "—",
      icon: Flame,
      colorClass: metrics.maxDrawdown > 0 ? "text-red-400" : "text-emerald-400",
      bgClass: metrics.maxDrawdown > 0 ? "bg-red-500/10" : "bg-emerald-500/10",
      tooltip: "Largest peak-to-trough drop in equity",
    },
    {
      label: "Profit Factor",
      value: metrics.profitFactor >= 999 ? "∞" : metrics.profitFactor.toFixed(2),
      subValue: metrics.profitFactor >= 1.5 ? "Profitable" : "Needs work",
      icon: Scale,
      colorClass: metrics.profitFactor >= 1.5 ? "text-emerald-400" : "text-amber-400",
      bgClass: metrics.profitFactor >= 1.5 ? "bg-emerald-500/10" : "bg-amber-500/10",
      tooltip: "Gross profit / gross loss",
    },
    {
      label: "Avg Win / Loss",
      value: `${formatAmount(metrics.avgWin).replace('+', '')} / ${formatAmount(-metrics.avgLoss).replace('-', '')}`,
      subValue: metrics.avgLoss > 0 ? `${(metrics.avgWin / metrics.avgLoss).toFixed(1)}x ratio` : "—",
      icon: Target,
      colorClass: metrics.avgWin > metrics.avgLoss ? "text-emerald-400" : "text-red-400",
      bgClass: metrics.avgWin > metrics.avgLoss ? "bg-emerald-500/10" : "bg-red-500/10",
      tooltip: "Average winning trade vs average losing trade",
    },
    {
      label: "Expectancy",
      value: formatAmount(metrics.expectancy),
      subValue: "Per trade",
      icon: Sparkles,
      colorClass: metrics.expectancy >= 0 ? "text-emerald-400" : "text-red-400",
      bgClass: metrics.expectancy >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
      tooltip: "(Win% × Avg Win) - (Loss% × Avg Loss)",
    },
    {
      label: "Avg Duration",
      value: formatDuration(metrics.avgTradeDuration),
      subValue: `${metrics.closedTrades} closed trades`,
      icon: Timer,
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/10",
      tooltip: "Average time a trade is held open",
    },
    {
      label: "Best Streak",
      value: `${metrics.consecutiveWins}W`,
      subValue: `${metrics.consecutiveLosses}L worst`,
      icon: Trophy,
      colorClass: "text-amber-400",
      bgClass: "bg-amber-500/10",
      tooltip: "Longest consecutive wins vs losses",
    },
    {
      label: "Largest Win / Loss",
      value: formatAmount(metrics.largestWin),
      subValue: formatAmount(metrics.largestLoss),
      icon: metrics.largestWin > Math.abs(metrics.largestLoss) ? TrendingUp : TrendingDown,
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-500/10",
      tooltip: "Single best and worst trade results",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-card p-4 transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg"
          title={card.tooltip}
        >
          {/* Background glow on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <div className={`absolute inset-0 ${card.bgClass} opacity-30 blur-xl`} />
          </div>

          <div className="relative flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {card.label}
              </p>
              <p className={`text-lg font-bold tracking-tight ${card.colorClass}`}>
                {card.value}
              </p>
              {card.subValue && (
                <p className="text-[11px] text-muted-foreground/70">
                  {card.subValue}
                </p>
              )}
            </div>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bgClass} transition-transform duration-300 group-hover:scale-110`}>
              <card.icon className={`h-4 w-4 ${card.colorClass}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
