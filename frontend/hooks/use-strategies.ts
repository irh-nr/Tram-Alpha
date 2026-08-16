"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StrategyListResponse } from "@/types/strategy";

const STRATEGIES_KEY = ["strategies"];

/**
 * Hook to fetch all strategies with user subscription status.
 */
export function useStrategies() {
  return useQuery({
    queryKey: STRATEGIES_KEY,
    queryFn: () => api.get<StrategyListResponse>("/strategies"),
  });
}

/**
 * Hook providing strategy subscribe/unsubscribe mutations.
 */
export function useStrategyActions() {
  const queryClient = useQueryClient();

  const subscribe = useMutation({
    mutationFn: (strategyId: string) =>
      api.post(`/strategies/${strategyId}/subscribe`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY });
    },
  });

  const unsubscribe = useMutation({
    mutationFn: (strategyId: string) =>
      api.delete(`/strategies/${strategyId}/subscribe`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STRATEGIES_KEY });
    },
  });

  return { subscribe, unsubscribe };
}
