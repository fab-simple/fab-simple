"use client";

import { Loader2, AlertCircle, Inbox, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  /**
   * Field accessor for client-side sorting. Pass `sortField` for server-
   * side sort instead. If neither is set, the column is not sortable.
   */
  sortAccessor?: (row: T) => string | number | null | undefined;
  /** Column name in the DB (used when `server` is provided). */
  sortField?: string;
  render: (row: T) => ReactNode;
}

/**
 * Server-side pagination + sort. When this prop is provided, DataTable
 * stops doing any client-side slicing/sorting and just renders what the
 * caller hands it, driving paging/sort through the supplied callbacks.
 *
 * Use with `useResourcePaged()` — the hook's return shape matches.
 */
export interface DataTableServerControl {
  page: number;          // 1-based
  perPage: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (n: number) => void;
  pageSizeOptions?: number[];
  /** Currently active sort column (db field name) + direction */
  orderBy?: string;
  dir?: "asc" | "desc";
  onSortChange?: (orderBy: string, dir: "asc" | "desc") => void;
  /** Caller is still loading new page data */
  fetching?: boolean;
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  error?: { message: string } | null;
  empty?: { title: string; subtitle?: string };
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;

  /** Built-in client-side pagination (defaults: on, 25 per page). Ignored when `server` is set. */
  pagination?: { pageSize?: number; pageSizeOptions?: number[] } | false;

  /** Server-side pagination + sort. When set, supersedes `pagination`. */
  server?: DataTableServerControl;

  /** Multi-select support: pass selected ids + setter to enable */
  selectable?: {
    selected: Set<string>;
    onChange: (ids: Set<string>) => void;
  };
}

