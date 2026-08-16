"use client";

import type { MistakeTagStat } from "@/lib/analytics";
import { formatCurrency } from "@/lib/analytics";

interface MistakeTagsChartProps {
  data: MistakeTagStat[];
  maxItems?: number;
}

export function MistakeTagsChart({ data, maxItems = 8 }: MistakeTagsChartProps) {
  const items = data.slice(0, maxItems);
  const maxCount = Math.max(...items.map((d) => d.count), 1);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 py-12">
        <p className="text-sm text-muted-foreground">
          No mistake tags recorded yet — add tags in your journal entries
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const widthPercent = (item.count / maxCount) * 100;
        const isNegative = item.avgPnl < 0;

        return (
          <div key={item.tag} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{item.tag}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                  {item.count}×
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[11px] font-medium tabular-nums ${
                    isNegative ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {item.avgPnl !== 0 ? formatCurrency(item.avgPnl) : "—"} avg
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isNegative
                    ? "bg-gradient-to-r from-red-500/60 to-red-400/80"
                    : "bg-gradient-to-r from-amber-500/60 to-amber-400/80"
                }`}
                style={{
                  width: `${widthPercent}%`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
