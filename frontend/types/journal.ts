export type EmotionalState =
  | "calm"
  | "confident"
  | "anxious"
  | "fearful"
  | "greedy"
  | "frustrated"
  | "neutral";

export interface JournalEntry {
  id: string;
  user_id: string;
  trade_id: string | null;
  title: string | null;
  content: string | null;
  mistake_tags: string[];
  emotional_state: EmotionalState | null;
  rating: number | null;
  screenshots: string[];
  created_at: string;
  updated_at: string;
  trade: {
    id: string;
    symbol: string;
    direction: "long" | "short";
    status: "open" | "closed" | "cancelled";
    pnl_amount: number;
    pnl_percent: number;
    entry_price: number;
    exit_price: number | null;
  } | null;
}

export interface JournalCreate {
  title?: string;
  content?: string;
  trade_id?: string;
  mistake_tags?: string[];
  emotional_state?: EmotionalState;
  rating?: number;
}

export interface JournalUpdate {
  title?: string;
  content?: string;
  mistake_tags?: string[];
  emotional_state?: EmotionalState;
  rating?: number;
}

export interface JournalListResponse {
  entries: JournalEntry[];
  total: number;
}

// Emotional state display config
export const EMOTIONAL_STATES: {
  value: EmotionalState;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { value: "calm", label: "Calm", emoji: "😌", color: "text-blue-400" },
  { value: "confident", label: "Confident", emoji: "💪", color: "text-profit" },
  { value: "neutral", label: "Neutral", emoji: "😐", color: "text-muted-foreground" },
  { value: "anxious", label: "Anxious", emoji: "😰", color: "text-warning" },
  { value: "fearful", label: "Fearful", emoji: "😨", color: "text-loss" },
  { value: "greedy", label: "Greedy", emoji: "🤑", color: "text-warning" },
  { value: "frustrated", label: "Frustrated", emoji: "😤", color: "text-loss" },
];

// Common mistake tags for quick selection
export const COMMON_MISTAKE_TAGS = [
  "FOMO entry",
  "No stop loss",
  "Moved stop loss",
  "Over-leveraged",
  "Ignored signal",
  "Revenge trade",
  "Early exit",
  "Late entry",
  "Wrong position size",
  "Traded against trend",
  "No plan",
  "Emotional decision",
];
