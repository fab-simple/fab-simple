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
    vi.mocked(FabAPI.listFiles).mockResolvedValueOnce([
      { id: "1", storage_bucket: "drawings", storage_path: "drawings/abc/test.pdf", mime_type: "application/pdf", size_bytes: 2048, created_at: "2026-01-01T00:00:00Z", uploaded_by: null },
    ]);
    render(<FileUploader entityType="drawings" entityId="abc" bucket="drawings" />);
    await waitFor(() => expect(screen.getByText("test.pdf")).toBeInTheDocument());
  });
});
