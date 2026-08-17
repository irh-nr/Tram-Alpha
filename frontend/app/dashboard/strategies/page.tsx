"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Layers,
  TrendingUp,
  Activity,
  BarChart3,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useStrategies, useStrategyActions } from "@/hooks/use-strategies";
import type { Strategy } from "@/types/strategy";

/** Map strategy names to thematic icons + colors */
const STRATEGY_THEME: Record<
  string,
  { icon: typeof TrendingUp; color: string; gradient: string }
> = {
  "EMA Crossover": {
    icon: TrendingUp,
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  "RSI Divergence": {
    icon: Activity,
    color: "text-violet-400",
    gradient: "from-violet-500/20 to-violet-500/5",
  },
  "Volume Breakout": {
    icon: BarChart3,
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
};

const DEFAULT_THEME = {
  icon: Zap,
  color: "text-primary",
  gradient: "from-primary/20 to-primary/5",
};

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const [expanded, setExpanded] = useState(false);
  const { subscribe, unsubscribe } = useStrategyActions();
  const isMutating = subscribe.isPending || unsubscribe.isPending;

  const theme = STRATEGY_THEME[strategy.name] || DEFAULT_THEME;
  const Icon = theme.icon;
  const params = strategy.default_parameters || {};
  const paramEntries = Object.entries(params);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe.mutateAsync(strategy.id);
    } else {
      await unsubscribe.mutateAsync(strategy.id);
    }
  };

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 ${
        strategy.user_enabled
          ? "border-primary/30 shadow-sm shadow-primary/5"
          : "border-border/50"
      }`}
    >
      {/* Gradient accent */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
      />

      {/* Active indicator bar */}
      {strategy.user_enabled && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}

      <CardContent className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                strategy.user_enabled ? "bg-primary/15" : "bg-muted/50"
              } transition-colors duration-300`}
            >
              <Icon
                className={`h-5.5 w-5.5 ${
                  strategy.user_enabled ? theme.color : "text-muted-foreground"
                } transition-colors duration-300`}
              />
            </div>
            <div>
              <h3 className="font-semibold text-base">{strategy.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 bg-muted/30 border-border/50"
                >
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {strategy.timeframe}
                </Badge>
                {strategy.user_enabled && (
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-profit/15 text-profit border-profit/20">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMutating && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={strategy.user_enabled}
              onCheckedChange={handleToggle}
              disabled={isMutating}
              aria-label={`Toggle ${strategy.name}`}
            />
          </div>
        </div>

        {/* Description */}
        {strategy.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {strategy.description}
          </p>
        )}

        {/* Parameters Section */}
        {paramEntries.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span className="font-medium">
                {paramEntries.length} Parameters
              </span>
            </button>

            {expanded && (
              <div className="mt-3 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                {paramEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-muted/30 rounded-lg px-3 py-2 border border-border/30"
                  >
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm font-mono font-medium mt-0.5">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StrategySkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

export default function StrategiesPage() {
  const { data, isLoading, error } = useStrategies();
  const strategies = data?.strategies ?? [];
  const enabledCount = strategies.filter((s) => s.user_enabled).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Strategies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and configure your trading strategies
          </p>
        </div>

        {!isLoading && strategies.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 text-primary border-primary/20"
            >
              <Zap className="h-3 w-3 mr-1" />
              {enabledCount} / {strategies.length} Active
            </Badge>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {!isLoading && strategies.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total Strategies
                </p>
                <p className="text-2xl font-bold">{strategies.length}</p>
              </div>
              <Layers className="h-5 w-5 text-primary opacity-50" />
            </CardContent>
          </Card>
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Enabled
                </p>
                <p className="text-2xl font-bold text-profit">{enabledCount}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-profit opacity-50" />
            </CardContent>
          </Card>
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Disabled
                </p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {strategies.length - enabledCount}
                </p>
              </div>
              <XCircle className="h-5 w-5 text-muted-foreground opacity-50" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-loss/30 bg-loss/5">
          <CardContent className="py-4 px-5 text-sm text-loss">
            Failed to load strategies:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StrategySkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && strategies.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No Strategies Available</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
              There are no active strategies configured in the system. Strategies
              are seeded in the database and discovered automatically by the
              scanner worker.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Strategy Cards */}
      {!isLoading && strategies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      )}
    </div>
  );
}
