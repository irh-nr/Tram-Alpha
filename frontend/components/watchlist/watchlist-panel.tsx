"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  X,
  Search,
  Eye,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useWatchlist } from "@/hooks/use-watchlist";
import { cn } from "@/lib/utils";

// Popular coins for quick-add suggestions
const POPULAR_COINS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "ARBUSDT",
  "OPUSDT",
  "ATOMUSDT",
  "NEARUSDT",
];

/**
 * Watchlist Management Panel
 *
 * Displays actively monitored trading pairs with add/remove controls,
 * search filtering, quick-add suggestions, and proper loading/empty states.
 */
export function WatchlistPanel() {
  const {
    watchlist,
    loading,
    error,
    actionLoading,
    addCoin,
    removeCoin,
    refetch,
    clearError,
  } = useWatchlist();

  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const existingSymbols = new Set(watchlist.map((w) => w.symbol));

  // Filter suggestions based on search input, excluding existing
  const filteredSuggestions = POPULAR_COINS.filter(
    (coin) =>
      !existingSymbols.has(coin) &&
      coin.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleAdd = async (symbol?: string) => {
    const coin = symbol || searchValue;
    if (!coin.trim()) return;

    await addCoin(coin);
    setSearchValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Signal Watchlist
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {watchlist.length} pair{watchlist.length !== 1 ? "s" : ""}{" "}
                monitored
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-loss/10 border border-loss/20 px-3 py-2 text-xs text-loss">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Search / Add input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Add pair (e.g. BTCUSDT)..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value.toUpperCase());
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-20 h-9 text-sm bg-accent/30 border-transparent focus:border-primary/30"
          />
          <Button
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-3 text-xs"
            onClick={() => handleAdd()}
            disabled={!searchValue.trim() || actionLoading}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>

          {/* Suggestions dropdown */}
          {showSuggestions && searchValue && filteredSuggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border/50 bg-popover shadow-xl max-h-48 overflow-y-auto"
            >
              {filteredSuggestions.slice(0, 8).map((coin) => (
                <button
                  key={coin}
                  onClick={() => handleAdd(coin)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{coin}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Empty state ──────────────────────────────────────── */}
        {watchlist.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">No pairs in watchlist</h3>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-[220px]">
              Add trading pairs above to start monitoring signals from the
              scanner engine.
            </p>

            {/* Quick-add popular coins */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {POPULAR_COINS.slice(0, 6).map((coin) => (
                <Button
                  key={coin}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => handleAdd(coin)}
                  disabled={actionLoading}
                >
                  <Plus className="h-2.5 w-2.5 mr-1" />
                  {coin.replace("USDT", "")}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ── Coin list ────────────────────────────────────────── */}
        {watchlist.length > 0 && (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {watchlist.map((item, index) => (
              <div
                key={item.symbol}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-3 py-2.5",
                  "bg-accent/20 hover:bg-accent/40 transition-all duration-200",
                  "animate-in fade-in slide-in-from-bottom-1"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-center gap-3">
                  {/* Coin avatar */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {item.symbol.replace("USDT", "").slice(0, 3)}
                  </div>
                  <div>
                    <span className="text-sm font-semibold tracking-tight">
                      {item.symbol.replace("USDT", "")}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      /USDT
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-profit/10 text-profit border-profit/20 opacity-70"
                  >
                    Active
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-loss hover:bg-loss/10"
                    onClick={() => removeCoin(item.symbol)}
                    disabled={actionLoading}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer stats */}
        {watchlist.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <span className="text-[11px] text-muted-foreground">
              Scanning across 2 timeframes (1h, 4h)
            </span>
            <span className="text-[11px] text-muted-foreground">
              {watchlist.length * 2} streams
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
