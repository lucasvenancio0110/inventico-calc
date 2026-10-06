import { area, LIMITS, type Processing, type Region } from "./model";
// Grid-boundary tracing creates polygons, never one cube per pixel. Only collinear vertices are removed.
export function traceRaster(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: Processing,
): Region[] {
  if (w * h > LIMITS.pixels || data.length !== w * h * 4)
    throw Error("Imagem excessiva ou incompleta.");
  const removed = new Uint8Array(w * h),
    bg = [1, 3, 5].map((i) => parseInt(p.background.slice(i, i + 2), 16));
  const isBackground = (i: number) =>
    Math.max(...bg.map((v, c) => Math.abs(data[i * 4 + c] - v))) <= p.tolerance;
  if (p.removeBackground) {
    const queue: number[] = [];
    const add = (i: number) => {
      if (!removed[i] && isBackground(i)) {
        removed[i] = 1;
        queue.push(i);
      }
    };
    for (let x = 0; x < w; x++) {
      add(x);
      add((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      add(y * w);
      add(y * w + w - 1);
    }
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k],
        x = i % w,
        y = Math.floor(i / w);
      if (x) add(i - 1);
      if (x + 1 < w) add(i + 1);
      if (y) add(i - w);
      if (y + 1 < h) add(i + w);
    }
  }
  const samples: number[][] = [];
  for (let i = 0; i < w * h; i++)
    if (
      !removed[i] &&
      data[i * 4 + 3] >= p.alpha &&
      i % Math.max(1, Math.floor((w * h) / 10000)) === 0
    )
      samples.push(Array.from(data.slice(i * 4, i * 4 + 3)));
  if (!samples.length)
    throw Error("Máscara vazia. Ajuste o fundo ou o limiar de transparência.");
  const dist = (a: number[], b: number[]) =>
    a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  const centers = [samples[0]];
  for (let k = 1; k < p.colors; k++) {
    let best = samples[0],
      score = 0;
    for (const s of samples) {
      const d = Math.min(...centers.map((c) => dist(s, c)));
      if (d > score) {
        score = d;
        best = s;
      }
    }
    if (score < 100) break;
    centers.push(best);
  }
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      const ds = centers.map((c) => dist(s, c));
      const n = ds.indexOf(Math.min(...ds));
      s.forEach((v, i) => (sums[n][i] += v));
      sums[n][3]++;
    }
    sums.forEach((s, i) => {
      if (s[3]) centers[i] = s.slice(0, 3).map((v) => v / s[3]);
    });
  }
  const labels = new Int16Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++)
    if (!removed[i] && data[i * 4 + 3] >= p.alpha) {
      const s = Array.from(data.slice(i * 4, i * 4 + 3)),
        ds = centers.map((c) => dist(s, c));
      labels[i] = ds.indexOf(Math.min(...ds));
    }
  const regions: Region[] = [];
  let vertices = 0;
  centers.forEach((color, label) => {
    const edges = new Map<string, [number, number][]>();
    let edgeCount = 0;
    const edge = (x: number, y: number, a: number, b: number) => {
      const key = x + "," + y;
      const list = edges.get(key) || [];
      list.push([a, b]);
      edges.set(key, list);
      if (++edgeCount > 100000)
        throw Error(
          "Máscara complexa demais. Recorte a marca ou reduza ruído.",
        );
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (labels[i] !== label) continue;
        if (y === 0 || labels[i - w] !== label) edge(x, y, x + 1, y);
        if (x === w - 1 || labels[i + 1] !== label)
          edge(x + 1, y, x + 1, y + 1);
        if (y === h - 1 || labels[i + w] !== label)
          edge(x + 1, y + 1, x, y + 1);
        if (x === 0 || labels[i - 1] !== label) edge(x, y + 1, x, y);
      }
    const loops: [number, number][][] = [];
    while (edges.size) {
      const key = edges.keys().next().value!;
      const start = key.split(",").map(Number) as [number, number];
      let current = start;
      const loop: [number, number][] = [];
      do {
        loop.push([current[0], -current[1]]);
        const k = current.join(","),
          next = edges.get(k);
        if (!next?.length) throw Error("Contorno ambíguo. Ajuste o limiar.");
        current = next.pop()!;
        if (!next.length) edges.delete(k);
        if (loop.length > 100000) throw Error("Contorno excessivo.");
      } while (current[0] !== start[0] || current[1] !== start[1]);
      let simple = loop.filter((b, i) => {
        const a = loop[(i + loop.length - 1) % loop.length],
          c = loop[(i + 1) % loop.length];
        return (b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0]);
      });
      simple = simple.reverse();
      if (simple.length >= 3) {
        vertices += simple.length;
        loops.push(simple);
      }
    }
    if (loops.length)
      regions.push({
        id: `region-${label + 1}`,
        name: `Cor ${label + 1}`,
        color:
          "#" +
          color
            .map((v) => Math.round(v).toString(16).padStart(2, "0"))
            .join(""),
        loops,
        height: 3,
        enabled: true,
      });
  });
  if (vertices > LIMITS.vertices || regions.length > LIMITS.regions)
    throw Error("Muitos detalhes. Use uma arte mais limpa ou ajuste a paleta.");
  if (regions.some((r) => r.loops.some((l) => Math.abs(area(l)) < 0.01)))
    throw Error("Contorno degenerado.");
  return regions;
}
