"use client";

import { useEffect, useRef } from "react";
import { registerCsvProvider, clearCsvProvider } from "@/lib/csv-export";

interface Opts<T> {
  filename: string;
  data: T[] | undefined;
  transform?: (row: T) => Record<string, unknown>;
}

export function useCsvExport<T>({ filename, data, transform }: Opts<T>) {
  const ref = useRef<(() => ReturnType<Parameters<typeof registerCsvProvider>[0]>) | null>(null);

  useEffect(() => {
    const provider = () => ({
      filename,
      rows: (data ?? []).map((r) => (transform ? transform(r) : (r as Record<string, unknown>))),
    });
    ref.current = provider;
    registerCsvProvider(provider);
    return () => { if (ref.current) clearCsvProvider(ref.current); };
  }, [filename, data, transform]);
}
