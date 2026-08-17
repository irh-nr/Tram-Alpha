"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Layers } from "lucide-react";
import { useState } from "react";
import { useStrategies } from "@/hooks/use-strategies";

interface SignalFiltersProps {
  onStatusChange: (status: string | undefined) => void;
  onSymbolChange: (symbol: string | undefined) => void;
  onStrategyChange?: (strategyId: string | undefined) => void;
  activeStatus?: string;
  activeSymbol?: string;
  activeStrategy?: string;
}

const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
];

export function SignalFilters({
  onStatusChange,
  onSymbolChange,
  onStrategyChange,
  activeStatus,
  activeSymbol,
  activeStrategy,
}: SignalFiltersProps) {
  const [symbolSearch, setSymbolSearch] = useState("");
  const { data: strategiesData } = useStrategies();
  const strategies = strategiesData?.strategies ?? [];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <Select
        value={activeStatus || "all"}
        onValueChange={(v) => onStatusChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[140px] bg-muted/30 border-border/50">
          <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="triggered">Triggered</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Strategy Filter */}
      {onStrategyChange && strategies.length > 0 && (
        <Select
          value={activeStrategy || "all"}
          onValueChange={(v) =>
            onStrategyChange(v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="w-[170px] bg-muted/30 border-border/50">
            <Layers className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Strategies</SelectItem>
            {strategies.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Symbol Quick Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant={!activeSymbol ? "default" : "outline"}
          className={`cursor-pointer transition-all text-xs ${
            !activeSymbol
              ? "bg-primary/20 text-primary border-primary/30"
              : "hover:bg-muted/50"
          }`}
          onClick={() => onSymbolChange(undefined)}
        >
          All
        </Badge>
        {POPULAR_SYMBOLS.map((sym) => (
          <Badge
            key={sym}
            variant={activeSymbol === sym ? "default" : "outline"}
            className={`cursor-pointer transition-all text-xs ${
              activeSymbol === sym
                ? "bg-primary/20 text-primary border-primary/30"
                : "hover:bg-muted/50"
            }`}
            onClick={() =>
              onSymbolChange(activeSymbol === sym ? undefined : sym)
            }
          >
            {sym.replace("USDT", "")}
          </Badge>
        ))}
      </div>

      {/* Symbol Search */}
      <div className="relative ml-auto">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search symbol..."
          value={symbolSearch}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setSymbolSearch(val);
            if (val.length >= 3) {
              onSymbolChange(val.includes("USDT") ? val : `${val}USDT`);
            } else if (val.length === 0) {
              onSymbolChange(undefined);
            }
          }}
          className="pl-8 h-9 w-[160px] bg-muted/30 border-border/50 text-sm"
        />
      </div>
    </div>
  );
}
