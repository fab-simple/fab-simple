// TanStack Query wrapper over FabAPI. One hook to rule list+get+create+update+remove.
// In DEMO mode it returns mock data so the UI can render before backend is wired.

import { useCallback, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { FabAPI, FabApiError, type PagedResult } from "@/lib/api";

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

export interface UseResourcePagedOptions<T> {
  initialPage?: number;
  initialPerPage?: number;
  /** Stable filter object — page/per_page/order_by/dir are managed by the hook. */
  filters?: Record<string, string | number | boolean | undefined>;
  initialOrderBy?: string;
  initialDir?: "asc" | "desc";
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<PagedResult<T>, FabApiError>, "queryKey" | "queryFn">;
}

export interface UseResourcePagedResult<T> {
  data: PagedResult<T> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: FabApiError | null;
  refetch: () => void;
  page: number;
  perPage: number;
  setPage: (n: number) => void;
  setPerPage: (n: number) => void;
  orderBy: string;
  dir: "asc" | "desc";
  setSort: (orderBy: string, dir: "asc" | "desc") => void;
}

/**
 * Server-side paginated list. Use this when the table has more rows than
 * we want to ever ship to the browser (i.e. anything that can grow past
 * a few hundred — parts, audit_log, activity_feed, weld/paint inspections).
 *
 * Returns paging state + setters; pass them into <DataTable server={...}>.
 */
export function useResourcePaged<T = unknown>(
  table: string,
  opts: UseResourcePagedOptions<T> = {},
): UseResourcePagedResult<T> {
  const [page, setPage] = useState(opts.initialPage ?? 1);
  const [perPage, setPerPage] = useState(opts.initialPerPage ?? 25);
  const [orderBy, setOrderBy] = useState(opts.initialOrderBy ?? "created_at");
  const [dir, setDir] = useState<"asc" | "desc">(opts.initialDir ?? "desc");

  const setSort = useCallback((nextOrderBy: string, nextDir: "asc" | "desc") => {
    setOrderBy(nextOrderBy);
    setDir(nextDir);
    setPage(1); // any sort change resets to page 1 so the user isn't lost.
  }, []);

  const query: Record<string, string | number | boolean | undefined> = {
    page,
    per_page: perPage,
    order_by: orderBy,
    dir,
    ...(opts.filters ?? {}),
  };

  const result = useQuery<PagedResult<T>, FabApiError>({
    queryKey: [table, "paged", query],
    queryFn: () => FabAPI.listPaged<T>(table, query),
    enabled: FAB_MODE === "live" && (opts.enabled ?? true),
    placeholderData: keepPreviousData,
    ...opts.queryOptions,
  });

  const wrappedSetPerPage = useCallback((n: number) => {
    setPerPage(n);
    setPage(1);
  }, []);

  return {
    data: result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error ?? null,
    refetch: result.refetch,
    page,
    perPage,
    setPage,
    setPerPage: wrappedSetPerPage,
    orderBy,
    dir,
    setSort,
  };
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

// Current user's organization profile (company row). Cached for 5 minutes
// since it changes rarely; the billing page, page headers, and any PDF
// renderer that needs the contractor name/address all consume this.
export function useOrganization() {
  return useQuery({
    queryKey: ["organization"],
    queryFn: () => FabAPI.getOrganization(),
    enabled: FAB_MODE === "live",
    staleTime: 5 * 60 * 1000,
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
