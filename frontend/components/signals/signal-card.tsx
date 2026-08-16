"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Shield,
  TrendingUp,
} from "lucide-react";
import type { Signal } from "@/types/signal";
import { useCurrency } from "@/hooks/use-currency";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}



interface SignalCardProps {
  signal: Signal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const { formatPrice } = useCurrency();
  const isLong = signal.direction === "long";
  const directionColor = isLong ? "text-profit" : "text-loss";
  const directionBg = isLong
    ? "bg-profit/10 border-profit/20"
    : "bg-loss/10 border-loss/20";
  const rr = signal.risk_reward ?? 0;

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
      {/* Subtle gradient accent on left */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          isLong ? "bg-profit" : "bg-loss"
        }`}
      />

      <CardContent className="p-4 pl-5">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Direction Badge */}
            <Badge
              variant="outline"
              className={`${directionBg} ${directionColor} border font-bold text-xs uppercase tracking-wider`}
            >
              {isLong ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              )}
              {signal.direction}
            </Badge>

            {/* Symbol */}
            <div>
              <span className="font-bold text-foreground text-lg tracking-tight">
                {signal.symbol}
              </span>
              <span className="text-muted-foreground text-xs ml-2">
                {signal.timeframe}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Confidence */}
            <div className="flex items-center gap-1">
              <div className="relative w-10 h-10">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-muted/30"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${(signal.confidence / 100) * 87.96} 87.96`}
                    strokeLinecap="round"
                    className={
                      signal.confidence >= 70
                        ? "text-profit"
                        : signal.confidence >= 50
                        ? "text-warning"
                        : "text-loss"
                    }
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                  {Math.round(signal.confidence)}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <Badge
              variant={
                signal.status === "active"
                  ? "default"
                  : signal.status === "triggered"
                  ? "secondary"
                  : "outline"
              }
              className={`text-xs ${
                signal.status === "active"
                  ? "bg-primary/20 text-primary border-primary/30"
                  : signal.status === "triggered"
                  ? "bg-profit/20 text-profit border-profit/30"
                  : signal.status === "expired"
                  ? "bg-muted text-muted-foreground"
                  : ""
              }`}
            >
              {signal.status}
            </Badge>
          </div>
        </div>

        {/* Price Levels Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-muted/30 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
              <Target className="h-3 w-3" />
              Entry
            </div>
            <div className="font-mono text-sm font-semibold">
              {formatPrice(signal.entry_price)}
            </div>
          </div>

          <div className="bg-loss/5 rounded-lg p-2.5 text-center border border-loss/10">
            <div className="flex items-center justify-center gap-1 text-loss text-xs mb-1">
              <Shield className="h-3 w-3" />
              Stop Loss
            </div>
            <div className="font-mono text-sm font-semibold text-loss">
              {formatPrice(signal.stop_loss)}
            </div>
          </div>

          <div className="bg-profit/5 rounded-lg p-2.5 text-center border border-profit/10">
            <div className="flex items-center justify-center gap-1 text-profit text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              Take Profit
            </div>
            <div className="font-mono text-sm font-semibold text-profit">
              {formatPrice(signal.take_profit)}
            </div>
          </div>
        </div>

        {/* Footer Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* R:R Ratio */}
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">R:R</span>
              <span className={rr >= 2 ? "text-profit font-semibold" : ""}>
                {rr.toFixed(1)}
              </span>
            </span>

            {/* Strategy Name */}
            {signal.strategy_name && (
              <span className="text-primary/70">{signal.strategy_name}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(signal.detected_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
