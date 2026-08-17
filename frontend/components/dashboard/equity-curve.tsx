"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { EquityPoint } from "@/lib/analytics";
import { useCurrency } from "@/hooks/use-currency";

interface EquityCurveProps {
  data: EquityPoint[];
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload as EquityPoint;
  const isProfit = point.pnl >= 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { formatAmount } = useCurrency();

  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.14_0.005_260)] px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-xs text-muted-foreground mb-1">{point.date}</p>
      <p className="text-sm font-semibold text-foreground">
        {point.symbol}
      </p>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-muted-foreground">Trade PnL</span>
          <span
            className={`text-xs font-semibold ${isProfit ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatAmount(point.pnl)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs text-muted-foreground">Cumulative</span>
          <span
            className={`text-sm font-bold ${point.equity >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {formatAmount(point.equity)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EquityCurve({ data, height = 300 }: EquityCurveProps) {
  const { symbol: cs, convert, currency } = useCurrency();
  const isPositive = useMemo(() => {
    if (data.length === 0) return true;
    return data[data.length - 1].equity >= 0;
  }, [data]);

  const gradientId = "equity-gradient";
  const lineColor = isPositive ? "#34d399" : "#f87171"; // emerald-400 / red-400

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No closed trades yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Your equity curve will appear after closing trades
          </p>
        </div>
      </div>
    );
  }

  // Pad with an initial zero point and convert values for current currency
  const chartData = useMemo(() => [
    { date: "", timestamp: 0, equity: 0, pnl: 0, symbol: "Start", tradeId: "" },
    ...data.map((d) => ({
      ...d,
      equity: convert(d.equity),
      pnl: convert(d.pnl),
    })),
  ], [data, convert]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
            <stop offset="50%" stopColor={lineColor} stopOpacity={0.1} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 5%)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
          tickFormatter={(v: number) => {
            const abs = Math.abs(v);
            if (currency === "IDR") {
              if (abs >= 1_000_000_000) return `${cs}${(v / 1_000_000_000).toFixed(1)}B`;
              if (abs >= 1_000_000) return `${cs}${(v / 1_000_000).toFixed(1)}M`;
              if (abs >= 1_000) return `${cs}${(v / 1_000).toFixed(0)}K`;
              return `${cs}${v.toFixed(0)}`;
            }
            return `${cs}${v}`;
          }}
          dx={-4}
          width={currency === "IDR" ? 80 : 60}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="oklch(0.4 0 0)" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={lineColor}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 5,
            fill: lineColor,
            stroke: "oklch(0.14 0.005 260)",
            strokeWidth: 2,
          }}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
