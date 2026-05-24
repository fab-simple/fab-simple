import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, type Column } from "@/components/ui/DataTable";

interface Row { id: string; name: string; qty: number; }

const rows: Row[] = [
  { id: "1", name: "Beta",  qty: 3 },
  { id: "2", name: "Alpha", qty: 7 },
  { id: "3", name: "Gamma", qty: 1 },
];

const cols: Column<Row>[] = [
  { key: "name", label: "Name", sortAccessor: (r) => r.name, render: (r) => r.name },
  { key: "qty",  label: "Qty",  sortAccessor: (r) => r.qty,  render: (r) => r.qty },
];

describe("DataTable", () => {
  it("renders all rows by default", () => {
    render(<DataTable data={rows} columns={cols} rowKey={(r) => r.id} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("sorts ascending then descending on header click", () => {
    render(<DataTable data={rows} columns={cols} rowKey={(r) => r.id} />);
    const headers = screen.getAllByRole("columnheader");
    const nameHeader = headers.find((h) => h.textContent?.includes("Name"))!;
    fireEvent.click(nameHeader);
    const rendered = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rendered[0]).toContain("Alpha");
    expect(rendered[2]).toContain("Gamma");

    fireEvent.click(nameHeader);
    const desc = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(desc[0]).toContain("Gamma");
    expect(desc[2]).toContain("Alpha");
  });

  it("paginates when pageSize is small", () => {
    render(
      <DataTable
        data={rows}
        columns={cols}
        rowKey={(r) => r.id}
        pagination={{ pageSize: 2 }}
      />,
    );
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it("shows checkboxes when selectable is enabled", () => {
    const selected = new Set<string>();
    render(
      <DataTable
        data={rows} columns={cols} rowKey={(r) => r.id}
        selectable={{ selected, onChange: () => {} }}
      />,
    );
    // 1 header + 3 rows
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThanOrEqual(4);
  });

  it("shows empty state when no rows", () => {
    render(<DataTable data={[]} columns={cols} rowKey={(r) => r.id} empty={{ title: "Nothing!" }} />);
    expect(screen.getByText("Nothing!")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<DataTable data={undefined} columns={cols} rowKey={(r) => r.id} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
