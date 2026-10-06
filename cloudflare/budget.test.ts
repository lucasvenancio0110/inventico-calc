import { describe, it, expect, vi } from "vitest";
import { AIBudget } from "./budget";
import type { Env } from "./worker";

function fixture(limit = "2") {
  const rows = new Map<string, unknown>();
  let queue = Promise.resolve();
  const state = {
    storage: {
      get: async (key: string) => structuredClone(rows.get(key)),
      put: async (key: string, value: unknown) => {
        rows.set(key, structuredClone(value));
      },
    },
    blockConcurrencyWhile<T>(fn: () => Promise<T>) {
      const result = queue.then(fn);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  } as unknown as DurableObjectState;
  const environment = {
    INVENTICO_MAX_CALLS: limit,
    INVENTICO_BUDGET_PERIOD: "initial",
  } as Env;
  const create = () => new AIBudget(state, environment);
  const call = (object: AIBudget, path: string, body?: unknown) =>
    object.fetch(
      new Request("https://budget/" + path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  return { create, call, environment };
}
describe("Cloudflare persistent AI budget", () => {
  it("serializes concurrent reservations across instances", async () => {
    const f = fixture();
    const results = await Promise.all([
      f.call(f.create(), "reserve"),
      f.call(f.create(), "reserve"),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 429]);
  });
  it("preserves consumed calls after release and instance replacement", async () => {
    const f = fixture("1");
    const first = await f.call(f.create(), "reserve");
    await f.call(f.create(), "release", await first.json());
    expect((await f.call(f.create(), "reserve")).status).toBe(429);
    f.environment.INVENTICO_BUDGET_PERIOD = "reviewed-next-period";
    expect((await f.call(f.create(), "reserve")).status).toBe(200);
  });
  it("does not let an old operation release the current lease", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture("3");
      const old = await (await f.call(f.create(), "reserve")).json();
      vi.advanceTimersByTime(240001);
      expect((await f.call(f.create(), "reserve")).status).toBe(200);
      await f.call(f.create(), "release", old);
      expect((await f.call(f.create(), "reserve")).status).toBe(429);
    } finally {
      vi.useRealTimers();
    }
  });
  it("fails closed for an invalid budget", async () => {
    const f = fixture("NaN");
    expect((await f.call(f.create(), "reserve")).status).toBe(503);
  });
});
