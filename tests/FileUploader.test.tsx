import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock the API surface used by FileUploader
vi.mock("@/lib/api", () => ({
  FabAPI: {
    listFiles: vi.fn().mockResolvedValue([]),
    signRead: vi.fn(),
    deleteFile: vi.fn(),
  },
  uploadFile: vi.fn(),
}));

import { FileUploader } from "@/components/ui/FileUploader";
import { FabAPI } from "@/lib/api";

describe("FileUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders label and Add-file button", async () => {
    render(<FileUploader entityType="drawings" entityId="abc" bucket="drawings" />);
    expect(screen.getByText(/attachments/i)).toBeInTheDocument();
    expect(screen.getByText(/add file/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no files", async () => {
    render(<FileUploader entityType="drawings" entityId="abc" bucket="drawings" label="Files" />);
    await waitFor(() => expect(screen.getByText(/no files yet/i)).toBeInTheDocument());
  });

  it("renders existing files when listFiles returns them", async () => {
    (FabAPI.listFiles as any).mockResolvedValueOnce([
      { id: "1", storage_path: "drawings/abc/test.pdf", size_bytes: 2048, content_type: "application/pdf" },
    ]);
    render(<FileUploader entityType="drawings" entityId="abc" bucket="drawings" />);
    await waitFor(() => expect(screen.getByText("test.pdf")).toBeInTheDocument());
  });
});
