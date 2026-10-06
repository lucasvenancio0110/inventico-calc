import type { Manifold, CrossSection } from "manifold-3d";
import { loadKernel } from "./kernel";
import {
  bounds,
  optionsSchema,
  regionSchema,
  LIMITS,
  area,
  type Region,
  type Options,
} from "./model";
export type Report = {
  volume: number;
  dimensions: number[];
  min: number[];
  max: number[];
  triangles: number;
  bodies: number;
  closed: boolean;
};
export type Part = {
  id: string;
  name: string;
  color: string;
  stl: Uint8Array<ArrayBuffer>;
  report: Report;
};
export type Generated = {
  revision: string;
  parts: Part[];
  mono: Part;
  warnings: string[];
};
export function inspectSTL(bytes: Uint8Array): Report {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 84) throw Error("STL truncado.");
  const count = d.getUint32(80, true);
  if (count > LIMITS.triangles || 84 + count * 50 !== bytes.length)
    throw Error("STL inválido ou excessivo.");
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity],
    edges = new Map<
      string,
      { count: number; balance: number; faces: number[] }
    >(),
    parent = Array.from({ length: count }, (_, i) => i);
  let volume = 0;
  const buckets = new Map<string, { point: number[]; id: string }[]>();
  let nextId = 0;
  const weld = (v: number[]) => {
    const cell = v.map((x) => Math.floor(x / 1e-5));
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const list = buckets.get(
            [cell[0] + x, cell[1] + y, cell[2] + z].join(","),
          );
          const match = list?.find(
            (a) => Math.hypot(...a.point.map((p, i) => p - v[i])) <= 1e-5,
          );
          if (match) return match.id;
        }
    const key = cell.join(","),
      id = String(nextId++);
    const list = buckets.get(key) || [];
    list.push({ point: v, id });
    buckets.set(key, list);
    return id;
  };
  const root = (a: number): number =>
    parent[a] === a ? a : (parent[a] = root(parent[a]));
  for (let i = 0; i < count; i++) {
    const p = Array.from({ length: 3 }, (_, v) =>
      Array.from({ length: 3 }, (_, a) =>
        d.getFloat32(84 + i * 50 + 12 + v * 12 + a * 4, true),
      ),
    );
    if (p.flat().some((x) => !Number.isFinite(x)))
      throw Error("Coordenada não finita.");
    p.forEach((v) =>
      v.forEach((x, a) => {
        min[a] = Math.min(min[a], x);
        max[a] = Math.max(max[a], x);
      }),
    );
    const [a, b, c] = p;
    const cross = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ];
    if (Math.hypot(...cross) < 1e-10)
      throw Error(
        "Triângulo degenerado: revise contornos muito finos ou contatos sem área.",
      );
    volume +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
    const keys = p.map(weld);
    for (let e = 0; e < 3; e++) {
      const x = keys[e],
        y = keys[(e + 1) % 3],
        key = x < y ? x + "|" + y : y + "|" + x;
      const old = edges.get(key) || { count: 0, balance: 0, faces: [] };
      old.count++;
      old.balance += x < y ? 1 : -1;
      old.faces.push(i);
      edges.set(key, old);
    }
  }
  let closed = true;
  for (const e of edges.values()) {
    if (e.count !== 2 || e.balance !== 0) closed = false;
    for (const f of e.faces.slice(1)) parent[root(f)] = root(e.faces[0]);
  }
  if (!closed || volume <= 1e-8)
    throw Error(
      "Malha não fechada/orientada ou volume não positivo. Revise contatos entre contornos, vazios e detalhes muito finos.",
    );
  return {
    volume,
    dimensions: max.map((v, i) => v - min[i]),
    min,
    max,
    triangles: count,
    bodies: new Set(parent.map((_, i) => root(i))).size,
    closed,
  };
}
function encode(solid: Manifold): Uint8Array<ArrayBuffer> {
  if (solid.status() !== "NoError")
    throw Error("O motor rejeitou o sólido: " + solid.status());
  const mesh = solid.getMesh(),
    count = mesh.triVerts.length / 3;
  if (count > LIMITS.triangles) throw Error("Malha excede 200.000 triângulos.");
  const bytes = new Uint8Array(84 + 50 * count),
    view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("Inventico STL mm"));
  view.setUint32(80, count, true);
  for (let i = 0; i < count; i++) {
    const points = [0, 1, 2].map((k) => {
      const index = mesh.triVerts[i * 3 + k] * mesh.numProp;
      return Array.from(mesh.vertProperties.slice(index, index + 3));
    });
    const [a, b, c] = points;
    const n = [
        (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
        (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
      ],
      len = Math.hypot(...n);
    const floats = [...n.map((v) => v / len), ...points.flat()];
    floats.forEach((v, k) => view.setFloat32(84 + i * 50 + k * 4, v, true));
  }
  return bytes;
}
export async function generate(
  regions: Region[],
  input: Options,
  revision: string,
): Promise<Generated> {
  const o = optionsSchema.parse(input);
  regions = regions.map((r) => regionSchema.parse(r)).filter((r) => r.enabled);
  if (
    regions.length > LIMITS.regions ||
    regions.reduce((s, r) => s + r.loops.reduce((n, l) => n + l.length, 0), 0) >
      LIMITS.vertices
  )
    throw Error("Contornos excessivos.");
  if (
    o.nfcEnabled &&
    (o.mounting !== "counter" ||
      o.nfcDepth > o.baseHeight - 0.6 ||
      o.nfcDiameter > Math.min(o.baseWidth, o.baseDepth) - 2)
  )
    throw Error(
      "Alojamento NFC exige base de balcão, pelo menos 0,6 mm de teto e 1 mm de borda lateral.",
    );
  const b = bounds(regions),
    scale = o.width / (b.maxX - b.minX);
  if (!Number.isFinite(scale) || b.maxY === b.minY)
    throw Error("Contorno sem área.");
  const kernel = await loadKernel(),
    { CrossSection: CS, Manifold: MF } = kernel;
  const handles: (CrossSection | Manifold)[] = [];
  const keep = <T extends CrossSection | Manifold>(v: T): T => {
    handles.push(v);
    return v;
  };
  try {
    const planar = regions.map((r) =>
      keep(
        new CS(
          r.loops.map((l) =>
            l.map(
              (p) =>
                [(p[0] - b.minX) * scale, (p[1] - b.minY) * scale] as [
                  number,
                  number,
                ],
            ),
          ),
          "NonZero",
        ),
      ),
    );
    const all = keep(CS.union(planar));
    let backing: CrossSection | undefined;
    if (o.backing === "silhouette") backing = all;
    if (o.backing === "outline")
      backing = o.border > 0 ? keep(all.offset(o.border, "Round", 2, 32)) : all;
    if (o.backing === "plate")
      backing = keep(
        keep(
          CS.square([
            o.width + 2 * o.border,
            (b.maxY - b.minY) * scale + 2 * o.border,
          ]),
        ).translate([-o.border, -o.border]),
      );
    const lowest = backing ? backing.bounds().min[1] : 0;
    const assemblyZ = o.baseHeight - lowest;
    const solids: {
      id: string;
      name: string;
      color: string;
      solid: Manifold;
    }[] = [];
    const painted: CrossSection[] = [];
    if (backing)
      solids.push({
        id: "backing",
        name: "Fundo de apoio",
        color: o.backingColor,
        solid: keep(backing.extrude(o.backingHeight)),
      });
    regions.forEach((r, i) => {
      const above = planar.slice(i + 1);
      const shape = above.length
        ? keep(planar[i].subtract(keep(CS.union(above))))
        : planar[i];
      painted.push(shape);
      if (shape.isEmpty()) return;
      solids.push({
        id: r.id,
        name: r.name,
        color: r.color,
        solid: keep(
          keep(shape.extrude(r.height)).translate([
            0,
            0,
            backing ? o.backingHeight : 0,
          ]),
        ),
      });
    });
    // Union the planar footprint at each height before extrusion. This avoids
    // coincident internal faces where different material meshes share a boundary.
    const heights = [...new Set(regions.map((r) => r.height))].sort(
      (a, b) => a - b,
    );
    const monoLayers: Manifold[] = [];
    if (backing) monoLayers.push(keep(backing.extrude(o.backingHeight)));
    let previous = 0;
    for (const height of heights) {
      const active = painted.filter((_, i) => regions[i].height >= height);
      const footprint = height === heights[0] ? all : keep(CS.union(active));
      if (!footprint.isEmpty())
        monoLayers.push(
          keep(
            keep(footprint.extrude(height - previous)).translate([
              0,
              0,
              previous + (backing ? o.backingHeight : 0),
            ]),
          ),
        );
      previous = height;
    }
    let monoSolid = keep(MF.union(monoLayers));
    if (o.mounting === "counter") {
      solids.forEach((s) => {
        s.solid = keep(
          keep(s.solid.rotate([90, 0, 0])).translate([
            o.baseX + (o.baseWidth - o.width) / 2,
            o.baseDepth / 2 + (backing ? o.backingHeight : 0) / 2,
            assemblyZ,
          ]),
        );
      });
      let base = keep(MF.cube([o.baseWidth, o.baseDepth, o.baseHeight]));
      if (o.nfcEnabled)
        base = keep(
          base.subtract(
            keep(
              keep(
                MF.cylinder(
                  o.nfcDepth,
                  o.nfcDiameter / 2,
                  o.nfcDiameter / 2,
                  64,
                ),
              ).translate([o.baseWidth / 2, o.baseDepth / 2, 0]),
            ),
          ),
        );
      solids.unshift({
        id: "base",
        name: "Base de balcão (colar)",
        color: o.baseColor,
        solid: base,
      });
      monoSolid = keep(
        MF.union([
          keep(
            keep(monoSolid.rotate([90, 0, 0])).translate([
              o.baseX + (o.baseWidth - o.width) / 2,
              o.baseDepth / 2 + (backing ? o.backingHeight : 0) / 2,
              assemblyZ,
            ]),
          ),
          solids[0].solid,
        ]),
      );
    }
    const topology = (solid: Manifold) => {
      const bodies = solid.decompose();
      try {
        return bodies
          .map((body) => body.genus())
          .sort((a, b) => a - b)
          .join(",");
      } finally {
        bodies.forEach((body) => body.delete());
      }
    };
    const stabilized = (solid: Manifold) => {
      const simplified = keep(solid.simplify(0.0001));
      if (
        topology(solid) !== topology(simplified) ||
        Math.abs(solid.volume() - simplified.volume()) >
          Math.max(1e-5, solid.surfaceArea() * 0.0001)
      )
        throw Error(
          "Regularização numérica alteraria corpos, furos ou volume. Revise a arte.",
        );
      return simplified;
    };
    const parts = solids.map((s) => {
      const stl = encode(stabilized(s.solid));
      try {
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          stl,
          report: inspectSTL(stl),
        };
      } catch (e) {
        throw Error(s.name + ": " + (e as Error).message);
      }
    });
    monoSolid = stabilized(monoSolid);
    const monoBytes = encode(monoSolid);
    const mono = {
      id: "mono",
      name: "Monocromático",
      color: "#c4b5fd",
      stl: monoBytes,
      report: inspectSTL(monoBytes),
    };
    const warnings: string[] = [
      "Triangulação regularizada com tolerância de 0,0001 mm para exportação STL; quantidade de corpos e furos preservada.",
    ];
    if (
      o.mounting === "wall" &&
      mono.report.dimensions.slice(0, 2).some((v) => v + 2 * o.margin > 250)
    )
      warnings.push(
        "Conjunto alinhado excede a mesa de 250 × 250 mm. Confira os componentes separados; nenhuma escala foi reduzida.",
      );
    for (const p of parts) {
      const dims =
        o.mounting === "counter" && p.id !== "base"
          ? [p.report.dimensions[0], p.report.dimensions[2]]
          : p.report.dimensions.slice(0, 2);
      if (dims.some((v) => v + 2 * o.margin > 250))
        warnings.push(
          `${p.name}: excede a mesa útil de 250 × 250 mm na orientação de impressão plana.`,
        );
      if (p.report.bodies > 1)
        warnings.push(
          `${p.name}: ${p.report.bodies} corpos separados; preserve todos na montagem.`,
        );
    }
    if (mono.report.bodies > 1)
      warnings.push(
        `Conjunto com ${mono.report.bodies} corpos: precisa de montagem/apoio; não é uma peça única.`,
      );
    if (o.mounting === "counter")
      warnings.push(
        "Montagem colada: confira apoio de cada ilha. Elementos suspensos precisam de fundo comum ou suporte externo; estabilidade e cola não certificadas. Imprima o letreiro deitado e a base plana.",
      );
    if (o.backing === "outline")
      warnings.push(
        "Contorno expandido pode unir regiões ou fechar vazios do apoio. Compare a prévia antes de baixar.",
      );
    for (const r of regions) {
      const a =
        Math.abs(r.loops.reduce((s, l) => s + area(l), 0)) * scale * scale;
      const perimeter =
        r.loops.reduce(
          (s, l) =>
            s +
            l.reduce(
              (t, p, i) =>
                t +
                Math.hypot(
                  p[0] - l[(i + 1) % l.length][0],
                  p[1] - l[(i + 1) % l.length][1],
                ),
              0,
            ),
          0,
        ) * scale;
      if ((2 * a) / perimeter < o.nozzle * 2)
        warnings.push(
          `${r.name}: área/perímetro indica detalhe fino; referência de bico ${o.nozzle} mm. Heurística não detecta todos os canais.`,
        );
    }
    return { revision, parts, mono, warnings };
  } finally {
    for (const handle of handles.reverse()) handle.delete();
  }
}