export function DataTable<T>({
  data, columns, loading, error, empty, rowKey, onRowClick, pagination, server, selectable,
}: DataTableProps<T>) {
  // Client-side state (only used when `server` is not provided).
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pagination === false ? Number.POSITIVE_INFINITY : (pagination?.pageSize ?? 25));
  const clientPageSizeOptions = (pagination !== false ? pagination?.pageSizeOptions : undefined) ?? [10, 25, 50, 100];

  const isServer = !!server;

  // CLIENT MODE — sort + slice locally.
  const sortedClient = useMemo(() => {
    if (isServer) return data;
    if (!data) return data;
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortAccessor) return data;
    const acc = col.sortAccessor;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = acc(a); const bv = acc(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [isServer, data, columns, sortKey, sortDir]);

  // The set of rows actually rendered.
  const visible = isServer
    ? data
    : (pagination === false
        ? sortedClient
        : sortedClient?.slice(page * pageSize, page * pageSize + pageSize));

  // Pagination footer values.
  const total = isServer ? (server!.total ?? 0) : (sortedClient?.length ?? 0);
  const currentPage = isServer ? (server!.page - 1) : page;          // 0-based for the math below
  const currentPerPage = isServer ? server!.perPage : pageSize;
  const lastPage = isServer
    ? Math.max(0, Math.ceil(total / currentPerPage) - 1)
    : (pagination === false ? 0 : Math.max(0, Math.ceil(total / pageSize) - 1));

  // Sort indicator.
  const activeSortKey = isServer
    ? columns.find((c) => c.sortField && c.sortField === server!.orderBy)?.key ?? null
    : sortKey;
  const activeSortDir = isServer ? (server!.dir ?? "asc") : sortDir;

  function toggleSort(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col) return;

    if (isServer) {
      if (!col.sortField || !server!.onSortChange) return;
      const sameField = server!.orderBy === col.sortField;
      const nextDir: "asc" | "desc" = !sameField ? "asc" : (server!.dir === "asc" ? "desc" : "asc");
      server!.onSortChange(col.sortField, nextDir);
      return;
    }

    if (!col.sortAccessor) return;
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir("asc"); }
  }

  // Pagination footer interactions.
  const goToPage = (zeroIndexed: number) => {
    if (isServer) server!.onPageChange(zeroIndexed + 1);
    else setPage(zeroIndexed);
  };
  const setSize = (n: number) => {
    if (isServer) server!.onPerPageChange(n);
    else { setPageSize(n); setPage(0); }
  };
  const pageSizeOptions = isServer
    ? (server!.pageSizeOptions ?? [10, 25, 50, 100])
    : clientPageSizeOptions;
  const showPaginationBar = isServer || pagination !== false;
  const fetching = isServer && server!.fetching;

  if (loading) {
    return (
      <div className="card" style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ marginLeft: 12, fontSize: 13 }}>Loading…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card" style={{ padding: 24, display: "flex", alignItems: "center", gap: 12, color: "#DC2626" }}>
        <AlertCircle size={18} />
        <div>
          <div className="font-semibold">Failed to load</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{error.message}</div>
        </div>
      </div>
    );
  }
  if (!visible || visible.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center" }}>
        <Inbox size={28} style={{ margin: "0 auto", color: "var(--muted)", marginBottom: 12 }} />
        <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{empty?.title ?? "Nothing yet"}</div>
        {empty?.subtitle && (
          <div className="text-[12px]" style={{ color: "var(--muted)", marginTop: 4 }}>{empty.subtitle}</div>
        )}
      </div>
    );
  }

  const allOnPageSelected = selectable && visible && visible.every((r) => selectable.selected.has(rowKey(r)));
  function toggleAllOnPage() {
    if (!selectable || !visible) return;
    const next = new Set(selectable.selected);
    if (allOnPageSelected) visible.forEach((r) => next.delete(rowKey(r)));
    else visible.forEach((r) => next.add(rowKey(r)));
    selectable.onChange(next);
  }
  function toggleRow(id: string) {
    if (!selectable) return;
    const next = new Set(selectable.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selectable.onChange(next);
  }

  return (
    <div className="card" style={{ position: "relative" }}>
      {fetching && (
        <div
          style={{
            position: "absolute", top: 8, right: 12, zIndex: 1,
            display: "flex", alignItems: "center", gap: 6,
            color: "var(--muted)", fontSize: 11,
          }}
        >
          <Loader2 size={11} className="animate-spin" />
          <span>Updating…</span>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={!!allOnPageSelected} onChange={toggleAllOnPage} />
                </th>
              )}
              {columns.map((c) => {
                const sortable = isServer ? !!c.sortField : !!c.sortAccessor;
                const active = activeSortKey === c.key;
                return (
                  <th
                    key={c.key}
                    style={{
                      width: c.width,
                      textAlign: c.align ?? "left",
                      cursor: sortable ? "pointer" : undefined,
                      userSelect: "none",
                    }}
                    onClick={() => sortable && toggleSort(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortable && active && (activeSortDir === "asc"
                        ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible?.map((row) => {
              const id = rowKey(row);
              const selected = selectable?.selected.has(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: onRowClick ? "pointer" : undefined,
                    background: selected ? "rgba(79,70,229,0.06)" : undefined,
                  }}
                >
                  {selectable && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={!!selected} onChange={() => toggleRow(id)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={c.mono ? "td-mono" : undefined} style={{ textAlign: c.align ?? "left" }}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPaginationBar && (
        <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
            <span>Rows per page:</span>
            <select
              className="input"
              value={currentPerPage}
              onChange={(e) => setSize(Number(e.target.value))}
              style={{ height: 26, padding: "0 6px", fontSize: 12, width: 70 }}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ marginLeft: 12 }}>
              {total === 0 ? 0 : currentPage * currentPerPage + 1}–{Math.min(total, (currentPage + 1) * currentPerPage)} of {total}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn btn-sm" disabled={currentPage === 0} onClick={() => goToPage(0)} title="First"><ChevronsLeft size={12} /></button>
            <button className="btn btn-sm" disabled={currentPage === 0} onClick={() => goToPage(currentPage - 1)} title="Previous"><ChevronLeft size={12} /></button>
            <span className="text-[12px] px-2 font-mono" style={{ color: "var(--text)" }}>{currentPage + 1} / {lastPage + 1}</span>
            <button className="btn btn-sm" disabled={currentPage >= lastPage} onClick={() => goToPage(currentPage + 1)} title="Next"><ChevronRight size={12} /></button>
            <button className="btn btn-sm" disabled={currentPage >= lastPage} onClick={() => goToPage(lastPage)} title="Last"><ChevronsRight size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
