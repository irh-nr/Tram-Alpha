export interface Trade {
  id: string;
  user_id: string;
  signal_id: string | null;
  symbol: string;
  direction: "long" | "short";
  status: "open" | "closed" | "cancelled";
  entry_price: number;
  exit_price: number | null;
  position_size: number;
  leverage: number;
  pnl_amount: number;
  pnl_percent: number;
  fees: number;
  rr_achieved: number;
  strategy_name: string | null;
  timeframe: string | null;
  entry_time: string;
  exit_time: string | null;
  created_at: string;
}

export interface TradeCreate {
  symbol: string;
  direction: "long" | "short";
  entry_price: number;
  position_size?: number;
  leverage?: number;
  strategy_name?: string;
  timeframe?: string;
  signal_id?: string;
  entry_time?: string;
}

export interface TradeUpdate {
  exit_price?: number;
  exit_time?: string;
  status?: "open" | "closed" | "cancelled";
  pnl_amount?: number;
  pnl_percent?: number;
  fees?: number;
  rr_achieved?: number;
}

export interface TradeListResponse {
  trades: Trade[];
  total: number;
}
