export interface Alert {
  id: string;
  user_id: string;
  channel: "telegram" | "discord" | "email";
  event_type: "new_signal" | "trade_closed" | "price_alert" | "journal_reminder";
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
}
