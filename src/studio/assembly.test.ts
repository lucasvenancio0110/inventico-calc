// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { importSVG } from "./import";
import { generate } from "./geometry";
import { newProject, parseProject } from "./model";
import { exportPackage } from "./export";
const source = readFileSync("fixtures/synthetic-logo.svg", "utf8");
describe("Assembly and export", () => {
  it.each(["none", "silhouette", "outline", "plate"] as const)(
    "q_leaf_base_assembly_%s",
    async (backing) => {
      const r = importSVG(source);
      const p = newProject();
      p.options = { ...p.options, backing, mounting: "counter" };
      p.regions = r;
      const g = await generate(r, p.options, p.revisionId);
      expect(g.parts[0].id).toBe("base");
      expect(g.parts.every((p) => p.report.closed)).toBe(true);
      expect(g.mono.report.closed).toBe(true);
      const materialVolume = g.parts.reduce(
        (sum, part) => sum + part.report.volume,
        0,
      );
      expect(Math.abs(g.mono.report.volume - materialVolume)).toBeLessThan(
        materialVolume * 0.00001,
      );
      writeFileSync(`fixtures/generated/assembly-${backing}.stl`, g.mono.stl);
      if (backing === "plate")
        writeFileSync(
          "fixtures/generated/assembly-package.zip",
          exportPackage(p, g),
        );
    },
  );
  it("two_colors_share_assembly_origin", async () => {
    const r = importSVG(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="10" height="10" fill="#ff0000"/><rect x="20" y="0" width="10" height="10" fill="#0000ff"/></svg>',
    );
    r[1].height = 5;
    const p = newProject();
    p.options.width = 30;
    p.regions = r;
    const g = await generate(r, p.options, p.revisionId);
    expect(g.parts[0].report.min).toEqual([0, 0, 0]);
    expect(g.parts[1].report.min).toEqual([20, 0, 0]);
    expect(g.parts[1].report.dimensions).toEqual([10, 10, 5]);
    const zip = unzipSync(exportPackage(p, g));
    const manifest = JSON.parse(strFromU8(zip["manifest.json"]));
    expect(manifest.parts).toHaveLength(2);
    expect(manifest.parts[0].color).not.toEqual(manifest.parts[1].color);
    expect(Object.keys(zip).filter((k) => k.endsWith(".stl"))).toHaveLength(3);
  });
  it("letter_dots_are_intentional_components", async () => {
    const r = importSVG(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H10V20H0Z M2 -5H4V-3H2Z M6 -5H8V-3H6Z"/></svg>',
    );
    const g = await generate(r, { ...newProject().options, width: 10 }, "dots");
    expect(g.mono.report.bodies).toBe(3);
  });
  it("narrow_channel_not_silently_closed", async () => {
    const r = importSVG(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H20V20H10.1V5H9.9V20H0Z"/></svg>',
    );
    const g = await generate(
      r,
      { ...newProject().options, width: 20 },
      "channel",
    );
    expect(g.mono.report.volume).toBeCloseTo((400 - 0.2 * 15) * 3, 3);
  });
  it("oversize_does_not_silently_rescale", async () => {
    const r = importSVG(source);
    const g = await generate(
      r,
      { ...newProject().options, width: 300 },
      "large",
    );
    expect(g.mono.report.dimensions[0]).toBeCloseTo(300, 3);
    expect(g.warnings.join(" ")).toContain("excede");
  });
  it("malformed_project_is_rejected", async () => {
    const p = newProject();
    expect(() => parseProject(JSON.stringify({ ...p, units: "cm" }))).toThrow();
    expect(() =>
      parseProject(
        JSON.stringify({ ...p, options: { ...p.options, width: -10 } }),
      ),
    ).toThrow();
    await expect(
      generate(importSVG(source), { ...p.options, width: NaN }, "bad"),
    ).rejects.toThrow();
  });
  it("stale_export_is_blocked", async () => {
    const p = newProject();
    p.regions = importSVG(source);
    const g = await generate(p.regions, p.options, p.revisionId);
    expect(() => exportPackage({ ...p, revisionId: "changed" }, g)).toThrow();
  });
});
