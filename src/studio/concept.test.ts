import { describe, it, expect } from "vitest";
import { newProject, parseProject, area } from "./model";
import { conceptPrompt, defaultBrief } from "./conceptPrompt";
import { generate } from "./geometry";
import { writeFileSync } from "node:fs";
describe("Concept persistence and physical NFC pocket", () => {
  it("rejects a concept linked to a different logo", () => {
    const p = newProject();
    p.sourceHash = "original";
    p.concept = {
      id: "concept-1",
      sourceHash: "different",
      image: "data:image/png;base64,YQ==",
      prompt: "Test",
      approved: true,
      planned: true,
      createdAt: "2026-10-06",
    };
    expect(() => parseProject(JSON.stringify(p))).toThrow();
  });
  it("preserves the need to re-extract after reopening a draft", () => {
    const p = newProject();
    p.contoursCurrent = false;
    expect(parseProject(JSON.stringify(p)).contoursCurrent).toBe(false);
  });
  it("includes brand invariants and user-confirmed accents in prompts", () => {
    const prompt = conceptPrompt({
      ...defaultBrief,
      text: "ADRIANA FEIJÓ · CIRURGIÃ DENTISTA",
    });
    expect(prompt).toContain("ADRIANA FEIJÓ");
    expect(prompt).toContain("Do not redesign");
    expect(prompt).toContain("not a technical validation");
  });
  it("exports a closed base with the real specified NFC recess volume", async () => {
    const p = newProject();
    const regions = [
      {
        id: "mark",
        name: "Mark",
        color: "#ffffff",
        loops: [
          [
            [0, 0],
            [20, 0],
            [20, 20],
            [0, 20],
          ] as [number, number][],
        ],
        height: 3,
        enabled: true,
      },
    ];
    const o = {
      ...p.options,
      width: 20,
      mounting: "counter" as const,
      baseWidth: 40,
      baseDepth: 30,
      baseHeight: 5,
      nfcEnabled: true,
      nfcDiameter: 20,
      nfcDepth: 1,
    };
    const g = await generate(regions, o, "nfc-test");
    const base = g.parts.find((p) => p.id === "base")!;
    expect(base.report.closed).toBe(true);
    const pocket = 0.5 * 64 * 100 * Math.sin((2 * Math.PI) / 64);
    expect(base.report.volume).toBeCloseTo(40 * 30 * 5 - pocket, 2);
    writeFileSync("fixtures/generated/nfc-base.stl", base.stl);
  });
  it("rejects NFC pockets which cut through the roof or side", async () => {
    const p = newProject();
    await expect(
      generate(
        [],
        { ...p.options, mounting: "counter", nfcEnabled: true, nfcDepth: 5 },
        "bad-pocket",
      ),
    ).rejects.toThrow("Alojamento NFC");
  });
});

it("regularizes stepped raster curves while preserving hole volume", async () => {
  const circle = (radius: number) => {
    const points: [number, number][] = [];
    for (let i = 0; i < 360; i++) {
      const t = (i * Math.PI) / 180;
      const p: [number, number] = [
        Math.round(radius * Math.cos(t)),
        Math.round(radius * Math.sin(t)),
      ];
      if (
        !points.length ||
        points.at(-1)![0] !== p[0] ||
        points.at(-1)![1] !== p[1]
      )
        points.push(p);
    }
    if (
      points[0][0] === points.at(-1)![0] &&
      points[0][1] === points.at(-1)![1]
    )
      points.pop();
    return points;
  };
  const outer = circle(40),
    hole = circle(15).reverse(),
    regions = [
      {
        id: "stepped",
        name: "Stepped ring",
        color: "#ffffff",
        loops: [outer, hole],
        height: 3,
        enabled: true,
      },
    ];
  const g = await generate(
    regions,
    {
      ...newProject().options,
      width: 80,
      backing: "outline",
      border: 6,
      mounting: "counter",
      baseWidth: 100,
      baseDepth: 30,
    },
    "stepped",
  );
  const ring = g.parts.find((p) => p.id === "stepped")!;
  expect(ring.report.volume).toBeCloseTo((area(outer) + area(hole)) * 3, 1);
  expect(ring.report.bodies).toBe(1);
  expect(g.parts.every((p) => p.report.closed)).toBe(true);
  expect(g.mono.report.closed).toBe(true);
});
