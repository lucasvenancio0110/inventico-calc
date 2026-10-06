import { useModalFocus } from "./components/useModalFocus";
import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Calculator,
  ChartNoAxesCombined,
  Package,
  Settings2,
  Save,
  ShieldCheck,
  ArrowRight,
  SlidersHorizontal,
  Plus,
  X,
} from "lucide-react";
import type { State, SavedProduct } from "./types";
import { branding, defaults, id } from "./defaults";
import { storage } from "./storage/repository";
import { calculate, validate } from "./engine/finance";
import { Numeric, NumberField, Select, TextField } from "./components/ui";
import { Advanced } from "./components/Advanced";
import { Results } from "./components/Results";
import { Settings } from "./pages/Settings";
import { Products } from "./pages/Products";
import { Analysis } from "./pages/Analysis";
const initial = storage.load();
export default function App() {
  const [state, setState] = useState<State>(initial.state),
    [page, setPage] = useState("calculator"),
    [advanced, setAdvanced] = useState(false),
    [toast, setToast] = useState(""),
    [storageError, setStorageError] = useState(initial.error),
    [editedId, setEditedId] = useState<string | null>(null),
    [saveOpen, setSaveOpen] = useState(false);
  const closeModal = useCallback(() => {
    setSaveOpen(false);
  }, []);
  useModalFocus(!state.onboarded || saveOpen, closeModal);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page]);
  const input = state.simulation,
    errors = validate(input, state);
  const result = errors.length ? null : calculate(input, state);
  const update = (s: State) => {
    setState(s);
  };
  useEffect(() => {
    if (initial.error && storageError) return;
    if (validate(state.simulation, state).length) return;
    try {
      storage.save(state);
      setStorageError(null);
    } catch {
      setStorageError(
        "Não foi possível salvar no navegador. Exporte um backup para preservar seus dados.",
      );
    }
  }, [state, storageError]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const patch = (v: Partial<State["simulation"]>) =>
    update({ ...state, simulation: { ...input, ...v } });
  const save = () => {
    if (!result || !input.name.trim()) return;
    const snapshot = structuredClone({
      settings: state.settings,
      filaments: state.filaments,
      printers: state.printers,
      channels: state.channels,
    });
    const product: SavedProduct = {
      id: editedId ?? id(),
      createdAt:
        state.products.find((p) => p.id === editedId)?.createdAt ??
        new Date().toISOString(),
      input: structuredClone(input),
      snapshot,
      result: structuredClone(result),
    };
    update({
      ...state,
      products: editedId
        ? state.products.map((p) => (p.id === editedId ? product : p))
        : [...state.products, product],
    });
    setEditedId(product.id);
    setSaveOpen(false);
    setToast("Simulação salva no seu catálogo.");
  };
  const open = (p: SavedProduct) => {
    update({
      ...state,
      ...structuredClone(p.snapshot),
      simulation: structuredClone(p.input),
    });
    setEditedId(p.id);
    setPage("calculator");
    setToast(
      "Produto aberto para edição. As configurações históricas foram carregadas como configurações atuais.",
    );
  };
  const nav = [
    { id: "calculator", name: "Calculadora", icon: Calculator },
    { id: "products", name: "Produtos", icon: Package },
    { id: "analysis", name: "Análise", icon: ChartNoAxesCombined },
    { id: "settings", name: "Configurações", icon: Settings2 },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("calculator");
          }}
        >
          <span className="brand-mark">
            <Box size={25} />
          </span>
          <span>
            {branding.name}
            <small>{branding.suffix}</small>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE PESSOAL</div>
        <nav aria-label="Navegação principal">
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => setPage(n.id)}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {n.id === "products" && state.products.length > 0 && (
                <small>{state.products.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span className="live-dot" />
            100% local
          </div>
          <p>
            Suas ideias têm valor.
            <br />
            Descubra quanto.
          </p>
          <span className="version">INVENTICO CALC · V1.0</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Seu estúdio <span className="separator">/</span>{" "}
            <b>{nav.find((n) => n.id === page)?.name}</b>
          </span>
          <span className="local-state">
            <ShieldCheck size={15} />
            {storageError
              ? "Verifique o armazenamento"
              : errors.length
                ? "Alterações inválidas não salvas"
                : "Salvo neste navegador"}
          </span>
        </header>
        <div className="page-content">
          {storageError && (
            <div className="alert">
              {storageError}
              <button
                className="text-button"
                onClick={() => {
                  if (
                    confirm(
                      "Usar novos dados? Os dados ilegíveis serão substituídos.",
                    )
                  ) {
                    initial.error = null;
                    setStorageError(null);
                  }
                }}
              >
                Continuar com novos dados
              </button>
            </div>
          )}
          {errors.length > 0 && (
            <div className="alert" role="alert">
              <b>Confira os dados para continuar</b>
              {errors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}
          {page === "calculator" && (
            <>
              <div className="page-intro intro-row">
                <div>
                  <span className="eyebrow">DA IDEIA AO LUCRO</span>
                  <h1>Vale a pena imprimir?</h1>
                  <p>Transforme gramas e horas em decisões melhores.</p>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditedId(null);
                    patch({
                      ...defaults().simulation,
                      filamentId: state.filaments[0].id,
                      printerId: state.printers[0].id,
                      channelId: state.channels[0].id,
                      name: "Novo produto",
                      grams: 0,
                      hours: 0,
                      minutes: 0,
                      price: null,
                    });
                  }}
                >
                  <Plus size={16} />
                  Nova simulação
                </button>
              </div>
              <div className="calculator-layout">
                <div className="input-column">
                  <section className="panel simulation-panel">
                    <div className="section-row">
                      <h2>Nova simulação</h2>
                      <SlidersHorizontal size={18} className="muted" />
                    </div>
                    <div className="segmented">
                      <button
                        className={!advanced ? "selected" : ""}
                        onClick={() => setAdvanced(false)}
                      >
                        Modo rápido
                      </button>
                      <button
                        className={advanced ? "selected" : ""}
                        onClick={() => setAdvanced(true)}
                      >
                        Avançado
                      </button>
                    </div>
                    <div className="main-fields">
                      <Numeric
                        label="Peso utilizado no lote"
                        value={input.grams}
                        suffix="g"
                        onChange={(grams) => patch({ grams })}
                      />
                      <div className="two-fields">
                        <Numeric
                          label="Horas de impressão"
                          value={input.hours}
                          suffix="h"
                          onChange={(hours) => patch({ hours })}
                        />
                        <Numeric
                          label="Minutos"
                          value={input.minutes}
                          suffix="min"
                          max={59}
                          onChange={(minutes) => patch({ minutes })}
                        />
                      </div>
                      <div className="two-fields">
                        <Numeric
                          label="Quantidade de peças"
                          value={input.quantity}
                          min={1}
                          suffix="un."
                          onChange={(quantity) => patch({ quantity })}
                        />
                        <NumberField
                          label="Preço por unidade"
                          value={input.price}
                          optional
                          suffix="R$"
                          onChange={(price) => patch({ price })}
                        />
                      </div>
                      <Select
                        label="Filamento"
                        value={input.filamentId}
                        options={state.filaments}
                        onChange={(filamentId) => patch({ filamentId })}
                      />
                      <Select
                        label="Canal de venda"
                        value={input.channelId}
                        options={state.channels}
                        onChange={(channelId) => patch({ channelId })}
                      />
                      {advanced && (
                        <Select
                          label="Impressora"
                          value={input.printerId}
                          options={state.printers}
                          onChange={(printerId) => patch({ printerId })}
                        />
                      )}
                    </div>
                    <p className="muted small input-hint">
                      Peso e tempo são do lote inteiro. Preço é por unidade.
                      Deixe o preço vazio para usar o recomendado.
                    </p>
                    <button
                      className="primary full"
                      disabled={!result}
                      onClick={() => setSaveOpen(true)}
                    >
                      <Save size={17} />
                      {editedId ? "Salvar alterações" : "Salvar simulação"}
                    </button>
                  </section>
                  <div className="machine-card">
                    <span className="machine-symbol">
                      <Box size={27} />
                    </span>
                    <div>
                      <span className="eyebrow">SUA IMPRESSORA</span>
                      <b>
                        {
                          state.printers.find((p) => p.id === input.printerId)
                            ?.name
                        }
                      </b>
                      <span className="muted small">
                        {state.settings.productiveHours} h disponíveis / dia
                      </span>
                    </div>
                  </div>
                  <div className="note">
                    Sua hora de trabalho já entra no custo. O lucro é o que
                    sobra depois de remunerar a mão de obra e cobrir os custos
                    configurados.
                  </div>
                </div>
                <div>
                  {result ? (
                    <Results r={result} daysMonth={state.settings.daysMonth} />
                  ) : (
                    <div className="panel empty">
                      <Calculator size={36} />
                      <h2>Vamos acertar os dados.</h2>
                      <p>
                        Os resultados aparecem assim que os valores estiverem
                        válidos.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {advanced && (
                <section className="panel advanced-section">
                  <h2>Ajustes desta simulação</h2>
                  <Advanced
                    state={state}
                    onChange={(simulation) => update({ ...state, simulation })}
                  />
                  <button
                    className="secondary"
                    onClick={() => setPage("settings")}
                  >
                    Configurações financeiras <ArrowRight size={16} />
                  </button>
                </section>
              )}
            </>
          )}
          {page === "settings" && (
            <Settings
              state={state}
              setState={(s) => {
                setEditedId(null);
                initial.error = null;
                setStorageError(null);
                update(s);
              }}
              notify={setToast}
              reset={() => {
                if (
                  confirm(
                    "Restaurar configurações e simulação iniciais? Os produtos salvos serão preservados com seus históricos.",
                  )
                ) {
                  update({
                    ...defaults(),
                    onboarded: true,
                    products: state.products,
                  });
                  setEditedId(null);
                  setToast("Configurações restauradas. Produtos preservados.");
                }
              }}
            />
          )}
          {page === "products" && (
            <Products state={state} setState={update} open={open} />
          )}
          {page === "analysis" &&
            (result ? (
              <Analysis state={state} r={result} setState={update} />
            ) : (
              <p className="note">
                Corrija os valores inválidos para abrir a análise.
              </p>
            ))}
          <footer>
            {branding.tagline}
            <span>Feito para quem transforma ideias em objetos.</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {!state.onboarded && (
        <div className="modal-backdrop">
          <section
            className="modal onboarding"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
          >
            <span className="brand-mark">
              <Box size={30} />
            </span>
            <span className="eyebrow">BEM-VINDO AO INVENTICO CALC</span>
            <h1 id="welcome-title">
              Sua próxima impressão.
              <br />
              <em>Seu próximo lucro.</em>
            </h1>
            <p className="muted">
              Um ponto de partida para o seu estúdio. Tudo pode ser alterado
              depois.
            </p>
            <div className="form-grid">
              <TextField
                label="Qual sua impressora?"
                value={state.printers[0].name}
                onChange={(name) =>
                  update({
                    ...state,
                    printers: [
                      { ...state.printers[0], name },
                      ...state.printers.slice(1),
                    ],
                  })
                }
              />
              <Numeric
                label="Quanto pagou? (R$)"
                value={state.printers[0].price}
                onChange={(price) =>
                  update({
                    ...state,
                    printers: [
                      { ...state.printers[0], price },
                      ...state.printers.slice(1),
                    ],
                  })
                }
              />
              <Numeric
                label="Preço do filamento (R$)"
                value={state.filaments[0].price}
                onChange={(price) =>
                  update({
                    ...state,
                    filaments: [
                      { ...state.filaments[0], price },
                      ...state.filaments.slice(1),
                    ],
                  })
                }
              />
              <Numeric
                label="Peso do rolo (g)"
                min={1}
                value={state.filaments[0].weight}
                onChange={(weight) =>
                  update({
                    ...state,
                    filaments: [
                      { ...state.filaments[0], weight },
                      ...state.filaments.slice(1),
                    ],
                  })
                }
              />
              <Numeric
                label="Preço do kWh (R$)"
                value={state.settings.kwh}
                onChange={(kwh) =>
                  update({ ...state, settings: { ...state.settings, kwh } })
                }
              />
              <Numeric
                label="Quanto vale sua hora? (R$)"
                value={state.settings.hourly}
                onChange={(hourly) =>
                  update({ ...state, settings: { ...state.settings, hourly } })
                }
              />
              <Numeric
                label="Horas disponíveis por dia"
                max={24}
                value={state.settings.productiveHours}
                onChange={(productiveHours) =>
                  update({
                    ...state,
                    settings: { ...state.settings, productiveHours },
                  })
                }
              />
            </div>
            <p className="muted small">
              Impressora de R$ 4.000, vida útil de 10.000 h, manutenção de R$
              0,20/h e falha de 3% são exemplos iniciais. Confira em
              Configurações.
            </p>
            <button
              className="primary full"
              disabled={errors.length > 0}
              onClick={() => update({ ...state, onboarded: true })}
            >
              Entrar na calculadora <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}
      {saveOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
          >
            <div className="section-row">
              <h2 id="save-title">Salvar simulação</h2>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setSaveOpen(false)}
              >
                <X />
              </button>
            </div>
            <TextField
              label="Nome do produto"
              value={input.name}
              onChange={(name) => patch({ name })}
            />
            <TextField
              label="Categoria"
              value={input.category}
              onChange={(category) => patch({ category })}
            />
            <TextField
              label="Observações"
              value={input.notes}
              onChange={(notes) => patch({ notes })}
            />
            <button
              className="primary full"
              disabled={!input.name.trim() || !result}
              onClick={save}
            >
              <Save size={17} />
              Salvar no catálogo
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
