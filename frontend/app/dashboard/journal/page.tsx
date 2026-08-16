"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  FileText,
  DollarSign,
  Target,
  TrendingUp,
  Clock,
  X as CloseIcon,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { useTrades, useTradeActions } from "@/hooks/use-trades";
import { useJournal, useJournalActions } from "@/hooks/use-journal";
import { TradeFormDialog } from "@/components/journal/trade-form-dialog";
import { JournalFormDialog } from "@/components/journal/journal-form-dialog";
import { JournalCard } from "@/components/journal/journal-card";
import { CloseTradeDialog } from "@/components/journal/close-trade-dialog";
import type { Trade, TradeCreate, TradeUpdate } from "@/types/trade";
import type { JournalCreate, EmotionalState } from "@/types/journal";
import { EMOTIONAL_STATES } from "@/types/journal";
import { useCurrency } from "@/hooks/use-currency";

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}



export default function JournalPage() {
  const { formatPrice, formatAmount, symbol: currencySymbol } = useCurrency();
  // Tab state
  const [activeTab, setActiveTab] = useState<"trades" | "journal">("trades");
  const [tradeViewMode, setTradeViewMode] = useState<"cards" | "table">(
    "table"
  );

  // Filters
  const [tradeStatusFilter, setTradeStatusFilter] = useState<string>();
  const [emotionFilter, setEmotionFilter] = useState<string>();

  // Dialog state
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [closeTradeTarget, setCloseTradeTarget] = useState<Trade | null>(null);

  // Data
  const {
    trades,
    loading: tradesLoading,
    total: tradesTotal,
    refetch: refetchTrades,
  } = useTrades({ status: tradeStatusFilter });

  const {
    entries: journalEntries,
    loading: journalLoading,
    total: journalTotal,
    refetch: refetchJournal,
  } = useJournal({ emotionalState: emotionFilter });

  // Actions
  const {
    createTrade,
    updateTrade,
    deleteTrade,
    loading: tradeActionLoading,
  } = useTradeActions();
  const {
    createEntry,
    deleteEntry,
    loading: journalActionLoading,
  } = useJournalActions();

  // Derived stats
  const closedTrades = trades.filter((t) => t.status === "closed");
  const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl_amount, 0);
  const winCount = closedTrades.filter((t) => t.pnl_amount > 0).length;
  const winRate =
    closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;
  const openCount = trades.filter((t) => t.status === "open").length;

  // Handlers
  const handleCreateTrade = async (trade: TradeCreate) => {
    const result = await createTrade(trade);
    if (result) {
      setShowTradeForm(false);
      refetchTrades();
    }
  };

  const handleCloseTrade = async (tradeId: string, update: TradeUpdate) => {
    const result = await updateTrade(tradeId, update);
    if (result) {
      setCloseTradeTarget(null);
      refetchTrades();
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    const success = await deleteTrade(tradeId);
    if (success) refetchTrades();
  };

  const handleCreateJournalEntry = async (entry: JournalCreate) => {
    const result = await createEntry(entry);
    if (result) {
      setShowJournalForm(false);
      refetchJournal();
    }
  };

  const handleDeleteJournalEntry = async (entryId: string) => {
    const success = await deleteEntry(entryId);
    if (success) refetchJournal();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Trading Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track, journal, and analyze your trades
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setShowJournalForm(true)}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            New Entry
          </Button>
          <Button size="sm" className="h-8" onClick={() => setShowTradeForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Trade
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total PnL
              </p>
              <p
                className={`text-2xl font-bold font-mono ${
                  totalPnl >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {formatAmount(totalPnl)}
              </p>
            </div>
            <DollarSign className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Win Rate
              </p>
              <p className="text-2xl font-bold">
                {winRate > 0 ? `${winRate.toFixed(1)}%` : "—"}
              </p>
            </div>
            <Target className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Trades
              </p>
              <p className="text-2xl font-bold">
                <span>{tradesTotal}</span>
                {openCount > 0 && (
                  <span className="text-sm text-primary ml-1.5">
                    ({openCount} open)
                  </span>
                )}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card className="bg-muted/20 border-border/30">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Journal Entries
              </p>
              <p className="text-2xl font-bold">{journalTotal}</p>
            </div>
            <BookOpen className="h-5 w-5 text-primary opacity-50" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "trades" | "journal")}
        >
          <TabsList>
            <TabsTrigger value="trades" className="text-sm">
              <Wallet className="h-4 w-4 mr-1.5" />
              Trades
              {tradesTotal > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">
                  {tradesTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="journal" className="text-sm">
              <FileText className="h-4 w-4 mr-1.5" />
              Journal
              {journalTotal > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">
                  {journalTotal}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters & View Controls */}
        <div className="flex items-center gap-2">
          {activeTab === "trades" && (
            <>
              <Select
                value={tradeStatusFilter || "all"}
                onValueChange={(v) =>
                  setTradeStatusFilter(!v || v === "all" ? undefined : v)
                }
              >
                <SelectTrigger className="w-[120px] h-8 text-xs bg-muted/30">
                  <SlidersHorizontal className="h-3 w-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Tabs
                value={tradeViewMode}
                onValueChange={(v) =>
                  setTradeViewMode(v as "cards" | "table")
                }
              >
                <TabsList className="h-8">
                  <TabsTrigger value="table" className="text-xs px-2.5 h-6">
                    <TableIcon className="h-3.5 w-3.5 mr-1" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="cards" className="text-xs px-2.5 h-6">
                    <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                    Cards
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          )}

          {activeTab === "journal" && (
            <Select
              value={emotionFilter || "all"}
              onValueChange={(v) =>
                setEmotionFilter(!v || v === "all" ? undefined : v)
              }
            >
              <SelectTrigger className="w-[150px] h-8 text-xs bg-muted/30">
                <SlidersHorizontal className="h-3 w-3 mr-1.5" />
                <SelectValue placeholder="Emotion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Emotions</SelectItem>
                {EMOTIONAL_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.emoji} {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ═══════════════════ TRADES TAB ═══════════════════ */}
      {activeTab === "trades" && (
        <>
          {/* Loading */}
          {tradesLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!tradesLoading && trades.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <Wallet className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No Trades Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
                  Start adding trades to track your performance and build your
                  trading journal.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowTradeForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Trade
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Table View */}
          {!tradesLoading && trades.length > 0 && tradeViewMode === "table" && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Direction</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[80px]">Time</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow
                      key={trade.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            trade.direction === "long"
                              ? "text-profit border-profit/20 bg-profit/10"
                              : "text-loss border-loss/20 bg-loss/10"
                          }`}
                        >
                          {trade.direction === "long" ? (
                            <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {trade.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        {trade.symbol}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPrice(trade.entry_price)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {trade.exit_price
                          ? formatPrice(trade.exit_price)
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {trade.position_size > 0
                          ? trade.position_size
                          : "—"}
                        {trade.leverage > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {trade.leverage}x
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {trade.status === "closed" ? (
                          <span
                            className={`font-mono font-semibold text-sm ${
                              trade.pnl_amount >= 0
                                ? "text-profit"
                                : "text-loss"
                            }`}
                          >
                            {formatAmount(trade.pnl_amount)}
                            <span className="text-xs ml-1 opacity-70">
                              ({trade.pnl_percent >= 0 ? "+" : ""}
                              {trade.pnl_percent.toFixed(1)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            trade.status === "open"
                              ? "text-primary border-primary/20 bg-primary/10"
                              : trade.status === "closed"
                              ? "text-muted-foreground"
                              : "text-warning"
                          }`}
                        >
                          {trade.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {timeAgo(trade.entry_time || trade.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {trade.status === "open" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setCloseTradeTarget(trade)}
                            >
                              <CloseIcon className="h-3 w-3 mr-1" />
                              Close
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-loss"
                            onClick={() => handleDeleteTrade(trade.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Cards View */}
          {!tradesLoading && trades.length > 0 && tradeViewMode === "cards" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trades.map((trade) => (
                <Card
                  key={trade.id}
                  className="group relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      trade.direction === "long" ? "bg-profit" : "bg-loss"
                    }`}
                  />
                  <CardContent className="p-4 pl-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            trade.direction === "long"
                              ? "text-profit border-profit/20 bg-profit/10"
                              : "text-loss border-loss/20 bg-loss/10"
                          }`}
                        >
                          {trade.direction === "long" ? (
                            <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {trade.direction}
                        </Badge>
                        <span className="font-bold">{trade.symbol}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          trade.status === "open"
                            ? "text-primary border-primary/20"
                            : ""
                        }`}
                      >
                        {trade.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="bg-muted/30 rounded p-2 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase">
                          Entry
                        </div>
                        <div className="font-mono font-semibold">
                          {formatPrice(trade.entry_price)}
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded p-2 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {trade.exit_price ? "Exit" : "PnL"}
                        </div>
                        <div className="font-mono font-semibold">
                          {trade.exit_price
                            ? formatPrice(trade.exit_price)
                            : trade.status === "closed"
                            ? formatAmount(trade.pnl_amount)
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      {trade.status === "closed" && (
                        <span
                          className={`font-semibold ${
                            trade.pnl_amount >= 0 ? "text-profit" : "text-loss"
                          }`}
                        >
                          {formatAmount(trade.pnl_amount)} (
                          {trade.pnl_percent >= 0 ? "+" : ""}
                          {trade.pnl_percent.toFixed(1)}%)
                        </span>
                      )}
                      {trade.status === "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => setCloseTradeTarget(trade)}
                        >
                          Close Trade
                        </Button>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        {timeAgo(trade.entry_time || trade.created_at)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ JOURNAL TAB ═══════════════════ */}
      {activeTab === "journal" && (
        <>
          {/* Loading */}
          {journalLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty */}
          {!journalLoading && journalEntries.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No Journal Entries Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
                  Start journaling your trades to identify patterns, mistakes,
                  and improve your trading psychology.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowJournalForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Write First Entry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Journal Entries Grid */}
          {!journalLoading && journalEntries.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {journalEntries.map((entry) => (
                <JournalCard
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDeleteJournalEntry}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ DIALOGS ═══════════════════ */}
      <TradeFormDialog
        open={showTradeForm}
        onOpenChange={setShowTradeForm}
        onSubmit={handleCreateTrade}
        loading={tradeActionLoading}
      />

      <JournalFormDialog
        open={showJournalForm}
        onOpenChange={setShowJournalForm}
        onSubmit={handleCreateJournalEntry}
        loading={journalActionLoading}
        trades={trades}
      />

      <CloseTradeDialog
        open={!!closeTradeTarget}
        onOpenChange={(open) => !open && setCloseTradeTarget(null)}
        trade={closeTradeTarget}
        onSubmit={handleCloseTrade}
        loading={tradeActionLoading}
      />
    </div>
  );
}
