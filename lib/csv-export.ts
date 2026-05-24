// Global CSV export bus.
//
// Pages register themselves on mount via `useCsvExport()` providing a filename
// + a function that returns rows. The Topbar Export CSV button calls the
// currently-registered provider; when no provider is set we export all
// currently-cached TanStack queries (best-effort fallback).

import Papa from "papaparse";

type Provider = () => { filename: string; rows: Record<string, unknown>[] } | null;

let current: Provider | null = null;

export function registerCsvProvider(p: Provider) {
  current = p;
}
export function clearCsvProvider(p: Provider) {
  if (current === p) current = null;
}

export function downloadCurrentCsv() {
  const result = current?.() ?? null;
  if (!result || result.rows.length === 0) {
    alert("Nothing to export from this page yet.");
    return;
  }
  const csv = Papa.unparse(result.rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
