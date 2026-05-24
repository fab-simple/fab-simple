import { describe, it, expect, beforeEach, vi } from "vitest";
import { FabAPI, FabApiError, setSession } from "@/lib/api";

const globalAny = globalThis as unknown as { fetch: typeof fetch };

describe("FabAPI envelope unwrap", () => {
  beforeEach(() => { setSession("test-token", "owner"); });

  it("unwraps {ok, data} responses", async () => {
    globalAny.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      text: async () => JSON.stringify({ ok: true, data: [{ id: "1" }] }),
    } as unknown as Response);
    const list = await FabAPI.list("projects");
    expect(list).toEqual([{ id: "1" }]);
  });

  it("throws FabApiError with code from error envelope", async () => {
    globalAny.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400,
      text: async () => JSON.stringify({ ok: false, error: { message: "bad input", code: "validation" } }),
    } as unknown as Response);
    await expect(FabAPI.list("projects")).rejects.toMatchObject({
      status: 400, code: "validation",
    });
  });

  it("retries on 429", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 429, ok: false, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, data: [] }) });
    globalAny.fetch = fetchMock as unknown as typeof fetch;
    const list = await FabAPI.list("projects");
    expect(list).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("FabApiError is throwable with proper shape", () => {
    const e = new FabApiError("nope", 500, "internal");
    expect(e.message).toBe("nope");
    expect(e.status).toBe(500);
    expect(e.code).toBe("internal");
  });
});
