import { useEffect, useRef, useState } from "react";
import type { Asset, Project } from "./model";
import { conceptSchema, parseProject } from "./model";
import { assetURL } from "./import";
import { conceptPrompt, defaultBrief } from "./conceptPrompt";
import { endpointURL } from "./ai";
import { download } from "./export";
import { TextField } from "../components/ui";

export async function preparedPNG(asset: Asset) {
  const image = new Image();
  image.src = assetURL(asset);
  await image.decode();
  const canvas = document.createElement("canvas"),
    scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw Error("Não foi possível preparar a logo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/png");
  canvas.width = canvas.height = 1;
  return data;
}
type Props = {
  project: Project;
  onChange: (patch: Partial<Project>) => void;
  endpoint: string;
  token: string;
  ready: boolean;
  consent: boolean;
  onAnalyze: () => void;
  busy: boolean;
};
export function ConceptStage({
  project,
  onChange,
  endpoint,
  token,
  ready,
  consent,
  onAnalyze,
  busy,
}: Props) {
  const [brief, setBrief] = useState(defaultBrief),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null),
    current = useRef(project);
  current.current = project;
  useEffect(() => {
    controller.current?.abort();
    setLoading(false);
    setConfirmed(false);
    setError("");
  }, [project.sourceHash, project.projectId]);
  useEffect(() => () => controller.current?.abort(), []);
  const concept = project.concept,
    logo = project.sourceAssets.find(
      (a) => a.role === "logo" && a.hash === project.sourceHash,
    );
  async function generateImage() {
    if (!logo || !ready || !consent) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    const revision = project.revisionId,
      sourceHash = project.sourceHash,
      timeout = setTimeout(() => abort.abort(), 185000);
    try {
      const data = await preparedPNG(logo);
      if (abort.signal.aborted) return;
      const response = await fetch(endpointURL(endpoint) + "/concept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          logo: data,
          ...(concept?.approved ? { reference: concept.image } : {}),
          brief,
        }),
        signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Geração indisponível.");
      const next = conceptSchema.parse({
        id: crypto.randomUUID(),
        sourceHash,
        image: body.image,
        prompt: body.prompt,
        approved: false,
        planned: false,
        createdAt: new Date().toISOString(),
      });
      if (abort.signal.aborted) return;
      if (current.current.revisionId !== revision) {
        setError(
          "O projeto mudou durante a geração. A proposta antiga não foi aplicada.",
        );
        return;
      }
      const conceptHistory = [
        ...(concept ? [concept] : []),
        ...project.conceptHistory,
      ].slice(0, 2);
      parseProject(
        JSON.stringify({ ...project, concept: next, conceptHistory }),
      );
      onChange({ concept: next, conceptHistory, workflow: "concept" });
      setConfirmed(false);
    } catch (e) {
      if (controller.current === abort)
        setError(
          abort.signal.aborted
            ? "Geração cancelada ou tempo limite atingido."
            : e instanceof Error
              ? e.message
              : "Falha ao gerar imagem.",
        );
    } finally {
      clearTimeout(timeout);
      if (controller.current === abort) {
        controller.current = null;
        setLoading(false);
      }
    }
  }
  return (
    <section className="panel">
      <span className="eyebrow">PROPOSTA VISUAL → PEÇA</span>
      <h2>Imagine sua placa NFC</h2>
      <label className="field">
        <span>Como deseja criar?</span>
        <select
          value={project.workflow}
          onChange={(e) =>
            onChange({ workflow: e.target.value as Project["workflow"] })
          }
        >
          <option value="local">Modelar diretamente da logo</option>
          <option value="concept">Gerar imagem, aprovar e modelar</option>
        </select>
      </label>
      {project.workflow === "concept" && (
        <>
          <p>
            1. Gere uma proposta. 2. Aprove o visual. 3. Revise o plano e as
            medidas. 4. Confira os contornos e gere o 3D.
          </p>
          <TextField
            label="Textos exatos da logo (opcional, para confirmar a leitura)"
            value={brief.text}
            onChange={(text) => setBrief({ ...brief, text })}
          />
          <TextField
            label="Cores e acabamento"
            value={brief.colors}
            onChange={(colors) => setBrief({ ...brief, colors })}
          />
          <TextField
            label="Ajustes da proposta"
            value={brief.adjustments}
            onChange={(adjustments) => setBrief({ ...brief, adjustments })}
          />
          <label className="field">
            <span>Vista da próxima imagem</span>
            <select
              value={brief.view}
              onChange={(e) =>
                setBrief({
                  ...brief,
                  view: e.target.value as typeof brief.view,
                })
              }
            >
              <option value="three-quarter">Frente em três quartos</option>
              <option value="front">Frontal</option>
              <option value="back">Traseira</option>
            </select>
          </label>
          <details>
            <summary>Prompt que será enviado</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
              {conceptPrompt(brief)}
            </pre>
            <button
              className="secondary"
              onClick={() =>
                download(
                  conceptPrompt(brief),
                  "inventico-prompt-placa-nfc.txt",
                  "text/plain",
                )
              }
            >
              Baixar prompt
            </button>
          </details>
          <button
            className="primary full"
            disabled={!logo || !ready || !consent || loading || busy}
            onClick={() => void generateImage()}
          >
            {loading
              ? "Gerando imagem…"
              : concept?.approved
                ? "Gerar nova vista ou ajuste"
                : "Gerar imagem da placa NFC"}
          </button>
          {loading && (
            <p role="status">
              A geração pode levar alguns minutos.{" "}
              <button
                className="secondary"
                onClick={() => controller.current?.abort()}
              >
                Cancelar geração
              </button>
            </p>
          )}
          {!ready && (
            <p className="note">
              Configure o serviço de IA na seção abaixo para gerar imagens
              dentro do app.
            </p>
          )}
          {!logo && (
            <p className="note">Envie a logo original para gerar a proposta.</p>
          )}
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {concept && (
            <>
              <figure className="studio-source">
                <img
                  src={concept.image}
                  alt="Proposta visual de placa NFC gerada a partir da logo"
                />
                <figcaption>
                  {concept.approved
                    ? "Visual aprovado"
                    : "Proposta aguardando sua aprovação"}{" "}
                  · {new Date(concept.createdAt).toLocaleString("pt-BR")}
                </figcaption>
              </figure>
              <div className="studio-toolbar">
                <button
                  className="secondary"
                  onClick={() => {
                    const bytes = Uint8Array.from(
                      atob(concept.image.split(",")[1]),
                      (c) => c.charCodeAt(0),
                    );
                    download(bytes, "inventico-proposta-nfc.png", "image/png");
                  }}
                >
                  Baixar imagem
                </button>
                <button
                  className="primary"
                  disabled={loading || concept.approved}
                  onClick={() =>
                    onChange({
                      concept: { ...concept, approved: true, planned: false },
                    })
                  }
                >
                  Aprovar este visual
                </button>
              </div>
              {concept.approved && (
                <>
                  <button
                    className="secondary"
                    disabled={
                      !ready || !consent || !project.regions.length || busy
                    }
                    onClick={onAnalyze}
                  >
                    Planejar montagem da imagem com IA
                  </button>
                  <p className="muted small">
                    A proposta de montagem aparecerá em “Serviço de IA”. Revise
                    antes de aplicar. Também pode definir as medidas manualmente
                    abaixo.
                  </p>
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Revisei largura, relevos, apoio, base e alojamento NFC na
                    seção de medidas.
                  </label>
                  <button
                    className="secondary"
                    disabled={!confirmed || busy}
                    onClick={() =>
                      onChange({ concept: { ...concept, planned: true } })
                    }
                  >
                    Confirmar plano manual
                  </button>
                  {concept.planned && (
                    <p className="note">
                      Plano aceito. Revise os contornos da logo e gere o modelo
                      3D.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {project.conceptHistory.length > 0 && (
            <div>
              <p>
                Propostas anteriores — guardamos as três imagens mais recentes
                neste projeto.
              </p>
              <div className="studio-toolbar">
                {project.conceptHistory.map((item, index) => (
                  <button
                    className="secondary"
                    key={item.id}
                    disabled={loading || busy}
                    onClick={() => {
                      onChange({
                        concept: { ...item, planned: false },
                        conceptHistory: [
                          ...(concept ? [concept] : []),
                          ...project.conceptHistory.filter(
                            (c) => c.id !== item.id,
                          ),
                        ].slice(0, 2),
                      });
                      setConfirmed(false);
                    }}
                  >
                    <img
                      src={item.image}
                      alt={`Proposta anterior ${index + 1}`}
                      width={80}
                      height={80}
                      style={{ objectFit: "contain" }}
                    />
                    Usar proposta {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="muted small">
            A imagem orienta o visual. O modelo usa a logo original e medidas
            explícitas; detalhes decorativos inventados pela imagem não são
            reconstruídos automaticamente. O símbolo e o texto NFC do mockup não
            viram relevo por esta etapa.
          </p>
        </>
      )}
    </section>
  );
}
