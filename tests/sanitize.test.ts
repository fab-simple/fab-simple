import { describe, it, expect } from "vitest";
import { sanitize } from "@/lib/api";

describe("sanitize", () => {
  it("strips <script> tags", () => {
    expect(sanitize("<script>alert(1)</script>hello")).toBe("hello");
  });

  it("strips angle-bracket tags but keeps inner text", () => {
    expect(sanitize("<b>bold</b> text")).toBe("bold text");
  });

  it("removes javascript: protocol", () => {
    expect(sanitize("javascript:evil()")).toBe("evil()");
  });

  it("trims whitespace", () => {
    expect(sanitize("  hi  ")).toBe("hi");
  });

  it("deep-sanitizes object values", () => {
    const out = sanitize({ name: "<script>x</script>Alice", nested: { bio: "<i>dev</i>" } });
    expect(out).toEqual({ name: "Alice", nested: { bio: "dev" } });
  });

  it("deep-sanitizes arrays — script blocks are removed in full", () => {
    expect(sanitize(["<b>a</b>", "b<script>c</script>"])).toEqual(["a", "b"]);
  });

  it("leaves numbers and booleans alone", () => {
    expect(sanitize({ a: 1, b: true, c: null })).toEqual({ a: 1, b: true, c: null });
  });
});
