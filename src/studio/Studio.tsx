import { useEffect, useRef, useState } from "react";
import {
  Box,
  Upload,
  Save,
  Download,
  FolderOpen,
  WandSparkles,
  X,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  newProject,
  parseProject,
  bounds,
  mm,
  area,
  type Project,
  type Region,
  type Asset,
  type Options,
} from "./model";
import { readAsset, importSVG, assetURL } from "./import";
import {
  download,
  exportPackage,
  normalizedSVG,
  projectBackup,
  slug,
} from "./export";
import {
  listProjects,
  saveProject,
  deleteProject,
  type StoredProject,
} from "./storage";
import { Preview } from "./Preview";
import type { Generated } from "./geometry";
import { endpointURL, validatePlan, type Plan } from "./ai";
import { Numeric, TextField, num } from "../components/ui";
import type { Filament, Item } from "../types";
import { ConceptStage } from "./ConceptStage";
import "./studio.css";
export type FinanceTransfer = {
  name: string;
  grams: number;
  filamentId: string;
  hours: number;
  minutes: number;
  components: Item[];
  notes: string;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Falha inesperada. Tente novamente.";
function safeError(e: unknown) {
  return message(e).length > 500
    ? "Dados inválidos: confira os valores, versões e limites do projeto."
    : message(e);
}
function Source({ asset }: { asset: Asset }) {
  return (
    <figure className="studio-source">
      <img
        src={assetURL(asset)}
        alt={
          asset.role === "logo"
            ? "Logo original enviada"
            : "Foto de referência enviada"
        }
      />
      <figcaption>
        {asset.name} · {Math.round(asset.width)} × {Math.round(asset.height)} ·{" "}
        {asset.role === "logo" ? "arte original" : "foto, extração revisável"}
      </figcaption>
    </figure>
  );
}
function Contours({ regions }: { regions: Region[] }) {
  if (!regions.length)
    return (
      <div className="studio-empty">
        Os contornos aparecem após o processamento.
      </div>
    );
  const b = bounds(regions),
    w = b.maxX - b.minX,
    h = b.maxY - b.minY;
  return (
    <svg
      className="studio-contours"
      viewBox={`${b.minX - 2} ${-b.maxY - 2} ${w + 4} ${h + 4}`}
      role="img"
      aria-label="Contornos extraídos com furos e cores"
    >
      <g transform="scale(1,-1)">
        {regions
          .filter((r) => r.enabled)
          .map((r) => (
            <path
              key={r.id}
              fill={r.color}
              fillRule="nonzero"
              stroke="#9aa5b5"
              strokeWidth={Math.max(w, h) / 1000}
              d={r.loops
                .map((l) => "M" + l.map((p) => p.join(",")).join(" L") + " Z")
                .join(" ")}
            />
          ))}
      </g>
    </svg>
  );
}
export default function Studio({
  view,
  onView,
  filaments,
  onFinance,
}: {
  view: "create" | "projects";
  onView: (v: "create" | "projects") => void;
  filaments: Filament[];
  onFinance: (data: FinanceTransfer) => void;
}) {
  const [project, setProject] = useState<Project>(newProject),
    [simple, setSimple] = useState(true),
    [generated, setGenerated] = useState<Generated | null>(null),
    [busy, setBusy] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [records, setRecords] = useState<StoredProject[]>([]),
    [component, setComponent] = useState("all"),
    [original, setOriginal] = useState<Region[] | null>(null),
    [contoursCurrent, setContoursCurrent] = useState(true),
    [pendingImport, setPendingImport] = useState<Project | null>(null),
    [endpoint, setEndpoint] = useState(
      import.meta.env.VITE_AI_ENDPOINT || "http://127.0.0.1:8787",
    ),
    [serviceReady, setServiceReady] = useState(false),
    [accessToken, setAccessToken] = useState(""),
    [aiDescription, setAiDescription] = useState(""),
    [plan, setPlan] = useState<Plan | null>(null),
    [consent, setConsent] = useState(false),
    [finance, setFinance] = useState<
      Record<string, { grams: number; filamentId: string }>
    >({}),
    [hours, setHours] = useState(0),
    [minutes, setMinutes] = useState(0),
    [newSimulation, setNewSimulation] = useState(false);
  const current = useRef(project),
    worker = useRef<Worker | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saved = useRef<string | null>(null),
    job = useRef(0),
    uploads = useRef(0),
    aiAbort = useRef<AbortController | null>(null);
  current.current = project;
  const fresh = generated?.revision === project.revisionId;
  const approvedModel = project.modelApprovalRevision;
  function approveModel() {
    if (!fresh || busy) return;
    const approved = {
      ...current.current,
      modelApprovalRevision: current.current.revisionId,
    };
    current.current = approved;
    setProject(approved);
    setStatus("3D confirmado. Baixe seu STL ou salve o projeto.");
  }
  const source = project.sourceAssets.find(
    (a) => a.hash === project.sourceHash,
  );
  const cancel = () => {
    job.current++;
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    aiAbort.current?.abort();
    aiAbort.current = null;
    setBusy("");
  };
  useEffect(
    () => () => {
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
      aiAbort.current?.abort();
    },
    [],
  );
  const refresh = async () => {
    try {
      setRecords(await listProjects());
    } catch (e) {
      setError(safeError(e));
    }
  };
  useEffect(() => {
    if (view === "projects") void refresh();
  }, [view]);
  function edit(patch: Partial<Project>, reviewInvalid = false) {
    cancel();
    const old = current.current;
    const next = {
      ...old,
      ...patch,
      parentRevisionId: old.revisionId,
      revisionId: crypto.randomUUID(),
      reviewed: reviewInvalid ? false : (patch.reviewed ?? old.reviewed),
    };
    current.current = next;
    setProject(next);
    setPlan(null);
    setStatus(
      "Alterações ainda não salvas. Gere novamente para atualizar os arquivos.",
    );
  }
  function options(patch: Partial<Options>) {
    edit({ options: { ...current.current.options, ...patch } });
  }
  function processing(patch: Partial<Project["processing"]>) {
    setContoursCurrent(false);
    edit(
      {
        processing: { ...current.current.processing, ...patch },
        contoursCurrent: false,
      },
      true,
    );
  }
  function runWorker(
    kind: string,
    payload: unknown,
    revision: string,
    onResult: (value: unknown) => void,
  ) {
    cancel();
    const id = ++job.current;
    setBusy(
      kind === "trace"
        ? "Extraindo contornos…"
        : "Gerando e validando sólidos…",
    );
    setError("");
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    timer.current = setTimeout(() => {
      if (id === job.current) {
        cancel();
        setError(
          "Operação excedeu 45 segundos. Reduza a complexidade ou recorte a fonte.",
        );
      }
    }, 45000);
    w.onerror = () => {
      if (id === job.current) {
        cancel();
        setError("Falha no processamento. Tente um arquivo menor.");
      }
    };
    w.onmessage = (e) => {
      if (
        e.data.id !== id ||
        e.data.revision !== current.current.revisionId ||
        id !== job.current
      )
        return;
      w.terminate();
      worker.current = null;
      if (timer.current) clearTimeout(timer.current);
      setBusy("");
      if (e.data.error) {
        setError(e.data.error);
        return;
      }
      onResult(e.data.result);
    };
    w.postMessage({ id, revision, kind, payload });
  }
  async function upload(file: File | undefined, role: Asset["role"]) {
    if (!file) return;
    const sequence = ++uploads.current;
    setError("");
    setBusy("Lendo arquivo local…");
    try {
      const asset = await readAsset(file, role);
      if (sequence !== uploads.current) return;
      const old = current.current;
      const assets = [
        ...old.sourceAssets.filter((a) => a.role !== role),
        asset,
      ];
      if (role === "logo") {
        const regions =
          asset.mime === "image/svg+xml" ? importSVG(asset.data) : [];
        edit(
          {
            sourceAssets: assets,
            sourceHash: asset.hash,
            concept: null,
            conceptHistory: [],
            contoursCurrent: asset.mime === "image/svg+xml",
            regions,
            processing: {
              ...old.processing,
              crop: [0, 0, 1, 1],
              removeBackground: false,
            },
          },
          true,
        );
        setOriginal(regions);
        setContoursCurrent(asset.mime === "image/svg+xml");
        setStatus(
          asset.mime === "image/svg+xml"
            ? "SVG importado. Compare os contornos e confirme a revisão."
            : "Imagem local carregada. Ajuste o recorte/fundo e extraia os contornos.",
        );
      } else {
        edit({ sourceAssets: assets });
        setStatus(
          "Foto de referência local carregada. Use-a para orientar a montagem ou extraia a marca com revisão.",
        );
      }
    } catch (e) {
      setError(safeError(e));
    } finally {
      if (sequence === uploads.current) setBusy("");
    }
  }
  async function extract(onDone?: () => void) {
    const p = current.current,
      a = p.sourceAssets.find((a) => a.hash === p.sourceHash);
    if (!a) return;
    setError("");
    try {
      if (a.mime === "image/svg+xml") {
        const r = importSVG(a.data);
        edit({ regions: r, contoursCurrent: true }, true);
        setOriginal(r);
        setContoursCurrent(true);
        onDone?.();
        return;
      }
      setBusy("Preparando o recorte…");
      const response = await fetch(assetURL(a));
      const bitmap = await createImageBitmap(await response.blob());
      if (p.revisionId !== current.current.revisionId) {
        bitmap.close();
        return;
      }
      const [x, y, cw, ch] = p.processing.crop;
      if (x + cw > 1.00001 || y + ch > 1.00001) {
        bitmap.close();
        throw Error("Recorte ultrapassa a imagem. Ajuste posição e tamanho.");
      }
      const w = Math.max(1, Math.round(bitmap.width * cw)),
        h = Math.max(1, Math.round(bitmap.height * ch));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        bitmap.close();
        throw Error("Não foi possível preparar a imagem.");
      }
      context.drawImage(
        bitmap,
        x * bitmap.width,
        y * bitmap.height,
        cw * bitmap.width,
        ch * bitmap.height,
        0,
        0,
        w,
        h,
      );
      bitmap.close();
      const data = context.getImageData(0, 0, w, h).data;
      canvas.width = canvas.height = 1;
      let traceProcessing = p.processing;
      let automaticBackground: number[] | null = null;
      if (onDone && simple) {
        const counts = new Map<string, number>();
        let samples = 0;
        for (let i = 0; i < data.length; i += 256) {
          if (data[i + 3] < p.processing.alpha) continue;
          const key = [data[i], data[i + 1], data[i + 2]]
            .map((v) => Math.round(v / 32))
            .join(",");
          counts.set(key, (counts.get(key) ?? 0) + 1);
          samples++;
        }
        const colors = Math.max(
          1,
          Math.min(
            12,
            [...counts.values()].filter((n) => n > samples * 0.01).length,
          ),
        );
        traceProcessing = { ...p.processing, colors };
      }
      if (onDone && simple && !p.processing.removeBackground) {
        const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((i) =>
          Array.from(data.slice(i * 4, i * 4 + 4)),
        );
        if (
          corners.every(
            (c) =>
              c[3] >= p.processing.alpha &&
              c.slice(0, 3).every((v, i) => Math.abs(v - corners[0][i]) <= 8),
          )
        ) {
          const background =
            "#" +
            corners[0]
              .slice(0, 3)
              .map((v) => v.toString(16).padStart(2, "0"))
              .join("");
          traceProcessing = {
            ...traceProcessing,
            background,
          };
          automaticBackground = corners[0].slice(0, 3);
        }
      }
      runWorker(
        "trace",
        { data, width: w, height: h, processing: traceProcessing },
        p.revisionId,
        (value) => {
          const r = (value as Region[]).map((region) => {
            const rgb = [1, 3, 5].map((i) =>
              parseInt(region.color.slice(i, i + 2), 16),
            );
            return automaticBackground &&
              rgb.every(
                (v, i) =>
                  Math.abs(v - automaticBackground![i]) <=
                  p.processing.tolerance,
              )
              ? { ...region, enabled: false }
              : region;
          });
          edit(
            {
              regions: r,
              processing: traceProcessing,
              contoursCurrent: true,
              assumptions: [
                ...p.assumptions.filter((s) => !s.startsWith("Tracing:")),
                ...(automaticBackground
                  ? [
                      "Região de fundo uniforme desativada automaticamente, preservando os vazios internos. Confira a prévia; reative a região em Ajustar detalhes se necessário.",
                    ]
                  : []),
                `Tracing: borda de pixels, somente vértices colineares removidos; desvio de até um pixel (${num(p.options.width / w, 3)} mm na largura atual). Fonte ${a.role === "photo" ? "fotográfica, com escala e profundidade informadas/sugeridas" : "raster"}.`,
              ],
            },
            true,
          );
          setOriginal(r);
          setContoursCurrent(true);
          setStatus(
            "Contornos extraídos. Confira furos, letras, pingos e cores antes de gerar.",
          );
          onDone?.();
        },
      );
    } catch (e) {
      setBusy("");
      setError(safeError(e));
    }
  }
  function generate() {
    const p = current.current;
    if (!p.reviewed || !p.contoursCurrent) return;
    if (
      p.workflow === "concept" &&
      (!p.concept?.approved || !p.concept.planned)
    ) {
      setError(
        "Aprove a proposta visual e confirme o plano de medidas antes de gerar.",
      );
      return;
    }
    runWorker(
      "generate",
      { regions: p.regions, options: p.options },
      p.revisionId,
      (value) => {
        setGenerated(value as Generated);
        setComponent("all");
        setStatus(
          "Sólidos gerados e validados. Downloads correspondem a esta revisão.",
        );
      },
    );
  }
  async function save() {
    try {
      const p = current.current;
      const result = await saveProject(
        { ...p, contoursCurrent },
        generated,
        saved.current,
      );
      saved.current = result.savedRevision;
      setStatus(
        p.revisionId === current.current.revisionId
          ? "Projeto salvo neste navegador. Exporte um backup para protegê-lo."
          : "Revisão anterior salva; há novas alterações pendentes.",
      );
      await refresh();
    } catch (e) {
      setError(safeError(e));
    }
  }
  function openRecord(record: StoredProject) {
    try {
      const p = parseProject(JSON.stringify(record.draft));
      cancel();
      setProject(p);
      current.current = p;
      saved.current = record.savedRevision;
      setGenerated(record.mesh?.revision === p.revisionId ? record.mesh : null);
      setOriginal(structuredClone(p.regions));
      setContoursCurrent(p.contoursCurrent);
      setError("");
      setStatus(
        "Projeto reaberto. A revisão validada anterior fica disponível na lista.",
      );
      onView("create");
    } catch (e) {
      setError(
        "Versão incompatível. Exporte o registro anterior pela lista antes de migrar. " +
          safeError(e),
      );
    }
  }
  function startNew() {
    cancel();
    const p = newProject();
    setProject(p);
    current.current = p;
    setGenerated(null);
    setOriginal(null);
    setContoursCurrent(true);
    saved.current = null;
    setError("");
    setStatus("Novo projeto iniciado.");
    onView("create");
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 24_000_000) throw Error("Projeto excede 24 MB.");
      const p = parseProject(await file.text());
      for (const a of p.sourceAssets) {
        if (a.mime === "image/svg+xml") importSVG(a.data);
        else if (!a.data.startsWith("data:" + a.mime + ";base64,"))
          throw Error("Asset do projeto inválido.");
      }
      setPendingImport(p);
      setError("");
    } catch (e) {
      setError(safeError(e));
    }
  }
  async function checkService() {
    try {
      const url = endpointURL(endpoint);
      const response = await fetch(url + "/health", {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      if (!response.ok || data.configured !== true)
        throw Error(
          "Serviço não configurado. Defina a chave e o modelo no servidor.",
        );
      setServiceReady(true);
      setStatus(
        "Serviço de IA configurado. As imagens só serão enviadas ao acionar a análise.",
      );
    } catch (e) {
      setServiceReady(false);
      setError(safeError(e));
    }
  }
  async function analyze(automatic = false) {
    if (!consent || !serviceReady) return;
    const p = current.current;
    cancel();
    const controller = new AbortController();
    aiAbort.current = controller;
    setBusy("Analisando com IA…");
    setError("");
    try {
      const images = [];
      for (const a of p.sourceAssets) {
        const image = new Image();
        image.src = assetURL(a);
        await image.decode();
        const canvas = document.createElement("canvas");
        const scale = Math.min(
          1,
          1200 / Math.max(image.naturalWidth, image.naturalHeight),
        );
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas
          .getContext("2d")!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        images.push({ role: a.role, data: canvas.toDataURL("image/png") });
        canvas.width = canvas.height = 1;
      }
      if (p.workflow === "concept" && p.concept?.approved)
        images.push({ role: "concept", data: p.concept.image });
      const timeout = setTimeout(() => controller.abort(), 180000);
      try {
        const response = await fetch(endpointURL(endpoint) + "/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
          },
          body: JSON.stringify({
            images,
            description: aiDescription,
            regionIds: p.regions.map((r) => r.id),
          }),
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.error || "Serviço indisponível.");
        const proposal = validatePlan(
          body,
          p.regions.map((r) => r.id),
        );
        if (
          p.revisionId === current.current.revisionId &&
          !controller.signal.aborted
        ) {
          setPlan(proposal);
          setStatus("Proposta recebida. Revise antes de aplicar.");
          if (automatic) {
            if (proposal.status !== "proposal") {
              setError(proposal.questions.join(" ") || proposal.summary);
            } else {
              aiAbort.current = null;
              setBusy("");
              applyPlan(proposal, true);
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      if (p.revisionId === current.current.revisionId) setError(safeError(e));
    } finally {
      if (aiAbort.current === controller) {
        aiAbort.current = null;
        setBusy("");
      }
    }
  }
  function applyPlan(proposal = plan, automatic = false) {
    if (!proposal || proposal.status !== "proposal") return;
    const active = current.current;
    edit(
      {
        options: {
          ...active.options,
          mounting: proposal.mounting,
          backing: proposal.backing,
          width: automatic
            ? active.options.width
            : (proposal.targetWidthMm ?? active.options.width),
          backingColor: proposal.supportColor ?? active.options.backingColor,
          baseColor: proposal.baseColor ?? active.options.baseColor,
        },
        concept: active.concept?.approved
          ? { ...active.concept, planned: true }
          : active.concept,
        regions: active.regions.map((r) => ({
          ...r,
          height:
            proposal.layers.find((l) => l.regionId === r.id)?.heightMm ??
            r.height,
          color:
            proposal.palette.find((c) => c.regionId === r.id)?.color ?? r.color,
        })),
        assumptions: [...active.assumptions, ...proposal.assumptions].slice(
          -30,
        ),
      },
      true,
    );
    setStatus(
      "Proposta aplicada como nova revisão. Confira os contornos e confirme.",
    );
    if (automatic) {
      edit({ reviewed: true });
      generate();
    }
  }
  async function createSimple() {
    if (!source || busy) return;
    const hasReference = current.current.sourceAssets.some(
      (a) => a.role === "photo",
    );
    if (hasReference && (!serviceReady || !consent || !accessToken)) {
      setError(
        "Para usar sua referência automaticamente, conecte a IA e autorize o envio em ‘Conectar IA’. A chave OpenAI precisa estar configurada no Cloudflare.",
      );
      return;
    }
    const p = current.current;
    edit({
      workflow: "local",
      reviewed: true,
      options: {
        ...p.options,
        backing: p.options.backing === "none" ? "outline" : p.options.backing,
        border: Math.max(p.options.border, 6),
        baseWidth: p.options.width + 10,
      },
      assumptions: [
        ...p.assumptions,
        "Prévia automática: confira contornos, dimensões e montagem antes de confirmar o 3D.",
      ].slice(-30),
    });
    const next = () => {
      edit({ reviewed: true });
      if (hasReference) void analyze(true);
      else generate();
    };
    if (!current.current.contoursCurrent) await extract(next);
    else next();
  }
  function transfer() {
    try {
      if (!fresh || !generated || !newSimulation)
        throw Error("Gere a revisão atual e escolha criar uma nova simulação.");
      const lines = generated.parts.map((part) => ({
        part,
        ...finance[part.id],
      }));
      if (
        lines.some(
          (l) =>
            !Number.isFinite(l.grams) ||
            l.grams < 0 ||
            !filaments.some((f) => f.id === l.filamentId),
        )
      )
        throw Error("Informe massa real e filamento de cada componente.");
      if (
        !Number.isFinite(hours) ||
        hours < 0 ||
        !Number.isFinite(minutes) ||
        minutes < 0 ||
        minutes > 59
      )
        throw Error("Tempo inválido.");
      const first = lines[0];
      const components = lines.slice(1).map((l) => {
        const f = filaments.find((f) => f.id === l.filamentId)!;
        return {
          id: crypto.randomUUID(),
          name: `Filamento ${l.part.name} — ${l.grams} g de ${f.name}`,
          quantity: 1,
          cost: (l.grams * (f.price + f.shipping + f.extra)) / f.weight,
          scope: "job" as const,
        };
      });
      onFinance({
        name: project.name,
        grams: first.grams,
        filamentId: first.filamentId,
        hours,
        minutes,
        components,
        notes:
          "Projeto 3D " +
          project.projectId +
          "; revisão " +
          project.revisionId +
          ". Dados reais do fatiador: " +
          lines.map((l) => `${l.part.name}: ${l.grams} g`).join("; ") +
          ". Materiais adicionais discriminados como componentes de custo do lote.",
      });
    } catch (e) {
      setError(safeError(e));
    }
  }
  const updateRegion = (id: string, patch: Partial<Region>) =>
    edit({
      regions: project.regions.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    });
  const totalArea = project.regions
    .filter((r) => r.enabled)
    .reduce(
      (s, r) => s + Math.abs(r.loops.reduce((s, l) => s + area(l), 0)),
      0,
    );
  return (
    <div className="studio">
      <div className="page-intro intro-row">
        <div>
          <span className="eyebrow">DA SUA MARCA À PEÇA</span>
          <h1>{view === "projects" ? "Meus projetos" : "Criar peça 3D"}</h1>
          <p>
            Contornos reais, profundidade controlada e arquivos em milímetros.
          </p>
        </div>
        <button className="secondary" onClick={startNew}>
          <Box size={17} />
          Novo projeto
        </button>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button
            className="icon-button"
            aria-label="Fechar erro"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {status && (
        <p className="note" role="status">
          {status}
        </p>
      )}
      {busy && (
        <div className="note" role="status">
          {busy}
          <button
            className="secondary"
            onClick={() => {
              uploads.current++;
              cancel();
              setStatus("Operação cancelada. Você pode continuar editando.");
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      {pendingImport && (
        <section className="panel">
          <h2>Revisar importação</h2>
          <p>
            {pendingImport.name} · {pendingImport.regions.length} regiões ·{" "}
            {pendingImport.sourceAssets.length} fontes. O projeto atual será
            substituído na edição.
          </p>
          <button
            className="primary"
            onClick={() => {
              cancel();
              setProject(pendingImport);
              current.current = pendingImport;
              setOriginal(structuredClone(pendingImport.regions));
              setGenerated(null);
              saved.current = null;
              setContoursCurrent(pendingImport.contoursCurrent);
              setPendingImport(null);
              onView("create");
            }}
          >
            Abrir projeto importado
          </button>
          <button className="secondary" onClick={() => setPendingImport(null)}>
            Manter edição atual
          </button>
        </section>
      )}
      {view === "projects" ? (
        <>
          <p className="muted">
            Projetos locais neste navegador. Limpeza dos dados pode apagá-los.
            Exporte seu backup 3D; o backup financeiro é separado. Orçamento:
            150 MB, sujeito à quota do navegador.
          </p>
          <label className="studio-upload">
            <FolderOpen size={22} />
            <span>Importar projeto 3D (.json)</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="studio-project-grid">
            {records.map((r) => (
              <section className="panel" key={r.id}>
                <h2>{r.draft.name}</h2>
                <p>
                  {new Date(r.updatedAt).toLocaleString("pt-BR")} ·{" "}
                  {r.draft.regions.length} regiões
                </p>
                <p className="muted small">
                  {r.validated
                    ? "Última revisão validada preservada."
                    : "Rascunho sem STL validado."}
                </p>
                <div className="studio-toolbar">
                  <button className="primary" onClick={() => openRecord(r)}>
                    Abrir
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        JSON.stringify(r.draft, null, 2),
                        "inventico-" + slug(r.draft.name) + ".json",
                        "application/json",
                      )
                    }
                  >
                    Backup
                  </button>
                  {r.mesh &&
                    r.validated &&
                    r.validated.modelApprovalRevision ===
                      r.validated.revisionId && (
                      <button
                        className="secondary"
                        onClick={() => {
                          try {
                            download(
                              exportPackage(r.validated!, r.mesh!),
                              "inventico-" +
                                slug(r.draft.name) +
                                "-revisao-validada.zip",
                            );
                          } catch (e) {
                            setError(safeError(e));
                          }
                        }}
                      >
                        STLs da revisão validada
                      </button>
                    )}
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (
                        confirm(
                          `Excluir somente o projeto 3D “${r.draft.name}” e seus assets?`,
                        )
                      ) {
                        try {
                          await deleteProject(r.id);
                          await refresh();
                        } catch (e) {
                          setError(safeError(e));
                        }
                      }
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </section>
            ))}
          </div>
          {!records.length && (
            <div className="panel empty">
              <FolderOpen size={32} />
              <h2>Seu próximo letreiro começa aqui.</h2>
              <p>Crie uma peça e salve o projeto para reabri-lo.</p>
              <button className="primary" onClick={() => onView("create")}>
                Criar peça 3D
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="note">
            Logo + referência → criar 3D → confirmar → baixar STL
          </p>
          <button className="secondary" onClick={() => setSimple(!simple)}>
            {simple ? "Ajustar detalhes" : "Voltar ao modo simples"}
          </button>
          <div className="studio-layout">
            <div className="studio-inputs">
              <section className="panel">
                <span className="eyebrow">1 · FONTE LOCAL</span>
                <h2>Comece pela sua logo</h2>
                <TextField
                  label="Nome do projeto"
                  value={project.name}
                  onChange={(name) => edit({ name })}
                />
                {(["logo", "photo"] as const).map((role) => (
                  <div
                    key={role}
                    tabIndex={0}
                    role="group"
                    aria-label={
                      role === "logo" ? "Colar logo" : "Colar referência"
                    }
                    onPaste={(e) => {
                      const file = Array.from(e.clipboardData.files).find((f) =>
                        f.type.startsWith("image/"),
                      );
                      if (file) {
                        e.preventDefault();
                        void upload(file, role);
                      }
                    }}
                  >
                    <p className="muted small">
                      Clique nesta área e pressione Ctrl+V para colar{" "}
                      {role === "logo" ? "a logo" : "a referência"}, ou escolha
                      um arquivo.
                    </p>
                    <label
                      className="studio-upload"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        void upload(e.dataTransfer.files[0], role);
                      }}
                    >
                      <Upload size={22} />
                      <span>
                        {role === "logo"
                          ? "Sua logo"
                          : "Foto de referência, opcional"}
                      </span>
                      <small>SVG, PNG ou JPEG · até 8 MB</small>
                      <input
                        type="file"
                        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                        onChange={(e) => {
                          void upload(e.target.files?.[0], role);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {project.sourceAssets
                      .filter((a) => a.role === role)
                      .map((a) => (
                        <Source key={a.hash} asset={a} />
                      ))}
                  </div>
                ))}
                {!source &&
                  project.sourceAssets.some((a) => a.role === "photo") && (
                    <button
                      className="secondary"
                      onClick={() => {
                        const a = project.sourceAssets.find(
                          (a) => a.role === "photo",
                        )!;
                        edit(
                          {
                            sourceHash: a.hash,
                            concept: null,
                            conceptHistory: [],
                            contoursCurrent: false,
                            regions: [],
                            assumptions: [
                              ...project.assumptions,
                              "Fonte fotográfica: profundidade desconhecida; extração exige revisão explícita.",
                            ],
                          },
                          true,
                        );
                        setContoursCurrent(false);
                      }}
                    >
                      Usar foto como fonte para extração assistida
                    </button>
                  )}
                <p className="muted small">
                  O arquivo permanece neste navegador. A arte define letras e
                  símbolos; a foto orienta acabamento e montagem. SVG: formas,
                  grupos e transformações com preenchimentos sólidos. Converta
                  texto e traços em contornos.
                </p>
              </section>
              {simple && source && (
                <section className="panel">
                  <h2>Crie sua peça</h2>
                  <Numeric
                    label="Largura desejada (mm)"
                    value={project.options.width}
                    min={5}
                    max={1000}
                    onChange={(width) => options({ width })}
                  />
                  <p className="muted small">
                    200 mm é a sugestão inicial. Confira as medidas na prévia.
                  </p>
                  <label className="field">
                    <span>Tipo de peça</span>
                    <select
                      value={project.options.mounting}
                      onChange={(e) =>
                        options({
                          mounting: e.target.value as Options["mounting"],
                        })
                      }
                    >
                      <option value="wall">Placa de parede</option>
                      <option value="counter">Placa de balcão com base</option>
                    </select>
                  </label>
                  <button
                    className="primary full"
                    disabled={!!busy}
                    onClick={() => void createSimple()}
                  >
                    <Box size={18} />
                    Criar meu 3D
                  </button>
                  <p className="muted small">
                    A logo define os contornos. Com referência, a IA sugere
                    acabamento e montagem; você confirma o resultado antes de
                    baixar.
                  </p>
                  {!serviceReady &&
                    project.sourceAssets.some((a) => a.role === "photo") && (
                      <p className="note">
                        A análise da referência depende da conexão de IA abaixo.
                      </p>
                    )}
                </section>
              )}
              {!simple && source && (
                <ConceptStage
                  project={project}
                  onChange={(patch) => edit(patch)}
                  endpoint={endpoint}
                  token={accessToken}
                  ready={serviceReady}
                  consent={consent}
                  onAnalyze={() => void analyze()}
                  busy={!!busy}
                />
              )}
              {!simple && source && (
                <section className="panel">
                  <span className="eyebrow">2 · RECORTE E REVISÃO</span>
                  <h2>Preserve os detalhes da marca</h2>
                  {source.mime !== "image/svg+xml" && (
                    <>
                      <div className="two-fields">
                        <Numeric
                          label="Limiar de transparência"
                          value={project.processing.alpha}
                          min={1}
                          max={255}
                          onChange={(alpha) => processing({ alpha })}
                        />
                        <Numeric
                          label="Quantidade de cores sugerida"
                          value={project.processing.colors}
                          min={1}
                          max={12}
                          onChange={(colors) =>
                            processing({ colors: Math.round(colors) })
                          }
                        />
                      </div>
                      <label className="studio-check">
                        <input
                          type="checkbox"
                          checked={project.processing.removeBackground}
                          onChange={(e) =>
                            processing({ removeBackground: e.target.checked })
                          }
                        />
                        Remover fundo conectado à borda
                      </label>
                      <div className="two-fields">
                        <label className="field">
                          <span>Cor do fundo</span>
                          <input
                            type="color"
                            value={project.processing.background}
                            onChange={(e) =>
                              processing({ background: e.target.value })
                            }
                          />
                        </label>
                        <Numeric
                          label="Tolerância do fundo"
                          value={project.processing.tolerance}
                          min={0}
                          max={255}
                          onChange={(tolerance) => processing({ tolerance })}
                        />
                      </div>
                      <p className="muted small">
                        Branco interno é preservado quando não está conectado ao
                        fundo. JPEG e foto precisam de revisão. O original
                        permanece disponível.
                      </p>
                      <details>
                        <summary>Recortar a região da marca</summary>
                        <div className="two-fields">
                          {[
                            "Esquerda (%)",
                            "Topo (%)",
                            "Largura (%)",
                            "Altura (%)",
                          ].map((label, i) => (
                            <Numeric
                              key={label}
                              label={label}
                              value={project.processing.crop[i] * 100}
                              min={i > 1 ? 1 : 0}
                              max={100}
                              onChange={(v) => {
                                const crop = [
                                  ...project.processing.crop,
                                ] as Project["processing"]["crop"];
                                crop[i] = v / 100;
                                processing({ crop });
                              }}
                            />
                          ))}
                        </div>
                        <p className="muted small">
                          Recorte sem correção de perspectiva. Marcas
                          fotografadas em ângulo permanecem uma aproximação
                          revisável.
                        </p>
                      </details>
                    </>
                  )}
                  <button
                    className="secondary full"
                    disabled={!!busy}
                    onClick={() => void extract()}
                  >
                    <WandSparkles size={17} />
                    Extrair contornos localmente
                  </button>
                  {!contoursCurrent && (
                    <p className="error">
                      Reprocesse para aplicar os ajustes de recorte/fundo.
                    </p>
                  )}
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={project.reviewed}
                      disabled={!project.regions.length || !contoursCurrent}
                      onChange={(e) => edit({ reviewed: e.target.checked })}
                    />
                    <span>
                      Conferi letras, furos, cores e elementos separados. Aprovo
                      estes contornos.
                    </span>
                  </label>
                  <p className="muted small">
                    {source.role === "photo"
                      ? "Foto: escala e profundidade são informadas ou sugeridas; a imagem não comprova a parte traseira."
                      : "Curvas SVG são amostradas; raster conserva bordas de pixels. Compare antes de imprimir."}
                  </p>
                </section>
              )}
              {!simple && project.regions.length > 0 && (
                <section className="panel">
                  <span className="eyebrow">3 · TAMANHO E MONTAGEM</span>
                  <h2>Defina a peça</h2>
                  <label className="field">
                    <span>Largura da arte (mm ou cm)</span>
                    <input
                      defaultValue={project.options.width}
                      key={project.options.width}
                      onBlur={(e) => {
                        try {
                          const value = mm(e.target.value);
                          if (value < 5 || value > 1000)
                            throw Error("Largura: 5 a 1000 mm.");
                          options({ width: value });
                        } catch (e) {
                          setError(safeError(e));
                        }
                      }}
                    />
                  </label>
                  <p className="muted small">
                    Proporção travada. Sugestão inicial: 200 mm. A base e a
                    borda podem aumentar a largura total.
                  </p>
                  <label className="field">
                    <span>Montagem</span>
                    <select
                      value={project.options.mounting}
                      onChange={(e) =>
                        options({
                          mounting: e.target.value as Options["mounting"],
                        })
                      }
                    >
                      <option value="wall">
                        Parede · traseira plana / componentes para colar
                      </option>
                      <option value="counter">
                        Balcão · base separada para colar
                      </option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Fundo de apoio</span>
                    <select
                      value={project.options.backing}
                      onChange={(e) =>
                        options({
                          backing: e.target.value as Options["backing"],
                        })
                      }
                    >
                      <option value="none">
                        Sem fundo · peças independentes
                      </option>
                      <option value="silhouette">Silhueta da composição</option>
                      <option value="outline">
                        Contorno expandido (revisar vazios)
                      </option>
                      <option value="plate">Placa retangular escolhida</option>
                    </select>
                  </label>
                  {project.options.backing !== "none" && (
                    <div className="two-fields">
                      <Numeric
                        label="Espessura do fundo (mm)"
                        value={project.options.backingHeight}
                        min={0.5}
                        max={30}
                        onChange={(backingHeight) => options({ backingHeight })}
                      />
                      {["outline", "plate"].includes(
                        project.options.backing,
                      ) && (
                        <Numeric
                          label="Borda do apoio (mm)"
                          value={project.options.border}
                          min={0}
                          max={30}
                          onChange={(border) => options({ border })}
                        />
                      )}
                    </div>
                  )}
                  {project.options.mounting === "counter" && (
                    <div className="two-fields">
                      {[
                        ["baseWidth", "Largura da base (mm)", 5, 1000],
                        ["baseDepth", "Profundidade da base (mm)", 5, 200],
                        ["baseHeight", "Altura da base (mm)", 1, 50],
                        ["baseX", "Posição lateral (mm)", -500, 500],
                      ].map(([k, label, min, max]) => (
                        <Numeric
                          key={String(k)}
                          label={String(label)}
                          value={project.options[k as keyof Options] as number}
                          min={Number(min)}
                          max={Number(max)}
                          onChange={(v) => options({ [String(k)]: v })}
                        />
                      ))}
                    </div>
                  )}
                  <div className="two-fields">
                    <label className="field">
                      <span>Cor do apoio</span>
                      <input
                        type="color"
                        value={project.options.backingColor}
                        onChange={(e) =>
                          options({ backingColor: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Cor da base</span>
                      <input
                        type="color"
                        value={project.options.baseColor}
                        onChange={(e) => options({ baseColor: e.target.value })}
                      />
                    </label>
                  </div>
                  {project.options.mounting === "counter" && (
                    <details>
                      <summary>Alojamento NFC na base</summary>
                      <label className="studio-check">
                        <input
                          type="checkbox"
                          checked={project.options.nfcEnabled}
                          onChange={(e) =>
                            options({ nfcEnabled: e.target.checked })
                          }
                        />
                        Criar rebaixo circular aberto por baixo para uma
                        etiqueta NFC adesiva
                      </label>
                      {project.options.nfcEnabled && (
                        <div className="two-fields">
                          <Numeric
                            label="Diâmetro do rebaixo, com folga (mm)"
                            value={project.options.nfcDiameter}
                            min={5}
                            max={100}
                            onChange={(nfcDiameter) => options({ nfcDiameter })}
                          />
                          <Numeric
                            label="Profundidade do rebaixo (mm)"
                            value={project.options.nfcDepth}
                            min={0.2}
                            max={10}
                            onChange={(nfcDepth) => options({ nfcDepth })}
                          />
                        </div>
                      )}
                      <p className="muted small">
                        Meça sua etiqueta. Valores iniciais são sugestões. O
                        rebaixo fica centralizado sob a base e não inclui tampa
                        ou eletrônica. Teste leitura e fixação na peça real.
                      </p>
                    </details>
                  )}
                  <details>
                    <summary>Referências de fabricação</summary>
                    <div className="two-fields">
                      <Numeric
                        label="Bico de referência (mm)"
                        value={project.options.nozzle}
                        min={0.1}
                        max={2}
                        onChange={(nozzle) => options({ nozzle })}
                      />
                      <Numeric
                        label="Margem / brim por lado (mm)"
                        value={project.options.margin}
                        min={0}
                        max={50}
                        onChange={(margin) => options({ margin })}
                      />
                    </div>
                    <p className="muted small">
                      Mesa confirmada: 250 × 250 mm. Bico 0,4 mm é sugestão.
                      Altura máxima e perfil não foram informados.
                    </p>
                  </details>
                  <button
                    className="primary full"
                    disabled={
                      !!busy ||
                      !project.reviewed ||
                      !contoursCurrent ||
                      (project.workflow === "concept" &&
                        (!project.concept?.approved ||
                          !project.concept.planned))
                    }
                    onClick={generate}
                  >
                    <Box size={18} />
                    Gerar peça 3D
                  </button>
                </section>
              )}
            </div>
            <div className="studio-output">
              <section className="panel">
                <div className="section-row">
                  <h2>Origem → contornos → peça</h2>
                  <span className="eyebrow">GEOMETRIA LOCAL</span>
                </div>
                <div className="studio-comparison">
                  {source ? (
                    <Source asset={source} />
                  ) : (
                    <div className="studio-empty">
                      Envie sua arte para começar.
                    </div>
                  )}
                  <Contours regions={project.regions} />
                </div>
                {project.regions.length > 0 && (
                  <p className="muted small">
                    {project.regions.length} regiões ·{" "}
                    {project.regions.reduce((s, r) => s + r.loops.length, 0)}{" "}
                    contornos · cores editáveis abaixo. Nenhum pingo ou ilha é
                    descartado automaticamente.
                  </p>
                )}
                {generated ? (
                  <>
                    <Preview
                      generated={generated}
                      component={component}
                      mounting={project.options.mounting}
                    />
                    {fresh && approvedModel !== project.revisionId && (
                      <div className="note">
                        <p>
                          Confira a prévia 3D, as letras, os vazios e as
                          medidas. Ao confirmar, os downloads serão liberados.
                        </p>
                        <button
                          className="primary full"
                          disabled={!!busy}
                          onClick={approveModel}
                        >
                          <Check size={18} />
                          Confirmar este 3D
                        </button>
                      </div>
                    )}
                    {fresh && approvedModel === project.revisionId && (
                      <p className="note">
                        3D confirmado. Seu STL está pronto para baixar.
                      </p>
                    )}
                    {!fresh && (
                      <div className="alert">
                        Prévia desatualizada. Gere novamente para baixar a
                        edição atual.
                      </div>
                    )}
                    <label className="field">
                      <span>Inspecionar componente</span>
                      <select
                        value={component}
                        onChange={(e) => setComponent(e.target.value)}
                      >
                        <option value="all">Conjunto</option>
                        {generated.parts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      <b>Conjunto:</b>{" "}
                      {generated.mono.report.dimensions
                        .map((v) => num(v, 2))
                        .join(" × ")}{" "}
                      mm · {generated.mono.report.bodies} corpo(s) ·{" "}
                      {num(generated.mono.report.volume / 1000, 2)} cm³ de
                      sólido geométrico.
                    </p>
                    <p className="muted small">
                      Volume não equivale a consumo ou tempo do fatiador.
                      Fechamento topológico e volume são validados;
                      auto-interseções gerais e estabilidade física exigem
                      inspeção adicional.
                    </p>
                    {generated.warnings.map((w, i) => (
                      <p className="note" key={i}>
                        {w}
                      </p>
                    ))}
                  </>
                ) : (
                  <div className="studio-empty studio-await">
                    <Box size={42} />
                    <h2>A forma da sua marca vira a peça.</h2>
                    <p>
                      Revise os contornos, escolha a montagem e gere os sólidos
                      para visualizar.
                    </p>
                  </div>
                )}
              </section>
              {!simple && project.regions.length > 0 && (
                <section className="panel">
                  <div className="section-row">
                    <h2>Cores e relevos</h2>
                    <button
                      className="secondary"
                      disabled={!original}
                      onClick={() => {
                        if (original)
                          edit({ regions: structuredClone(original) }, true);
                      }}
                    >
                      <RotateCcw size={15} />
                      Restaurar extração
                    </button>
                  </div>
                  <p className="muted small">
                    Ordem da arte: regiões posteriores ocupam a frente; a parte
                    inferior é recortada para evitar interpenetração. Alterar
                    cor mantém os contornos. Desativar é reversível.
                  </p>
                  <div className="studio-regions">
                    {project.regions.map((r, i) => (
                      <div className="studio-region" key={r.id}>
                        <label className="studio-check">
                          <input
                            type="checkbox"
                            checked={r.enabled}
                            onChange={(e) =>
                              updateRegion(r.id, { enabled: e.target.checked })
                            }
                          />
                          <span>Incluir {i + 1}</span>
                        </label>
                        <label className="field">
                          <span>Nome do material visual</span>
                          <input
                            value={r.name}
                            onChange={(e) =>
                              updateRegion(r.id, { name: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Cor {i + 1}</span>
                          <input
                            type="color"
                            value={r.color}
                            onChange={(e) =>
                              updateRegion(r.id, { color: e.target.value })
                            }
                          />
                        </label>
                        <Numeric
                          label="Relevo (mm)"
                          value={r.height}
                          min={0.2}
                          max={50}
                          onChange={(height) => updateRegion(r.id, { height })}
                        />
                        <small className="muted">
                          {r.loops.length} contornos ·{" "}
                          {r.enabled
                            ? num(
                                totalArea
                                  ? (Math.abs(
                                      r.loops.reduce((s, l) => s + area(l), 0),
                                    ) /
                                      totalArea) *
                                      100
                                  : 0,
                                1,
                              ) + "% da área planar aproximada"
                            : "região desativada"}
                        </small>
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary>Mapear cores semelhantes</summary>
                    <p className="muted small">
                      Aplicar a cor de outra região mantém peças e contornos
                      separados. Para reduzir a paleta geométrica de imagens,
                      altere a quantidade de cores e revise a nova extração.
                    </p>
                    {project.regions.map((r) => (
                      <label className="field" key={r.id}>
                        <span>{r.name}</span>
                        <select
                          value={r.color}
                          onChange={(e) =>
                            updateRegion(r.id, { color: e.target.value })
                          }
                        >
                          {Array.from(
                            new Set(project.regions.map((r) => r.color)),
                          ).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </details>
                </section>
              )}
              <section className="panel">
                <h2>Salvar e baixar</h2>
                <div className="studio-toolbar">
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => void save()}
                  >
                    <Save size={17} />
                    Salvar projeto local
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      try {
                        download(
                          projectBackup({ ...project, contoursCurrent }),
                          "inventico-" + slug(project.name) + ".json",
                          "application/json",
                        );
                      } catch (e) {
                        setError(safeError(e));
                      }
                    }}
                  >
                    Backup 3D com fontes
                  </button>
                  <button
                    className="secondary"
                    disabled={!project.regions.length}
                    onClick={() =>
                      download(
                        normalizedSVG(project),
                        "inventico-" + slug(project.name) + "-contornos.svg",
                        "image/svg+xml",
                      )
                    }
                  >
                    SVG dos contornos
                  </button>
                </div>
                {generated && (
                  <>
                    <button
                      className="primary full"
                      disabled={
                        !fresh || !!busy || approvedModel !== project.revisionId
                      }
                      onClick={() => {
                        try {
                          download(
                            exportPackage(project, generated),
                            "inventico-" + slug(project.name) + ".zip",
                          );
                        } catch (e) {
                          setError(safeError(e));
                        }
                      }}
                    >
                      <Download size={18} />
                      Baixar pacote STL por componente
                    </button>
                    <div className="studio-toolbar">
                      {[...generated.parts, generated.mono].map((p) => (
                        <button
                          key={p.id}
                          className="secondary"
                          disabled={
                            !fresh ||
                            !!busy ||
                            approvedModel !== project.revisionId
                          }
                          onClick={() =>
                            download(
                              p.stl,
                              "inventico-" +
                                slug(project.name) +
                                "-" +
                                p.id +
                                ".stl",
                            )
                          }
                        >
                          {p.name} · STL
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="muted small">
                  STL binário em mm, sem cores. Importe como conjunto no
                  fatiador e confira o alinhamento. ZIP inclui manifest, STLs,
                  fontes do projeto e instruções. Backup financeiro não inclui
                  os projetos 3D.
                </p>
              </section>
              <section className="panel">
                <details>
                  <summary>
                    {simple
                      ? "Conectar IA"
                      : "Serviço de IA: imagens e planejamento"}
                  </summary>
                  <p>
                    A análise pode sugerir montagem e alturas. A geometria
                    continua derivada dos contornos revisados. Configure um
                    serviço local ou endpoint autorizado; a chave do provedor
                    fica no servidor.
                  </p>
                  <TextField
                    label="Endereço do serviço de IA"
                    value={endpoint}
                    onChange={(v) => {
                      setEndpoint(v);
                      setServiceReady(false);
                    }}
                  />
                  <label className="field">
                    <span>Credencial temporária do serviço, se exigida</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() => void checkService()}
                  >
                    Verificar configuração
                  </button>
                  <TextField
                    label="O que deseja nesta montagem?"
                    value={aiDescription}
                    onChange={setAiDescription}
                  />
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    Autorizo enviar a logo, a referência e a proposta visual
                    aprovada, sem metadados, junto desta descrição. Dados
                    financeiros não são enviados.
                  </label>
                  <button
                    className="secondary"
                    disabled={
                      !serviceReady ||
                      !consent ||
                      !project.sourceAssets.length ||
                      !!busy
                    }
                    onClick={() => void analyze()}
                  >
                    Analisar referência com IA
                  </button>
                  {!serviceReady && (
                    <p className="muted small">
                      IA sem serviço configurado. O fluxo local permanece
                      disponível.
                    </p>
                  )}
                  {plan && (
                    <div className="note">
                      <b>Proposta: {plan.status}</b>
                      <p>{plan.summary}</p>
                      <p>
                        Montagem:{" "}
                        {plan.mounting === "wall" ? "parede" : "balcão"} ·
                        fundo: {plan.backing} · largura:{" "}
                        {plan.targetWidthMm ?? "não determinada"} mm
                      </p>
                      {[...plan.assumptions, ...plan.questions].map((s, i) => (
                        <p key={i}>{s}</p>
                      ))}
                      {plan.status === "proposal" && (
                        <button className="primary" onClick={() => applyPlan()}>
                          <Check size={16} />
                          Aplicar proposta e revisar
                        </button>
                      )}
                    </div>
                  )}
                </details>
              </section>
              {!simple && generated && (
                <section className="panel">
                  <h2>Levar para a calculadora</h2>
                  <p className="muted">
                    Informe o consumo e tempo reais do fatiador, com suportes e
                    perdas. Cada material mantém seu custo.
                  </p>
                  {generated.parts.map((p) => (
                    <div className="two-fields" key={p.id}>
                      <Numeric
                        label={`${p.name}: massa real (g)`}
                        value={finance[p.id]?.grams ?? NaN}
                        min={0}
                        onChange={(grams) =>
                          setFinance((s) => ({
                            ...s,
                            [p.id]: {
                              filamentId:
                                s[p.id]?.filamentId ?? filaments[0].id,
                              grams,
                            },
                          }))
                        }
                      />
                      <label className="field">
                        <span>Filamento de {p.name}</span>
                        <select
                          value={finance[p.id]?.filamentId ?? ""}
                          onChange={(e) =>
                            setFinance((s) => ({
                              ...s,
                              [p.id]: {
                                grams: s[p.id]?.grams ?? NaN,
                                filamentId: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Escolha o material</option>
                          {filaments.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                  <div className="two-fields">
                    <Numeric
                      label="Horas reais de impressão (lote)"
                      value={hours}
                      min={0}
                      onChange={setHours}
                    />
                    <Numeric
                      label="Minutos"
                      value={minutes}
                      min={0}
                      max={59}
                      onChange={setMinutes}
                    />
                  </div>
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={newSimulation}
                      onChange={(e) => setNewSimulation(e.target.checked)}
                    />
                    Criar nova simulação com estes dados confirmados. A
                    simulação aberta poderá ser restaurada.
                  </label>
                  <p className="muted small">
                    A calculadora usa um filamento principal. Os demais entram
                    discriminados em componentes de custo do lote, com massa e
                    material registrados nas observações.
                  </p>
                  <button
                    className="primary"
                    disabled={!fresh || !newSimulation}
                    onClick={transfer}
                  >
                    Levar dados confirmados para a calculadora
                  </button>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
