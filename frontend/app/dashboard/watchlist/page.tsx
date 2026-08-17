"use client";

import { Eye } from "lucide-react";
import { WatchlistPanel } from "@/components/watchlist/watchlist-panel";

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" />
          Watchlist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the trading pairs monitored by the scanner engine
        </p>
      </div>

      {/* Watchlist Panel — max width for clean layout */}
      <div className="max-w-lg">
        <WatchlistPanel />
      </div>
    </div>
  );
}
