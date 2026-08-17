/**
 * Tram — Browser Notification System.
 *
 * Provides permission management, toggle state persistence,
 * and a ready-to-use trigger function for the WebSocket signal listener.
 */

// ── Permission & State ──────────────────────────────────────────

const STORAGE_KEY = "tram_notifications_enabled";

/**
 * Check if browser supports the Notification API.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get the current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Check if the user has opted-in to notifications (persisted toggle).
 */
export function isNotificationEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

/**
 * Persist the notification toggle state.
 */
export function setNotificationEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

/**
 * Request browser notification permission.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

// ── Signal Notification Trigger ─────────────────────────────────

export interface SignalNotificationData {
  symbol: string;
  direction: "long" | "short";
  timeframe: string;
  entry_price: number;
  confidence: number;
  strategy_name?: string;
}

/**
 * Fire a browser notification for a new trading signal.
 *
 * Call this from your WebSocket listener when a new signal arrives:
 *
 * ```ts
 * ws.onmessage = (event) => {
 *   const signal = JSON.parse(event.data);
 *   triggerSignalNotification(signal);
 * };
 * ```
 */
export function triggerSignalNotification(signalData: SignalNotificationData): void {
  // Bail if not supported, not permitted, or user has opted out
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;
  if (!isNotificationEnabled()) return;

  const directionEmoji = signalData.direction === "long" ? "🟢" : "🔴";
  const directionLabel = signalData.direction.toUpperCase();
  const strategy = signalData.strategy_name || "Scanner";
  const price = signalData.entry_price >= 1
    ? signalData.entry_price.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : signalData.entry_price.toFixed(8);

  const notification = new Notification(
    `${directionEmoji} ${directionLabel} Signal — ${signalData.symbol}`,
    {
      body: [
        `Entry: $${price}`,
        `Confidence: ${Math.round(signalData.confidence)}%`,
        `Timeframe: ${signalData.timeframe} · ${strategy}`,
      ].join("\n"),
      icon: "/favicon.ico",
      tag: `tram-signal-${signalData.symbol}-${Date.now()}`,
      silent: false,
    }
  );

  // Auto-close after 8 seconds
  setTimeout(() => notification.close(), 8000);

  // Focus the app window when the notification is clicked
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
