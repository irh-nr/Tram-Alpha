"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Loader2,
  Zap,
} from "lucide-react";
import type { TradeCreate } from "@/types/trade";
import type { Signal } from "@/types/signal";

interface TradeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (trade: TradeCreate) => Promise<void>;
  loading?: boolean;
  /** Pre-populate from a signal */
  signal?: Signal | null;
}

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

export function TradeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  signal,
}: TradeFormDialogProps) {
  const [symbol, setSymbol] = useState(signal?.symbol || "");
  const [direction, setDirection] = useState<"long" | "short">(
    signal?.direction || "long"
  );
  const [entryPrice, setEntryPrice] = useState(
    signal?.entry_price?.toString() || ""
  );
  const [positionSize, setPositionSize] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [timeframe, setTimeframe] = useState(signal?.timeframe || "");
  const [strategyName, setStrategyName] = useState(
    signal?.strategy_name || ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trade: TradeCreate = {
      symbol: symbol.toUpperCase(),
      direction,
      entry_price: parseFloat(entryPrice),
      position_size: positionSize ? parseFloat(positionSize) : 0,
      leverage: leverage ? parseFloat(leverage) : 1,
      timeframe: timeframe || undefined,
      strategy_name: strategyName || undefined,
      signal_id: signal?.id || undefined,
    };

    await onSubmit(trade);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {signal ? "Trade from Signal" : "New Trade"}
          </DialogTitle>
        </DialogHeader>

        {/* Signal reference */}
        {signal && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">
              From signal:{" "}
              <span className="font-semibold">{signal.symbol}</span>{" "}
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  signal.direction === "long"
                    ? "text-profit border-profit/30"
                    : "text-loss border-loss/30"
                }`}
              >
                {signal.direction.toUpperCase()}
              </Badge>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol + Direction Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="BTCUSDT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={direction === "long" ? "default" : "outline"}
                  className={`h-9 ${
                    direction === "long"
                      ? "bg-profit/20 text-profit border-profit/30 hover:bg-profit/30"
                      : ""
                  }`}
                  onClick={() => setDirection("long")}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  Long
                </Button>
                <Button
                  type="button"
                  variant={direction === "short" ? "default" : "outline"}
                  className={`h-9 ${
                    direction === "short"
                      ? "bg-loss/20 text-loss border-loss/30 hover:bg-loss/30"
                      : ""
                  }`}
                  onClick={() => setDirection("short")}
                >
                  <ArrowDownRight className="h-3.5 w-3.5 mr-1" />
                  Short
                </Button>
              </div>
            </div>
          </div>

          {/* Entry Price + Position Size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price</Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                placeholder="0.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                required
                className="bg-muted/30 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionSize">Position Size</Label>
              <Input
                id="positionSize"
                type="number"
                step="any"
                placeholder="0.00"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                className="bg-muted/30 font-mono"
              />
            </div>
          </div>

          {/* Leverage + Timeframe */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="leverage">Leverage</Label>
              <Input
                id="leverage"
                type="number"
                step="1"
                min="1"
                placeholder="1"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                className="bg-muted/30 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v ?? "")}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf} value={tf}>
                      {tf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Strategy Name */}
          <div className="space-y-2">
            <Label htmlFor="strategyName">Strategy (optional)</Label>
            <Input
              id="strategyName"
              placeholder="e.g. EMA Crossover"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              className="bg-muted/30"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !symbol || !entryPrice}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Trade
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
