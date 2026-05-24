import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library v16 does not auto-cleanup with vitest by default.
afterEach(() => {
  cleanup();
});
