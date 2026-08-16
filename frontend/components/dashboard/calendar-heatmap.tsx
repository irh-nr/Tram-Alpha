"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayData {
  date: string; // YYYY-MM-DD
  pnl: number;
  trades: number;
  journals: number;
}

interface CalendarHeatmapProps {
  trades: Array<{
    status: string;
    pnl_amount: number | null;
    exit_time: string | null;
    entry_time: string | null;
    created_at: string;
  }>;
  journalEntries: Array<{
    created_at: string;
  }>;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function getWeeksInYear(year: number): Date[][] {
  const weeks: Date[][] = [];
  const start = new Date(year, 0, 1);

  // Go to the Monday of the first week
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(year, 0, 1 + mondayOffset);

  let current = new Date(firstMonday);
  let currentWeek: Date[] = [];

  while (current.getFullYear() <= year) {
    currentWeek.push(new Date(current));

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    current.setDate(current.getDate() + 1);

    // Stop after we've gone past the year
    if (current.getFullYear() > year && currentWeek.length === 0) break;
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatCurrency(value: number): string {
  if (value >= 0) return `+$${Math.abs(value).toFixed(2)}`;
  return `-$${Math.abs(value).toFixed(2)}`;
}

export function CalendarHeatmap({ trades, journalEntries }: CalendarHeatmapProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  // Aggregate data by date
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>();

    // Process closed trades
    trades
      .filter((t) => t.status === "closed" && t.pnl_amount != null)
      .forEach((trade) => {
        const dateStr = (trade.exit_time || trade.entry_time || trade.created_at);
        if (!dateStr) return;
        const date = dateStr.split("T")[0];

        const existing = map.get(date) || { date, pnl: 0, trades: 0, journals: 0 };
        existing.pnl += trade.pnl_amount ?? 0;
        existing.trades += 1;
        map.set(date, existing);
      });

    // Process journal entries
    journalEntries.forEach((entry) => {
      if (!entry.created_at) return;
      const date = entry.created_at.split("T")[0];
      const existing = map.get(date) || { date, pnl: 0, trades: 0, journals: 0 };
      existing.journals += 1;
      map.set(date, existing);
    });

    return map;
  }, [trades, journalEntries]);

  const weeks = useMemo(() => getWeeksInYear(year), [year]);

  // Find month labels positions
  const monthLabels = useMemo(() => {
    const labels: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0];
      if (firstDayOfWeek.getFullYear() === year) {
        const month = firstDayOfWeek.getMonth();
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], weekIndex });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [weeks, year]);

  const getCellColor = (data: DayData | undefined, isCurrentYear: boolean) => {
    if (!isCurrentYear) return "bg-transparent";
    if (!data || (data.trades === 0 && data.journals === 0)) {
      return "bg-white/[0.04]";
    }
    if (data.trades === 0 && data.journals > 0) {
      return "bg-blue-500/30"; // Journal only — blue tint
    }
    if (data.pnl > 0) {
      // Green gradient based on profit
      if (data.pnl >= 100) return "bg-emerald-400/80";
      if (data.pnl >= 50) return "bg-emerald-400/60";
      if (data.pnl >= 10) return "bg-emerald-500/40";
      return "bg-emerald-500/25";
    }
    if (data.pnl < 0) {
      if (data.pnl <= -100) return "bg-red-400/80";
      if (data.pnl <= -50) return "bg-red-400/60";
      if (data.pnl <= -10) return "bg-red-500/40";
      return "bg-red-500/25";
    }
    // Break-even
    return "bg-amber-500/30";
  };

  return (
    <div className="space-y-3">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums min-w-[3rem] text-center">
            {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear(year + 1)}
            disabled={year >= currentYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-white/[0.04]" />
            <span>Inactive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/40" />
            <span>Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-red-500/40" />
            <span>Loss</span>
          </div>
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <div className="h-2.5 w-2.5 rounded-sm bg-blue-500/30" />
            <span>Journal</span>
          </div>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px]">
          {/* Month labels */}
          <div className="flex ml-8 mb-1.5">
            {monthLabels.map(({ month, weekIndex }) => (
              <span
                key={`${month}-${weekIndex}`}
                className="text-[10px] text-muted-foreground"
                style={{
                  position: "relative",
                  left: `${weekIndex * 14}px`,
                  marginRight: "0",
                }}
              >
                {month}
              </span>
            ))}
          </div>

          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1.5 pt-0.5">
              {DAYS.map((day, i) => (
                <div
                  key={i}
                  className="h-[11px] flex items-center text-[9px] text-muted-foreground leading-none"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((day, dayIndex) => {
                  const dateStr = formatDate(day);
                  const data = dayMap.get(dateStr);
                  const isCurrentYear = day.getFullYear() === year;
                  const isToday = dateStr === formatDate(new Date());



                  const tooltipText = data
                    ? [
                        dateStr,
                        data.trades > 0
                          ? `${data.trades} trade${data.trades > 1 ? "s" : ""} · ${formatCurrency(data.pnl)}`
                          : null,
                        data.journals > 0
                          ? `${data.journals} journal${data.journals > 1 ? "s" : ""}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join("\n")
                    : undefined;

                  return (
                    <div
                      key={dayIndex}
                      title={tooltipText}
                      className={cn(
                        "h-[11px] w-[11px] rounded-[2px] transition-colors cursor-default",
                        getCellColor(data, isCurrentYear),
                        isToday && "ring-1 ring-primary/50",
                        !isCurrentYear && "opacity-0"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
