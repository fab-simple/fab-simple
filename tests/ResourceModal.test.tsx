import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";

describe("ResourceModal", () => {
  it("renders title and submit button", () => {
    render(
      <ResourceModal title="Hello" onClose={() => {}} onSubmit={() => {}}>
        <div>body</div>
      </ResourceModal>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    const saveBtn = screen.getAllByRole("button").find((b) => b.textContent?.trim() === "Save");
    expect(saveBtn).toBeDefined();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <ResourceModal title="Modal title" onClose={onClose} onSubmit={() => {}}>
        <div />
      </ResourceModal>,
    );
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ResourceModal title="Modal title" onClose={onClose} onSubmit={() => {}}>
        <div />
      </ResourceModal>,
    );
    const headerCloseBtn = container.querySelector(".card-header button");
    expect(headerCloseBtn).not.toBeNull();
    fireEvent.click(headerCloseBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking backdrop overlay", () => {
    const onClose = vi.fn();
    const { container } = render(
      <ResourceModal title="Modal title" onClose={onClose} onSubmit={() => {}}>
        <div />
      </ResourceModal>,
    );
    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onSubmit when form is submitted", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <ResourceModal title="Modal title" onClose={() => {}} onSubmit={onSubmit}>
        <div />
      </ResourceModal>,
    );
    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows error message when provided", () => {
    render(
      <ResourceModal title="X" onClose={() => {}} onSubmit={() => {}} error="Validation failed">
        <div />
      </ResourceModal>,
    );
    expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
  });

  it("disables submit button while submitting", () => {
    render(
      <ResourceModal title="Modal title" onClose={() => {}} onSubmit={() => {}} submitting>
        <div />
      </ResourceModal>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Saving"))!;
    expect(btn).toBeDisabled();
  });
});

describe("Field", () => {
  it("renders label + required marker", () => {
    render(<Field label="Name" required><input /></Field>);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders hint when provided", () => {
    render(<Field label="X" hint="Pick wisely"><input /></Field>);
    expect(screen.getByText("Pick wisely")).toBeInTheDocument();
  });
});
