import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { area, LIMITS, hashBytes, type Asset, type Region } from "./model";
const elements = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "line",
  "title",
  "desc",
]);
const attrs = new Set([
  "xmlns",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linejoin",
  "stroke-linecap",
  "id",
  "version",
]);
export function safeSVG(raw: string): string {
  if (
    raw.length > LIMITS.bytes ||
    /<!DOCTYPE|<!ENTITY|<\?|url\s*\(|https?:|javascript:|data:/i.test(
      raw.replace(/xmlns=["']http:\/\/www.w3.org\/2000\/svg["']/g, ""),
    )
  )
    throw Error(
      "SVG contém recurso externo, entidade ou conteúdo não permitido.",
    );
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.tagName !== "svg")
    throw Error("SVG corrompido.");
  let count = 0,
    segments = 0;
  function check(el: Element, depth: number) {
    if (++count > 512 || depth > 20) throw Error("SVG muito complexo.");
    if (!elements.has(el.tagName))
      throw Error(
        el.tagName === "text"
          ? "Converta as letras em curvas; fontes não são substituídas."
          : `Elemento SVG não suportado: ${el.tagName}. Exporte formas com preenchimentos sólidos.`,
      );
    for (const a of Array.from(el.attributes)) {
      if (!attrs.has(a.name))
        throw Error(
          `Atributo SVG não suportado: ${a.name}. Converta estilos em atributos geométricos.`,
        );
      if (
        ["fill", "stroke"].includes(a.name) &&
        !/^(none|#[0-9a-f]{3,8}|[a-z]+|rgb\([\d\s,.%]+\))$/i.test(a.value)
      )
        throw Error("Preenchimento não suportado.");
      if (a.name === "stroke" && a.value !== "none")
        throw Error(
          "Converta os traços (strokes) em contornos antes de importar.",
        );
      if (a.name === "fill-rule" && !["evenodd", "nonzero"].includes(a.value))
        throw Error("Regra de preenchimento inválida.");
      if (["d", "points", "transform"].includes(a.name)) {
        segments += (a.value.match(/[a-z]/gi) || []).length;
        const nums = a.value.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || [];
        if (
          nums.length > 32000 ||
          nums.some((n) => !Number.isFinite(+n) || Math.abs(+n) > 1e5)
        )
          throw Error("Coordenadas SVG excessivas.");
      }
    }
    for (const child of Array.from(el.children)) check(child, depth + 1);
  }
  check(doc.documentElement, 0);
  if (segments > 4000) throw Error("SVG excede 4.000 segmentos.");
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export function importSVG(raw: string): Region[] {
  const safe = safeSVG(raw),
    data = new SVGLoader().parse(safe);
  const regions: Region[] = [];
  let vertices = 0;
  for (const path of data.paths) {
    if ((path.userData?.style as { fill?: string })?.fill === "none") continue;
    const shapes = path.toShapes();
    for (const shape of shapes) {
      const extracted = shape.extractPoints(32);
      const loops = [extracted.shape, ...extracted.holes].map((l, i) => {
        let p = l.map((v) => [v.x, -v.y] as [number, number]);
        if (
          p.length > 1 &&
          p[0][0] === p.at(-1)![0] &&
          p[0][1] === p.at(-1)![1]
        )
          p = p.slice(0, -1);
        if (area(p) > 0 !== (i === 0)) p.reverse();
        return p;
      });
      vertices += loops.reduce((s, l) => s + l.length, 0);
      regions.push({
        id: `region-${regions.length + 1}`,
        name: `Região ${regions.length + 1}`,
        color: "#" + path.color.getHexString(),
        loops,
        height: 3,
        enabled: true,
      });
    }
  }
  if (
    !regions.length ||
    vertices > LIMITS.vertices ||
    regions.length > LIMITS.regions
  )
    throw Error(
      "Contornos vazios ou complexidade excessiva. Simplifique a arte com revisão.",
    );
  return regions;
}
export function imageDimensions(bytes: Uint8Array): {
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
} {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    bytes
      .slice(0, 8)
      .every((x, i) => x === [137, 80, 78, 71, 13, 10, 26, 10][i])
  )
    return {
      mime: "image/png",
      width: v.getUint32(16),
      height: v.getUint32(20),
    };
  if (bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 8 < bytes.length) {
      if (bytes[p] !== 255) break;
      const marker = bytes[p + 1];
      p += 2;
      if (marker === 217 || marker === 218) break;
      const length = v.getUint16(p);
      if (length < 2 || p + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      )
        return {
          mime: "image/jpeg",
          height: v.getUint16(p + 3),
          width: v.getUint16(p + 5),
        };
      p += length;
    }
  }
  throw Error("Arquivo PNG/JPEG corrompido ou formato não aceito.");
}
export async function readAsset(
  file: File,
  role: Asset["role"],
): Promise<Asset> {
  if (file.size > LIMITS.bytes) throw Error("Máximo de 8 MB por arquivo.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await hashBytes(bytes);
  let mime: Asset["mime"], width: number, height: number, data: string;
  if (
    new TextDecoder().decode(bytes.slice(0, 200)).trimStart().startsWith("<")
  ) {
    mime = "image/svg+xml";
    data = safeSVG(new TextDecoder().decode(bytes));
    const regions = importSVG(data);
    const p = regions.flatMap((r) => r.loops.flat());
    width = Math.max(...p.map((v) => v[0])) - Math.min(...p.map((v) => v[0]));
    height = Math.max(...p.map((v) => v[1])) - Math.min(...p.map((v) => v[1]));
  } else {
    const info = imageDimensions(bytes);
    ({ mime, width, height } = info);
    if (
      !width ||
      !height ||
      width > LIMITS.dimension ||
      height > LIMITS.dimension ||
      width * height > LIMITS.pixels
    )
      throw Error("Máximo de 4096 px por lado e 4 milhões de pixels.");
    data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(Error("Falha na leitura."));
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  }
  return { name: file.name, mime, data, hash, width, height, role };
}
export const assetURL = (asset: Asset) =>
  asset.mime === "image/svg+xml"
    ? "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(safeSVG(asset.data))
    : asset.data;
