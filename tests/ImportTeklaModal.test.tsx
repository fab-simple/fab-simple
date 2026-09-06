import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportTeklaModal } from "@/components/import/ImportTeklaModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useResource", () => ({
  useResourceList: () => ({
    data: [
      { id: "p1", name: "Stadium Project", number: "101" },
      { id: "p2", name: "Warehouse", number: "102" },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("ImportTeklaModal", () => {
  it("renders when open and displays supported formats including KISS (.kss), CSV, and Excel (.xlsx)", () => {
    render(<ImportTeklaModal open={true} onClose={() => {}} />);
    expect(screen.getByText("Import Tekla / SDS2 BOM")).toBeInTheDocument();
    expect(screen.getAllByText(/KISS \(\.kss\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CSV \/ TSV/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Excel \(\.xlsx\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/EJE \(\.eje\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it("does not render when open is false", () => {
    const { container } = render(<ImportTeklaModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onClose only when clicking the header close button (X) or footer Cancel button", () => {
    const onClose = vi.fn();
    const { container } = render(<ImportTeklaModal open={true} onClose={onClose} />);

    // Clicking the backdrop overlay should NOT close
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    // Clicking header X button should close
    const closeBtn = screen.getByTitle("Close modal");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clicking Cancel button should close
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
