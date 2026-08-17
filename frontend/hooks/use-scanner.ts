"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface ScannerStatus {
  running: boolean;
  connected: boolean;
  symbols?: string[];
  timeframes?: string[];
  strategies?: number;
  message?: string;
  stats?: {
    candles_processed: number;
    signals_generated: number;
    signals_persisted: number;
    errors: number;
    uptime_seconds: number;
  };
  buffers?: Record<string, number>;
}

/**
 * Hook for polling scanner engine status from the backend API.
 */
export function useScannerStatus(pollIntervalMs: number = 5000) {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<ScannerStatus>("/scanner/status");
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch scanner status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  return { status, loading, error, refetch: fetchStatus };
}
