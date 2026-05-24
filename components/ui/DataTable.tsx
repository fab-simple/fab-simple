"use client";

import { Loader2, AlertCircle, Inbox, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  /** Field accessor for sorting. If omitted, column is non-sortable. */
  sortAccessor?: (row: T) => string | number | null | undefined;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  error?: { message: string } | null;
  empty?: { title: string; subtitle?: string };
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;

  /** Built-in pagination (defaults: on, 25 per page) */
  pagination?: { pageSize?: number; pageSizeOptions?: number[] } | false;

  /** Multi-select support: pass selected ids + setter to enable */
  selectable?: {
    selected: Set<string>;
    onChange: (ids: Set<string>) => void;
  };
}

export function DataTable<T>({
  data, columns, loading, error, empty, rowKey, onRowClick, pagination, selectable,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pagination === false ? Number.POSITIVE_INFINITY : (pagination?.pageSize ?? 25));
  const pageSizeOptions = (pagination !== false ? pagination?.pageSizeOptions : undefined) ?? [10, 25, 50, 100];

  const sorted = useMemo(() => {
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
  }, [data, columns, sortKey, sortDir]);

  const total = sorted?.length ?? 0;
  const lastPage = pagination === false ? 0 : Math.max(0, Math.ceil(total / pageSize) - 1);
  const paged = pagination === false ? sorted : sorted?.slice(page * pageSize, page * pageSize + pageSize);

  function toggleSort(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortAccessor) return;
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir("asc"); }
  }

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
  if (!sorted || sorted.length === 0) {
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

  const allOnPageSelected = selectable && paged && paged.every((r) => selectable.selected.has(rowKey(r)));
  function toggleAllOnPage() {
    if (!selectable || !paged) return;
    const next = new Set(selectable.selected);
    if (allOnPageSelected) paged.forEach((r) => next.delete(rowKey(r)));
    else paged.forEach((r) => next.add(rowKey(r)));
    selectable.onChange(next);
  }
  function toggleRow(id: string) {
    if (!selectable) return;
    const next = new Set(selectable.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    selectable.onChange(next);
  }

  return (
    <div className="card">
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
                const sortable = !!c.sortAccessor;
                const active = sortKey === c.key;
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
                      {sortable && active && (sortDir === "asc"
                        ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged?.map((row) => {
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

      {pagination !== false && (
        <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
            <span>Rows per page:</span>
            <select
              className="input"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              style={{ height: 26, padding: "0 6px", fontSize: 12, width: 70 }}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ marginLeft: 12 }}>
              {total === 0 ? 0 : page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(0)} title="First"><ChevronsLeft size={12} /></button>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} title="Previous"><ChevronLeft size={12} /></button>
            <span className="text-[12px] px-2 font-mono" style={{ color: "var(--text)" }}>{page + 1} / {lastPage + 1}</span>
            <button className="btn btn-sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} title="Next"><ChevronRight size={12} /></button>
            <button className="btn btn-sm" disabled={page >= lastPage} onClick={() => setPage(lastPage)} title="Last"><ChevronsRight size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
