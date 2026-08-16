"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import type { SymbolDistribution, EmotionCorrelation } from "@/lib/analytics";
import { formatCurrency } from "@/lib/analytics";

// ────────────────────────────────────────────────────────────
// Symbol Distribution Chart
// ────────────────────────────────────────────────────────────

interface SymbolDistributionChartProps {
  data: SymbolDistribution[];
  height?: number;
}

function SymbolTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as SymbolDistribution;

  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.14_0.005_260)] px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-sm font-semibold text-foreground">{d.symbol}</p>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Trades</span>
          <span className="text-xs font-semibold">{d.trades}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Total PnL</span>
          <span className={`text-xs font-semibold ${d.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(d.totalPnl)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Win Rate</span>
          <span className="text-xs font-semibold">{d.winRate}%</span>
        </div>
      </div>
    </div>
  );
}

export function SymbolDistributionChart({
  data,
  height = 250,
}: SymbolDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No trade data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 5%)"
          vertical={false}
        />
        <XAxis
          dataKey="symbol"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
          dy={8}
          tickFormatter={(v: string) => v.replace("USDT", "")}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
          tickFormatter={(v) => `$${v}`}
          width={55}
        />
        <Tooltip content={<SymbolTooltip />} />
        <Bar dataKey="totalPnl" radius={[6, 6, 0, 0]} animationDuration={1200}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.totalPnl >= 0 ? "#34d399" : "#f87171"}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ────────────────────────────────────────────────────────────
// Emotion Correlation Chart
// ────────────────────────────────────────────────────────────

interface EmotionCorrelationChartProps {
  data: EmotionCorrelation[];
  height?: number;
}

const EMOTION_COLORS: Record<string, string> = {
  calm: "#60a5fa",       // blue-400
  confident: "#34d399",  // emerald-400
  neutral: "#94a3b8",    // slate-400
  anxious: "#fbbf24",    // amber-400
  fearful: "#f87171",    // red-400
  greedy: "#fb923c",     // orange-400
  frustrated: "#ef4444", // red-500
};

function EmotionTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as EmotionCorrelation;

  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.14_0.005_260)] px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-sm font-semibold text-foreground">
        {d.emoji} {d.emotion.charAt(0).toUpperCase() + d.emotion.slice(1)}
      </p>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Trades</span>
          <span className="text-xs font-semibold">{d.trades}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Avg PnL</span>
          <span className={`text-xs font-semibold ${d.avgPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(d.avgPnl)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs text-muted-foreground">Win Rate</span>
          <span className="text-xs font-semibold">{d.winRate}%</span>
        </div>
      </div>
    </div>
  );
}

export function EmotionCorrelationChart({
  data,
  height = 250,
}: EmotionCorrelationChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">
          No emotional state data — link journal entries to trades
        </p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: `${d.emoji} ${d.emotion.charAt(0).toUpperCase() + d.emotion.slice(1)}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 5%)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
          tickFormatter={(v) => `$${v}`}
          width={55}
        />
        <Tooltip content={<EmotionTooltip />} />
        <Bar dataKey="avgPnl" radius={[6, 6, 0, 0]} animationDuration={1200}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={EMOTION_COLORS[entry.emotion] || "#94a3b8"}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
