// TanStack Query wrapper over FabAPI. One hook to rule list+get+create+update+remove.
// In DEMO mode it returns mock data so the UI can render before backend is wired.

import { useCallback, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import {
  FabAPI,
  FabApiError,
  type PagedResult,
  type PoFromPartsPreview,
  type CreatePoFromPartsBody,
  type CreatePoFromPartsResult,
  type MaterialLot,
  type AssignHeatBody,
  type AssignHeatResult,
  type ExtractMtrResult,
} from "@/lib/api";

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

/**
 * Fetches EVERY row matching `query`, paging past the server's 200-row cap.
 * Use for small/medium reference tables a view needs in full for client-side
 * filtering or aggregate counts (e.g. the Drawing Log's per-type tab totals).
 *
 * Mirrors `useResourceList`'s signature so it's a drop-in swap. Do NOT use it
 * for unbounded tables (parts, audit_log) — reach for `useResourcePaged` there.
 */
export function useResourceListAll<T = unknown>(
  table: string,
  query?: Record<string, string | number | boolean | undefined>,
  options?: Omit<UseQueryOptions<T[], FabApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<T[], FabApiError>({
    queryKey: [table, "list-all", query],
    queryFn: () => FabAPI.listAll<T>(table, query),
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

/**
 * Read-only preview of the PO that would be created from a project's not_started
 * parts. Fetches only when the modal is open (`enabled`) and a project is chosen.
 */
export function usePoFromPartsPreview(projectId: string | null, enabled: boolean) {
  return useQuery<PoFromPartsPreview, FabApiError>({
    queryKey: ["purchase_orders", "po-from-parts-preview", projectId],
    queryFn: () => FabAPI.previewPoFromParts(projectId!),
    enabled: FAB_MODE === "live" && enabled && !!projectId,
  });
}

/**
 * Create a draft PO from a project's not_started parts. Invalidates parts (their
 * status flips to `ordered`), purchase_orders, and the dashboard on success.
 */
export function useCreatePoFromParts() {
  const qc = useQueryClient();
  return useMutation<CreatePoFromPartsResult, FabApiError, CreatePoFromPartsBody>({
    mutationFn: (body) => FabAPI.createPoFromParts(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Assign a heat to a bundle, creating the material_lot server-side.
 * Invalidates bundles, heat_numbers, and material_lots on success.
 */
export function useAssignHeatToBundle() {
  const qc = useQueryClient();
  return useMutation<AssignHeatResult, FabApiError, { bundleId: string; body: AssignHeatBody }>({
    mutationFn: ({ bundleId, body }) => FabAPI.assignHeatToBundle(bundleId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bundles"] });
      qc.invalidateQueries({ queryKey: ["heat_numbers"] });
      qc.invalidateQueries({ queryKey: ["material_lots"] });
    },
  });
}

/**
 * Best-available-lot lookup for production allocation. Only fires when
 * `enabled` and both `profile`/`grade` are present (e.g. a cut-list picker
 * open for a specific line item).
 */
export function useRecommendLots(
  query: { profile: string; grade: string; min_length?: number; project_id?: string } | null,
  enabled: boolean,
) {
  return useQuery<MaterialLot[], FabApiError>({
    queryKey: ["material_lots", "recommend", query],
    queryFn: () => FabAPI.recommendLots(query!),
    enabled: FAB_MODE === "live" && enabled && !!query?.profile && !!query?.grade,
  });
}

/**
 * Trigger OCR extraction on an MTR document. Invalidates mtr_documents and
 * heat_numbers (quarantine status may follow once a human verifies).
 */
export function useExtractMtrDocument() {
  const qc = useQueryClient();
  return useMutation<ExtractMtrResult, FabApiError, string>({
    mutationFn: (id) => FabAPI.extractMtrDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mtr_documents"] });
      qc.invalidateQueries({ queryKey: ["heat_numbers"] });
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
