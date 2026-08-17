export interface Signal {
  id: string;
  user_id: string | null;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  direction: "long" | "short";
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  risk_reward: number | null;
  confidence: number;
  status: "active" | "triggered" | "expired" | "cancelled";
  strategy_name: string | null;
  metadata: Record<string, unknown>;
  detected_at: string;
  expires_at: string | null;
}

export interface SignalListResponse {
  signals: Signal[];
  total: number;
}
