"use client";

import { useCurrencyStore, formatPriceWithCurrency, formatCurrencyAmount, getCurrencySymbol } from "@/store/currency.store";

/**
 * Hook for currency-aware price formatting.
 * 
 * Usage:
 *   const { formatPrice, formatAmount, symbol, currency } = useCurrency();
 *   <span>{formatPrice(signal.entry_price)}</span>
 *   <span>{formatAmount(trade.pnl_amount)}</span>
 */
export function useCurrency() {
  const { currency, usdToIdr, convert } = useCurrencyStore();

  return {
    currency,
    symbol: getCurrencySymbol(currency),

    /** Format a crypto price (entry, SL, TP) */
    formatPrice: (price: number) =>
      formatPriceWithCurrency(price, currency, usdToIdr),

    /** Format a currency amount (PnL, fees) with +/- sign */
    formatAmount: (value: number) =>
      formatCurrencyAmount(value, currency, usdToIdr),

    /** Raw conversion from USD */
    convert,
  };
}
