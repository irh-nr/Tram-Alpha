"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api, NetworkError } from "@/lib/api";

export type ScannerConnectionState =
  | "connected"
  | "reconnecting"
  | "connecting"
  | "stopped";

export type ScannerUiState =
  | "connected"
  | "reconnecting"
  | "stopped"
  | "error";

export interface ScannerStatus {
  running: boolean;
  connected: boolean;
  connection?: {
    state: ScannerConnectionState;
    reconnect_attempts: number;
  };
  last_error?: {
    source: string;
    message: string;
    at: string;
  } | null;
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

export function useScannerStatus(pollIntervalMs: number = 5000) {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkOffline, setIsNetworkOffline] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<ScannerStatus>("/scanner/status");
      setStatus(data);
      setError(null);
      setIsNetworkOffline(false);
    } catch (err: any) {
      if (err instanceof NetworkError || !navigator.onLine) {
        // WiFi user terputus: masuk mode reconnecting, jangan set error permanen
        setIsNetworkOffline(true);
        setError(null);
      } else {
        setIsNetworkOffline(false);
        setError(err.message || "Failed to fetch scanner status");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);

    // Langsung deteksi perubahan WiFi di browser tanpa menunggu interval 5 detik
    const handleOffline = () => setIsNetworkOffline(true);
    const handleOnline = () => {
      setIsNetworkOffline(false);
      fetchStatus();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [fetchStatus, pollIntervalMs]);

  const uiState: ScannerUiState = useMemo(() => {
    // 1. WiFi browser terputus
    if (isNetworkOffline) return "reconnecting";

    // 2. Gagal fetch API (mis. 500 Internal Server Error)
    if (error) return "error";

    // 3. Masih loading awal
    if (!status) return "reconnecting";

    // 4. Scanner dimatikan
    if (!status.running || status.connection?.state === "stopped") {
      return "stopped";
    }

    // 5. Error aplikasi asli di backend (DB/strategi/WS ditolak server)
    if (status.last_error) return "error";

    // 6. WiFi server backend terputus & sedang reconnect ke Binance
    if (
      status.connection?.state === "reconnecting" ||
      status.connection?.state === "connecting"
    ) {
      return "reconnecting";
    }

    return "connected";
  }, [isNetworkOffline, error, status]);

  return {
    status,
    loading,
    error: uiState === "error" ? (status?.last_error?.message ?? error) : null,
    uiState,
    isReconnecting: uiState === "reconnecting",
    reconnectAttempts: status?.connection?.reconnect_attempts ?? 0,
    refetch: fetchStatus,
  };
}