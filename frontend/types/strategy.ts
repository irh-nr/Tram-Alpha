export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  timeframe: string;
  default_parameters: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // User-specific fields (merged by backend)
  user_enabled: boolean;
  user_parameters: Record<string, unknown>;
}

export interface StrategyListResponse {
  strategies: Strategy[];
  total: number;
}
