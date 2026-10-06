import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createAIService } from "./service";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=";
const token = "temporary-test-access-token";
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});
async function setup(
  overrides: Partial<Parameters<typeof createAIService>[0]> = {},
) {
  const reserve = vi.fn(),
    provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ b64_json: image.split(",")[1] }] }),
          { status: 200 },
        ),
      );
  const server = createAIService({
    key: "test-only-key",
    token,
    imageModel: "gpt-image-2",
    visionModel: "test-vision-model",
    origins: ["http://localhost:5173"],
    reserve,
    fetch: provider,
    ...overrides,
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing address");
  const url = "http://127.0.0.1:" + address.port;
  const post = (path: string, body: unknown, access = token) =>
    fetch(url + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + access,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify(body),
    });
  return { url, post, reserve, provider };
}
const request = {
  logo: image,
  brief: {
    text: "MARCA Á",
    colors: "green and white PLA",
    adjustments: "",
    view: "three-quarter",
  },
};
describe("AI service, no paid provider calls", () => {
  it("passes original logo and approved reference to image edit", async () => {
    const { post, reserve, provider } = await setup();
    const response = await post("/concept", { ...request, reference: image });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.image).toBe(image);
    expect(body.prompt).toContain("MARCA Á");
    expect(reserve).toHaveBeenCalledOnce();
    const [url, init] = provider.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    const sent = JSON.parse(String(init?.body));
    expect(sent.images).toEqual([{ image_url: image }, { image_url: image }]);
    expect(sent.model).toBe("gpt-image-2");
    expect(sent.input_fidelity).toBeUndefined();
  });
  it("rejects unauthorized requests without reserving or calling provider", async () => {
    const { post, reserve, provider } = await setup();
    expect((await post("/concept", request, "wrong")).status).toBe(401);
    expect(reserve).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects remote image URLs and oversized raster headers", async () => {
    const { post, provider } = await setup();
    expect(
      (
        await post("/concept", {
          ...request,
          logo: "https://example.org/logo.png",
        })
      ).status,
    ).toBe(400);
    const bytes = Buffer.from(image.split(",")[1], "base64");
    bytes.writeUInt32BE(5000, 16);
    expect(
      (
        await post("/concept", {
          ...request,
          logo: "data:image/png;base64," + bytes.toString("base64"),
        })
      ).status,
    ).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it("blocks a disallowed browser origin", async () => {
    const { url, provider } = await setup();
    const r = await fetch(url + "/concept", {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
    });
    expect(r.status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });
  it("fails closed when budget reservation fails", async () => {
    const { post, provider } = await setup({
      reserve: () => {
        throw Error("Budget reached");
      },
    });
    expect((await post("/concept", request)).status).toBe(502);
    expect(provider).not.toHaveBeenCalled();
  });
  it("reports missing configuration honestly", async () => {
    const { url, post, provider } = await setup({ key: "" });
    expect((await (await fetch(url + "/health")).json()).configured).toBe(
      false,
    );
    expect((await post("/concept", request)).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
  it("validates structured plans against current region IDs", async () => {
    const plan = {
      status: "proposal",
      summary: "Counter sign",
      mounting: "counter",
      backing: "outline",
      targetWidthMm: 200,
      supportColor: null,
      baseColor: null,
      layers: [{ regionId: "region-1", heightMm: 3 }],
      palette: [],
      assumptions: ["Width suggested"],
      questions: [],
    };
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                content: [{ type: "output_text", text: JSON.stringify(plan) }],
              },
            ],
          }),
        ),
      );
    const { post } = await setup({ fetch: provider });
    const r = await post("/analyze", {
      images: [
        { role: "logo", data: image },
        { role: "concept", data: image },
      ],
      description: "Use approved concept",
      regionIds: ["region-1"],
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(plan);
  });
  it("never applies incomplete provider output", async () => {
    const provider = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "incomplete", output: [] })),
      );
    const { post } = await setup({ fetch: provider });
    expect(
      (
        await post("/analyze", {
          images: [{ role: "logo", data: image }],
          description: "",
          regionIds: [],
        })
      ).status,
    ).toBe(502);
  });
});
