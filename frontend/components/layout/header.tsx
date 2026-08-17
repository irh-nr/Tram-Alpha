"use client";

import { Bell, BellOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUIStore } from "@/store/ui.store";
import { useNotifications } from "@/hooks/use-notifications";
import { CurrencyToggle } from "@/components/layout/currency-toggle";
import { cn } from "@/lib/utils";

export function Header() {
  const { sidebarOpen } = useUIStore();
  const { enabled, permission, loading, supported, toggle } = useNotifications();

  // Compute tooltip text
  const tooltipText = !supported
    ? "Notifications not supported"
    : permission === "denied"
    ? "Notifications blocked by browser"
    : enabled
    ? "Notifications active — click to disable"
    : "Enable signal notifications";

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-6 transition-all duration-300",
        sidebarOpen ? "md:left-64 left-[68px]" : "left-[68px]"
      )}
    >
      {/* Search — hidden on mobile */}
      <div className="relative w-full max-w-sm hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search signals, trades, pairs..."
          className="pl-9 bg-accent/50 border-transparent focus:border-primary/30 h-9 text-sm"
        />
      </div>
      <div className="sm:hidden" /> {/* Spacer on mobile */}

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Currency toggle */}
        <CurrencyToggle />

        {/* Live indicator — hidden on xs */}
        <div className="hidden xs:flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1.5 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-muted-foreground">Live</span>
        </div>

        {/* Notifications toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 transition-colors",
            enabled
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={toggle}
          disabled={loading || !supported || permission === "denied"}
          title={tooltipText}
        >
          {enabled ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}

          {/* Active indicator dot */}
          {enabled && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-60"></span>
              <span className="relative inline-flex h-3 w-3 items-center justify-center rounded-full bg-profit"></span>
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
