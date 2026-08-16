"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isNotificationSupported,
  isNotificationEnabled,
  setNotificationEnabled,
  requestNotificationPermission,
  getNotificationPermission,
} from "@/lib/notifications";

/**
 * Hook for managing browser notification toggle state.
 *
 * Returns the current enabled/disabled state and a toggle function
 * that handles permission request on first activation.
 *
 * All browser-only checks are deferred to useEffect to prevent
 * SSR/client hydration mismatches.
 */
export function useNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage + browser state (client-only)
  useEffect(() => {
    setMounted(true);
    setSupported(isNotificationSupported());
    setEnabled(isNotificationEnabled());
    setPermission(getNotificationPermission());
  }, []);

  const toggle = useCallback(async () => {
    // If currently enabled → disable
    if (enabled) {
      setNotificationEnabled(false);
      setEnabled(false);
      return;
    }

    // If currently disabled → request permission & enable
    setLoading(true);
    try {
      const granted = await requestNotificationPermission();
      setPermission(getNotificationPermission());

      if (granted) {
        setNotificationEnabled(true);
        setEnabled(true);
      }
      // If denied, permission state update will reflect in the UI
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  return {
    /** Whether notifications are currently enabled (user toggle) */
    enabled,
    /** Browser notification permission status */
    permission,
    /** Whether a permission request is in progress */
    loading,
    /** Whether the browser supports the Notification API */
    supported,
    /** Whether the hook has hydrated on the client */
    mounted,
    /** Toggle notifications on/off */
    toggle,
  };
}
