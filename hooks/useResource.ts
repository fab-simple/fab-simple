// TanStack Query wrapper over FabAPI. One hook to rule list+get+create+update+remove.
// In DEMO mode it returns mock data so the UI can render before backend is wired.

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { FabAPI, FabApiError } from "@/lib/api";

export const FAB_MODE = process.env.NEXT_PUBLIC_FAB_MODE ?? "demo";

export function useResourceList<T = unknown>(
  table: string,
  query?: Record<string, string | number | boolean | undefined>,
  options?: Omit<UseQueryOptions<T[], FabApiError>, "queryKey" | "queryFn">
) {
  return useQuery<T[], FabApiError>({
    queryKey: [table, "list", query],
    queryFn: () => FabAPI.list<T>(table, query),
    enabled: FAB_MODE === "live" && (options?.enabled ?? true),
    ...options,
  });
}

export function useResource<T = unknown>(table: string, id: string | undefined | null) {
  return useQuery<T, FabApiError>({
    queryKey: [table, "get", id],
    queryFn: () => FabAPI.get<T>(table, id!),
    enabled: !!id && FAB_MODE === "live",
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => FabAPI.dashboard(),
    enabled: FAB_MODE === "live",
    refetchInterval: 30 * 1000,
  });
}

export function useCreate<T = unknown>(table: string) {
  const qc = useQueryClient();
  return useMutation<T, FabApiError, unknown>({
    mutationFn: (body) => FabAPI.create<T>(table, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdate<T = unknown>(table: string) {
  const qc = useQueryClient();
  return useMutation<T, FabApiError, { id: string; body: unknown }>({
    mutationFn: ({ id, body }) => FabAPI.update<T>(table, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRemove(table: string) {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean; id: string }, FabApiError, string>({
    mutationFn: (id) => FabAPI.remove(table, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
