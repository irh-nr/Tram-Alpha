"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Shield,
  TrendingUp,
  Clock,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalCard } from "@/components/signals/signal-card";
import { SignalFilters } from "@/components/signals/signal-filters";
import { ScannerStatusBar } from "@/components/signals/scanner-status";
import { useSignals, useRealtimeSignals } from "@/hooks/use-signals";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Signal } from "@/types/signal";
import { useCurrency } from "@/hooks/use-currency";
import { api } from "@/lib/api";

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



function SignalTableRow({ signal }: { signal: Signal }) {
  const { formatPrice } = useCurrency();
  const isLong = signal.direction === "long";
  const rr = signal.risk_reward ?? 0;

  return (
    <TableRow className="group hover:bg-muted/30 transition-colors">
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
              isLong
                ? "bg-profit/10 text-profit border-profit/20"
                : "bg-loss/10 text-loss border-loss/20"
            }`}
          >
            {isLong ? (
              <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
            )}
            {signal.direction}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <span className="font-bold">{signal.symbol}</span>
        <span className="text-muted-foreground text-xs ml-1.5">
          {signal.timeframe}
        </span>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {formatPrice(signal.entry_price)}
      </TableCell>
      <TableCell className="font-mono text-sm text-loss">
        {formatPrice(signal.stop_loss)}
      </TableCell>
      <TableCell className="font-mono text-sm text-profit">
        {formatPrice(signal.take_profit)}
      </TableCell>
      <TableCell>
        <span className={rr >= 2 ? "text-profit font-semibold" : ""}>
          {rr.toFixed(1)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 rounded-full ${
              signal.confidence >= 70
                ? "bg-profit"
                : signal.confidence >= 50
                ? "bg-warning"
                : "bg-loss"
            }`}
            style={{ width: `${signal.confidence * 0.5}px` }}
          />
          <span className="text-xs">{Math.round(signal.confidence)}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            signal.status === "active"
              ? "bg-primary/10 text-primary border-primary/20"
              : signal.status === "triggered"
              ? "bg-profit/10 text-profit border-profit/20"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {signal.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {signal.strategy_name || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {timeAgo(signal.detected_at)}
      </TableCell>
    </TableRow>
  );
}

function SignalSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignalsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [symbolFilter, setSymbolFilter] = useState<string | undefined>();
  const [strategyFilter, setStrategyFilter] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const {
    signals: fetchedSignals,
    loading,
    error,
    total,
    refetch,
  } = useSignals({
    status: statusFilter,
    symbol: symbolFilter,
    strategy_id: strategyFilter,
    limit: 50,
  });

  // Layer realtime updates on top of fetched signals
  const { signals, isConnected } = useRealtimeSignals(fetchedSignals);

  const activeCount = signals.filter((s) => s.status === "active").length;
  const longCount = signals.filter(
    (s) => s.direction === "long" && s.status === "active"
  ).length;
  const shortCount = signals.filter(
    (s) => s.direction === "short" && s.status === "active"
  ).length;
  const avgConfidence =
    signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0;

  const handleCleanup = async (days: number) => {
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const result = await api.delete<{ deleted_count: number }>(
        `/signals?older_than_days=${days}`
      );
      setCleanupResult(`Cleaned up ${result.deleted_count} signal(s) older than ${days} days`);
      setShowCleanupConfirm(false);
      refetch();
    } catch (err: any) {
      setCleanupResult(`Error: ${err.message}`);
    } finally {
      setCleanupLoading(false);
      setTimeout(() => setCleanupResult(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Signals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time trading signals detected by the scanner engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime indicator */}
          <Badge
            variant="outline"
            className={`text-xs ${
              isConnected
                ? "bg-profit/10 text-profit border-profit/20"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Radio
              className={`h-3 w-3 mr-1 ${
                isConnected ? "animate-pulse" : ""
              }`}
            />
            {isConnected ? "Live" : "Connecting..."}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
            className="h-8"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>

          {/* Cleanup Button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCleanupConfirm(!showCleanupConfirm)}
              className="h-8 text-muted-foreground hover:text-loss"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Cleanup
            </Button>

            {showCleanupConfirm && (
              <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-border/50 bg-popover p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-muted-foreground mb-2.5">Delete signals older than:</p>
                <div className="flex flex-col gap-1.5">
                  {[3, 7, 14, 30].map((days) => (
                    <Button
                      key={days}
                      variant="ghost"
                      size="sm"
                      className="justify-start h-8 text-xs hover:text-loss hover:bg-loss/10"
                      disabled={cleanupLoading}
                      onClick={() => handleCleanup(days)}
                    >
                      {cleanupLoading ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-2" />
                      )}
                      {days} days
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={() => setShowCleanupConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cleanup Result Banner */}
      {cleanupResult && (
        <div className={`rounded-lg px-4 py-2.5 text-sm animate-in fade-in duration-200 ${
          cleanupResult.startsWith("Error")
            ? "bg-loss/10 border border-loss/20 text-loss"
            : "bg-profit/10 border border-profit/20 text-profit"
        }`}>
          {cleanupResult}
        </div>
      )}

      {/* Scanner Status */}
      <ScannerStatusBar />

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total
              </p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <Zap className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Active
              </p>
              <p className="text-2xl font-bold text-primary">{activeCount}</p>
            </div>
            <Target className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Long / Short
              </p>
              <p className="text-2xl font-bold">
                <span className="text-profit">{longCount}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-loss">{shortCount}</span>
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-profit opacity-60" />
              <ArrowDownRight className="h-3.5 w-3.5 text-loss opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Avg Confidence
              </p>
              <p className="text-2xl font-bold">
                {avgConfidence > 0 ? `${Math.round(avgConfidence)}%` : "—"}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <SignalFilters
          onStatusChange={setStatusFilter}
          onSymbolChange={setSymbolFilter}
          onStrategyChange={setStrategyFilter}
          activeStatus={statusFilter}
          activeSymbol={symbolFilter}
          activeStrategy={strategyFilter}
        />
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "cards" | "table")}
        >
          <TabsList className="h-8">
            <TabsTrigger value="cards" className="text-xs px-2.5 h-6">
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="table" className="text-xs px-2.5 h-6">
              <TableIcon className="h-3.5 w-3.5 mr-1" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-loss/30 bg-loss/5">
          <CardContent className="py-4 px-5 text-sm text-loss">
            Failed to load signals: {error}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SignalSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && signals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No Signals Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
              {statusFilter || symbolFilter
                ? "No signals match your current filters. Try adjusting your criteria."
                : "Start the scanner worker to begin detecting trading signals from the crypto markets."}
            </p>
            {!statusFilter && !symbolFilter && (
              <div className="mt-4 bg-muted/30 rounded-lg p-3 text-xs font-mono text-muted-foreground">
                python -m app.workers.scanner_worker
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signals — Card View */}
      {!loading && signals.length > 0 && viewMode === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* Signals — Table View */}
      {!loading && signals.length > 0 && viewMode === "table" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Direction</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Stop Loss</TableHead>
                <TableHead>Take Profit</TableHead>
                <TableHead className="w-[60px]">R:R</TableHead>
                <TableHead className="w-[100px]">Confidence</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="w-[80px]">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.map((signal) => (
                <SignalTableRow key={signal.id} signal={signal} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
