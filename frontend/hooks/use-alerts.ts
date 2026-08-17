"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Alert, AlertListResponse } from "@/types/alert";

export function useAlerts() {
  return useQuery<AlertListResponse>({
    queryKey: ["alerts"],
    queryFn: () => api.get<AlertListResponse>("/alerts"),
  });
}

export function useAlertActions() {
  const queryClient = useQueryClient();

  const createAlert = useMutation({
    mutationFn: (data: {
      channel: string;
      event_type: string;
      config?: Record<string, unknown>;
      is_active?: boolean;
    }) => api.post<Alert>("/alerts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const updateAlert = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      config?: Record<string, unknown>;
      is_active?: boolean;
    }) => api.patch<Alert>(`/alerts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const deleteAlert = useMutation({
    mutationFn: (id: string) => api.delete(`/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const testTelegram = useMutation({
    mutationFn: (chatId: string) =>
      api.post<{ success: boolean; message: string }>("/alerts/test-telegram", {
        chat_id: chatId,
      }),
  });

  return { createAlert, updateAlert, deleteAlert, testTelegram };
}
