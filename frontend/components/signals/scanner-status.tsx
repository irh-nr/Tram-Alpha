"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Wifi,
  WifiOff,
  Zap,
  BarChart3,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useScannerStatus } from "@/hooks/use-scanner";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function ScannerStatusBar() {
  const { status, loading } = useScannerStatus(10000);

  if (loading || !status) {
    return (
      <Card className="bg-muted/20 border-border/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
            <span>Connecting to scanner...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isRunning = status.running && status.connected;
  const stats = status.stats;

  return (
    <Card
      className={`border transition-all ${
        isRunning
          ? "border-profit/20 bg-profit/5"
          : "border-warning/20 bg-warning/5"
      }`}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  <div className="relative">
                    <div className="h-2.5 w-2.5 rounded-full bg-profit" />
                    <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-profit animate-ping opacity-50" />
                  </div>
                  <Wifi className="h-4 w-4 text-profit" />
                  <span className="text-sm font-medium text-profit">
                    Scanner Active
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-warning" />
                  <WifiOff className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">
                    {status.message || "Scanner Offline"}
                  </span>
                </>
              )}
            </div>

            {status.strategies != null && status.strategies > 0 && (
              <Badge variant="outline" className="text-xs bg-muted/30">
                <Zap className="h-3 w-3 mr-1" />
                {status.strategies} strategies
              </Badge>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                {stats.candles_processed.toLocaleString()} candles
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-primary" />
                {stats.signals_persisted} signals
              </span>
              {stats.errors > 0 && (
                <span className="flex items-center gap-1 text-loss">
                  <AlertCircle className="h-3 w-3" />
                  {stats.errors} errors
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatUptime(stats.uptime_seconds)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
