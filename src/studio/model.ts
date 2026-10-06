import { z } from "zod";
export const ENGINE = "manifold-3.5/inventico-1";
export const TRACE = "boundary-1";
export const LIMITS = {
  bytes: 8_000_000,
  pixels: 4_000_000,
  dimension: 4096,
  vertices: 16000,
  regions: 128,
  triangles: 200000,
};
const finite = z.number().finite();
const point = z.tuple([finite.min(-1e5).max(1e5), finite.min(-1e5).max(1e5)]);
const ident = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const regionSchema = z.object({
  id: ident,
  name: z.string().max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  loops: z.array(z.array(point).min(3).max(LIMITS.vertices)).min(1).max(256),
  height: finite.min(0.2).max(50),
  enabled: z.boolean(),
});
export const optionsSchema = z.object({
  width: finite.min(5).max(1000),
  backing: z.enum(["none", "silhouette", "outline", "plate"]),
  border: finite.min(0).max(30),
  backingHeight: finite.min(0.5).max(30),
  mounting: z.enum(["wall", "counter"]),
  baseWidth: finite.min(5).max(1000),
  baseDepth: finite.min(5).max(200),
  baseHeight: finite.min(1).max(50),
  baseX: finite.min(-500).max(500),
  margin: finite.min(0).max(50),
  nozzle: finite.min(0.1).max(2),
  backingColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#303745"),
  baseColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#e7e1d7"),
  nfcEnabled: z.boolean().default(false),
  nfcDiameter: finite.min(5).max(100).default(25),
  nfcDepth: finite.min(0.2).max(10).default(1),
});
export const processingSchema = z.object({
  alpha: finite.min(1).max(255),
  colors: z.number().int().min(1).max(12),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  removeBackground: z.boolean(),
  tolerance: finite.min(0).max(255),
  crop: z.tuple([
    finite.min(0).max(1),
    finite.min(0).max(1),
    finite.min(0.01).max(1),
    finite.min(0.01).max(1),
  ]),
});
const assetSchema = z.object({
  name: z.string().max(200),
  mime: z.enum(["image/svg+xml", "image/png", "image/jpeg"]),
  data: z.string().max(12_000_000),
  hash: z.string().max(100),
  width: finite.positive().max(4096),
  height: finite.positive().max(4096),
  role: z.enum(["logo", "photo"]),
});
export const conceptSchema = z.object({
  id: ident,
  sourceHash: z.string().max(100),
  image: z
    .string()
    .max(12_000_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/),
  prompt: z.string().max(12000),
  approved: z.boolean(),
  planned: z.boolean(),
  createdAt: z.string().max(50),
});
export type Concept = z.infer<typeof conceptSchema>;
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    engine: z.literal(ENGINE),
    tracing: z.literal(TRACE),
    projectId: ident,
    revisionId: ident,
    parentRevisionId: ident.nullable(),
    name: z.string().min(1).max(100),
    units: z.literal("mm"),
    sourceAssets: z.array(assetSchema).max(2),
    sourceHash: z.string().max(100),
    processing: processingSchema,
    contoursCurrent: z.boolean().default(false),
    workflow: z.enum(["local", "concept"]).default("local"),
    concept: conceptSchema.nullable().default(null),
    conceptHistory: z.array(conceptSchema).max(2).default([]),
    regions: z.array(regionSchema).max(LIMITS.regions),
    options: optionsSchema,
    reviewed: z.boolean(),
    assumptions: z.array(z.string().max(500)).max(30),
  })
  .superRefine((p, c) => {
    if (
      new Set(p.regions.map((r) => r.id)).size !== p.regions.length ||
      p.regions.reduce(
        (s, r) => s + r.loops.reduce((n, l) => n + l.length, 0),
        0,
      ) > LIMITS.vertices
    )
      c.addIssue({
        code: "custom",
        message: "Regiões duplicadas ou complexidade excessiva.",
      });
    if (
      [...(p.concept ? [p.concept] : []), ...p.conceptHistory].some(
        (concept) => concept.sourceHash !== p.sourceHash,
      )
    )
      c.addIssue({
        code: "custom",
        message: "Proposta visual pertence a outra fonte.",
      });
    if (
      p.processing.crop[0] + p.processing.crop[2] > 1.00001 ||
      p.processing.crop[1] + p.processing.crop[3] > 1.00001
    )
      c.addIssue({ code: "custom", message: "Recorte ultrapassa a imagem." });
  });
export type Region = z.infer<typeof regionSchema>;
export type Options = z.infer<typeof optionsSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Processing = z.infer<typeof processingSchema>;
export function newProject(): Project {
  return {
    schemaVersion: 1,
    engine: ENGINE,
    tracing: TRACE,
    projectId: crypto.randomUUID(),
    revisionId: crypto.randomUUID(),
    parentRevisionId: null,
    name: "Minha peça",
    units: "mm",
    sourceAssets: [],
    sourceHash: "",
    contoursCurrent: false,
    workflow: "concept",
    concept: null,
    conceptHistory: [],
    processing: {
      alpha: 128,
      colors: 4,
      background: "#ffffff",
      removeBackground: false,
      tolerance: 35,
      crop: [0, 0, 1, 1],
    },
    regions: [],
    options: optionsSchema.parse({
      width: 200,
      backing: "none",
      border: 2,
      backingHeight: 2,
      mounting: "wall",
      baseWidth: 210,
      baseDepth: 40,
      baseHeight: 5,
      baseX: 0,
      margin: 0,
      nozzle: 0.4,
    }),
    reviewed: false,
    assumptions: [
      "Largura sugerida: 200 mm. Bico de referência: 0,4 mm, não confirmado.",
    ],
  };
}
export function parseProject(raw: string) {
  if (raw.length > 24_000_000) throw Error("Projeto excede 24 MB.");
  return projectSchema.parse(JSON.parse(raw));
}
export function mm(value: string) {
  const m = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm)?$/i);
  if (!m) throw Error("Use uma medida positiva em mm ou cm.");
  return (
    Number(m[1].replace(",", ".")) * (m[2]?.toLowerCase() === "cm" ? 10 : 1)
  );
}
export const area = (loop: number[][]) =>
  loop.reduce((s, p, i) => {
    const q = loop[(i + 1) % loop.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
export function bounds(regions: Region[]) {
  const p = regions.flatMap((r) => r.loops.flat());
  if (!p.length) throw Error("Nenhum contorno encontrado.");
  return {
    minX: Math.min(...p.map((p) => p[0])),
    minY: Math.min(...p.map((p) => p[1])),
    maxX: Math.max(...p.map((p) => p[0])),
    maxY: Math.max(...p.map((p) => p[1])),
  };
}
export const hashBytes = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
