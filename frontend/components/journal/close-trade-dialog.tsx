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
import { Loader2, X as CloseIcon, DollarSign } from "lucide-react";
import type { Trade, TradeUpdate } from "@/types/trade";
import { useCurrency } from "@/hooks/use-currency";

interface CloseTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null;
  onSubmit: (tradeId: string, update: TradeUpdate) => Promise<void>;
  loading?: boolean;
}

export function CloseTradeDialog({
  open,
  onOpenChange,
  trade,
  onSubmit,
  loading,
}: CloseTradeDialogProps) {
  const [exitPrice, setExitPrice] = useState("");
  const [fees, setFees] = useState("");
  const { symbol: currencySymbol } = useCurrency();

  if (!trade) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const exit = parseFloat(exitPrice);
    const feeAmount = fees ? parseFloat(fees) : 0;

    // Calculate PnL
    let pnlAmount: number;
    if (trade.direction === "long") {
      pnlAmount = (exit - trade.entry_price) * trade.position_size - feeAmount;
    } else {
      pnlAmount = (trade.entry_price - exit) * trade.position_size - feeAmount;
    }

    const pnlPercent =
      trade.entry_price > 0
        ? ((trade.direction === "long"
            ? exit - trade.entry_price
            : trade.entry_price - exit) /
            trade.entry_price) *
          100 *
          trade.leverage
        : 0;

    const update: TradeUpdate = {
      exit_price: exit,
      status: "closed",
      pnl_amount: parseFloat(pnlAmount.toFixed(2)),
      pnl_percent: parseFloat(pnlPercent.toFixed(2)),
      fees: feeAmount,
    };

    await onSubmit(trade.id, update);
    setExitPrice("");
    setFees("");
  };

  const previewPnl = exitPrice
    ? trade.direction === "long"
      ? (parseFloat(exitPrice) - trade.entry_price) * trade.position_size
      : (trade.entry_price - parseFloat(exitPrice)) * trade.position_size
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloseIcon className="h-5 w-5 text-primary" />
            Close Trade
          </DialogTitle>
        </DialogHeader>

        {/* Trade Info */}
        <div className="rounded-lg bg-muted/30 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{trade.symbol}</span>
            <span
              className={`text-xs font-bold uppercase ${
                trade.direction === "long" ? "text-profit" : "text-loss"
              }`}
            >
              {trade.direction}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Entry: {trade.entry_price}</span>
            <span>Size: {trade.position_size}</span>
            <span>{trade.leverage}x</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exitPrice">Exit Price</Label>
            <Input
              id="exitPrice"
              type="number"
              step="any"
              placeholder="0.00"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              required
              className="bg-muted/30 font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fees">Fees (optional)</Label>
            <Input
              id="fees"
              type="number"
              step="any"
              placeholder="0.00"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              className="bg-muted/30 font-mono"
            />
          </div>

          {/* PnL Preview */}
          {previewPnl !== null && (
            <div
              className={`flex items-center justify-between rounded-lg p-3 ${
                previewPnl >= 0
                  ? "bg-profit/10 border border-profit/20"
                  : "bg-loss/10 border border-loss/20"
              }`}
            >
              <span className="text-sm flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                Estimated PnL
              </span>
              <span
                className={`font-mono font-bold ${
                  previewPnl >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {previewPnl >= 0 ? "+" : ""}{currencySymbol}{Math.abs(previewPnl).toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !exitPrice}
              variant="destructive"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CloseIcon className="h-4 w-4 mr-2" />
              )}
              Close Trade
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
