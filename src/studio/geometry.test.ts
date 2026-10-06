import { describe, it, expect } from "vitest";
import { generate } from "./geometry";
import { newProject, mm } from "./model";
import { traceRaster } from "./trace";
import { writeFileSync, mkdirSync } from "node:fs";
const frame = {
  id: "frame",
  name: "Moldura",
  color: "#663399",
  height: 3,
  enabled: true,
  loops: [
    [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ],
    [
      [10, 10],
      [10, 30],
      [30, 30],
      [30, 10],
    ],
  ] as [number, number][][],
};
describe("STL proof", () => {
  it("svg_frame_preserves_hole", async () => {
    const p = await generate(
      [frame],
      { ...newProject().options, width: 40 },
      "proof",
    );
    expect(p.parts[0].report.volume).toBeCloseTo(3600, 3);
    expect(p.parts[0].report.dimensions).toEqual([40, 40, 3]);
    expect(p.parts[0].report.bodies).toBe(1);
    mkdirSync("fixtures/generated", { recursive: true });
    writeFileSync("fixtures/generated/frame.stl", p.parts[0].stl);
  });
  it("raster_donut_keeps_alpha_hole", async () => {
    const d = new Uint8ClampedArray(40 * 40 * 4);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++)
        if (
          x >= 5 &&
          x < 35 &&
          y >= 5 &&
          y < 35 &&
          !(x >= 15 && x < 25 && y >= 15 && y < 25)
        )
          d.set([255, 255, 255, 255], (y * 40 + x) * 4);
    const r = traceRaster(d, 40, 40, newProject().processing);
    expect(r[0].loops.length).toBe(2);
    const g = await generate(
      r,
      { ...newProject().options, width: 30 },
      "donut",
    );
    expect(g.parts[0].report.volume).toBeCloseTo(2400, 3);
    writeFileSync("fixtures/generated/donut.stl", g.parts[0].stl);
  });
  it("20 cm and decimal comma", async () => {
    expect(mm("20 cm")).toBe(200);
    expect(mm("2,5")).toBe(2.5);
    expect(() => mm("-2")).toThrow();
  });
});
