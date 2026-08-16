"use client";

import { useEffect } from "react";
import { useCurrencyStore } from "@/store/currency.store";
import { cn } from "@/lib/utils";

/**
 * Compact currency toggle for the header.
 * Switches between USD and IDR display.
 */
export function CurrencyToggle() {
  const { currency, toggleCurrency, rateLoading, usdToIdr, fetchRate, lastFetched } =
    useCurrencyStore();

  // Fetch rate on mount if stale
  useEffect(() => {
    const stale = !lastFetched || Date.now() - lastFetched > 30 * 60 * 1000;
    if (stale) fetchRate();
  }, [lastFetched, fetchRate]);

  return (
    <button
      onClick={toggleCurrency}
      className={cn(
        "relative flex items-center h-8 rounded-lg border transition-all duration-300",
        "text-xs font-semibold select-none cursor-pointer",
        "border-border/50 bg-muted/30 hover:bg-muted/50",
        rateLoading && "opacity-70"
      )}
      title={
        currency === "IDR"
          ? `Rate: 1 USD = ${usdToIdr.toLocaleString("id-ID")} IDR`
          : "Click to switch to IDR"
      }
    >
      {/* USD pill */}
      <span
        className={cn(
          "relative z-10 px-2.5 py-1.5 rounded-md transition-all duration-300",
          currency === "USD"
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        USD
      </span>

      {/* IDR pill */}
      <span
        className={cn(
          "relative z-10 px-2.5 py-1.5 rounded-md transition-all duration-300",
          currency === "IDR"
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        IDR
      </span>

      {/* Sliding highlight */}
      <span
        className={cn(
          "absolute top-0.5 bottom-0.5 rounded-md bg-primary/15 border border-primary/20 transition-all duration-300 ease-out",
          currency === "USD"
            ? "left-0.5 w-[calc(50%-2px)]"
            : "left-[calc(50%+2px)] w-[calc(50%-4px)]"
        )}
      />
    </button>
  );
}
