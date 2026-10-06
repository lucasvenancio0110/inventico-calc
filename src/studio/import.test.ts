// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { importSVG, safeSVG } from "./import";
import { generate } from "./geometry";
import { newProject } from "./model";
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${body}</svg>`;
describe("SVG import and extrusion integration", () => {
  it("synthetic_multicolor_upload_generates_real_mesh", async () => {
    const r = importSVG(readFileSync("fixtures/synthetic-logo.svg", "utf8"));
    const g = await generate(r, newProject().options, "synthetic");
    expect(g.parts.length).toBe(5);
    writeFileSync("fixtures/generated/synthetic-mono.stl", g.mono.stl);
    g.parts.forEach((p) =>
      writeFileSync(`fixtures/generated/synthetic-${p.id}.stl`, p.stl),
    );
  });
  it.each(["evenodd", "nonzero"])(
    "svg_frame_preserves_hole_%s",
    async (rule) => {
      const r = importSVG(
        svg(
          `<path fill="#123456" fill-rule="${rule}" d="M0 0H40V40H0Z M10 10V30H30V10Z"/>`,
        ),
      );
      const g = await generate(
        r,
        { ...newProject().options, width: 40 },
        "frame-svg",
      );
      expect(r[0].loops).toHaveLength(2);
      expect(g.parts[0].report.volume).toBeCloseTo(3600, 3);
    },
  );
  it.each([
    "<script>alert(1)</script>",
    '<path onclick="alert(1)" d="M0 0H1V1Z"/>',
    '<image href="https://example.org/image.png"/>',
    "<text>ABC</text>",
    '<filter id="x"/>',
    '<path style="fill:url(https://example.org/x)"/>',
  ])("rejects_unsafe_or_unsupported_%s", (body) =>
    expect(() => safeSVG(svg(body))).toThrow(),
  );
  it("rejects_entities_before_parsing", () =>
    expect(() =>
      safeSVG(
        '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///x">]>' + svg("<path/>"),
      ),
    ).toThrow());
});
