import { zipSync, strToU8 } from "fflate";
import { bounds, parseProject, type Project } from "./model";
import type { Generated } from "./geometry";
export function slug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 60) || "projeto"
  );
}
export function download(
  data: BlobPart,
  name: string,
  type = "application/octet-stream",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function normalizedSVG(project: Project) {
  const b = bounds(project.regions),
    w = b.maxX - b.minX,
    h = b.maxY - b.minY;
  const shapes = project.regions
    .filter((r) => r.enabled)
    .map(
      (r) =>
        `<path fill="${r.color}" fill-rule="nonzero" d="${r.loops.map((l) => "M" + l.map((p) => `${p[0] - b.minX},${b.maxY - p[1]}`).join(" L") + " Z").join(" ")}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${shapes}</svg>`;
}
export function projectBackup(project: Project) {
  return JSON.stringify(parseProject(JSON.stringify(project)), null, 2);
}
export function exportPackage(project: Project, g: Generated) {
  if (g.revision !== project.revisionId)
    throw Error("Gere a revisão atual antes de baixar.");
  const prefix = "inventico-" + slug(project.name),
    files: Record<string, Uint8Array> = {};
  g.parts.forEach((p) => (files[`${prefix}-${p.id}.stl`] = p.stl));
  files[`${prefix}-monocromatico.stl`] = g.mono.stl;
  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        format: "inventico-stl-package",
        version: 1,
        projectId: project.projectId,
        revision: g.revision,
        units: "mm",
        engine: project.engine,
        origin: "Origem comum do conjunto; não recentralizar cada STL.",
        mounting: project.options.mounting,
        parts: g.parts.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          file: `${prefix}-${p.id}.stl`,
          ...p.report,
        })),
        monochrome: g.mono.report,
        warnings: g.warnings,
      },
      null,
      2,
    ),
  );
  files["projeto.json"] = strToU8(projectBackup(project));
  files["contornos.svg"] = strToU8(normalizedSVG(project));
  files["LEIA-ME.txt"] = strToU8(
    "Inventico — importar os STLs em milímetros como conjunto/partes de um objeto. Preserve a origem e confira alinhamento: alguns fatiadores reposicionam arquivos individuais. Atribua os filamentos no fatiador; STL não contém cor. Para balcão: letreiro deitado e base plana, montagem colada, conferindo todos os apoios. Verifique detalhes, orientação e mesa no fatiador. O arquivo monocromático pode conter vários corpos (veja manifest). Informe peso por material e tempo reais na calculadora. Volume não é consumo. Nenhum G-code é gerado. projeto.json contém fontes e parâmetros; backup financeiro é separado.",
  );
  return zipSync(files, { level: 6 });
}
