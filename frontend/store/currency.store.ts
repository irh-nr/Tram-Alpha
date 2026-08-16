import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = "USD" | "IDR";

interface CurrencyState {
  currency: Currency;
  usdToIdr: number;
  rateLoading: boolean;
  lastFetched: number | null;

  // Actions
  setCurrency: (currency: Currency) => void;
  toggleCurrency: () => void;
  fetchRate: () => Promise<void>;
  convert: (usdValue: number) => number;
}

// Fallback rate if API fails (approximate)
const FALLBACK_USD_IDR = 16_500;

// Cache duration: 30 minutes
const RATE_CACHE_MS = 30 * 60 * 1000;

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: "USD",
      usdToIdr: FALLBACK_USD_IDR,
      rateLoading: false,
      lastFetched: null,

      setCurrency: (currency) => {
        set({ currency });
        // Fetch rate if switching to IDR and rate is stale
        if (currency === "IDR") {
          const { lastFetched, fetchRate } = get();
          if (!lastFetched || Date.now() - lastFetched > RATE_CACHE_MS) {
            fetchRate();
          }
        }
      },

      toggleCurrency: () => {
        const next = get().currency === "USD" ? "IDR" : "USD";
        get().setCurrency(next);
      },

      fetchRate: async () => {
        set({ rateLoading: true });
        try {
          // Use free exchangerate API
          const res = await fetch(
            "https://api.exchangerate-api.com/v4/latest/USD"
          );
          if (!res.ok) throw new Error("Rate API failed");
          const data = await res.json();
          const rate = data.rates?.IDR;
          if (rate && typeof rate === "number") {
            set({ usdToIdr: rate, lastFetched: Date.now() });
          }
        } catch (err) {
          console.warn("Failed to fetch USD/IDR rate, using fallback:", err);
          // Keep existing rate (could be cached from previous fetch)
        } finally {
          set({ rateLoading: false });
        }
      },

      convert: (usdValue: number) => {
        const { currency, usdToIdr } = get();
        if (currency === "USD") return usdValue;
        return usdValue * usdToIdr;
      },
    }),
    {
      name: "tram-currency",
      partialize: (state) => ({
        currency: state.currency,
        usdToIdr: state.usdToIdr,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

/**
 * Format a crypto price with appropriate decimal places, currency-aware.
 */
export function formatPriceWithCurrency(
  price: number,
  currency: Currency,
  usdToIdr: number
): string {
  if (currency === "IDR") {
    const idr = price * usdToIdr;
    // IDR doesn't use decimals for large values
    if (idr >= 1_000_000_000) return `Rp${(idr / 1_000_000_000).toFixed(2)}B`;
    if (idr >= 1_000_000) return `Rp${(idr / 1_000_000).toFixed(2)}M`;
    if (idr >= 1_000) return `Rp${Math.round(idr).toLocaleString("id-ID")}`;
    if (idr >= 1) return `Rp${idr.toFixed(2)}`;
    return `Rp${idr.toFixed(4)}`;
  }

  // USD formatting
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

/**
 * Format a currency amount (like PnL) with prefix.
 */
export function formatCurrencyAmount(
  value: number,
  currency: Currency,
  usdToIdr: number
): string {
  const converted = currency === "IDR" ? value * usdToIdr : value;
  const abs = Math.abs(converted);
  const sign = value >= 0 ? "+" : "-";
  const symbol = currency === "IDR" ? "Rp" : "$";

  if (currency === "IDR") {
    if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs).toLocaleString("id-ID")}`;
    return `${sign}${symbol}${abs.toFixed(0)}`;
  }

  // USD
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${symbol}${abs.toFixed(2)}`;
}

/**
 * Get the currency symbol for display.
 */
export function getCurrencySymbol(currency: Currency): string {
  return currency === "IDR" ? "Rp" : "$";
}
