import { Plus, Trash2, Download, Upload, RotateCcw } from "lucide-react";
import { useState } from "react";
import { validate } from "../engine/finance";
import type {
  State,
  Settings as SettingsType,
  Filament,
  Printer,
  Channel,
} from "../types";
import { id } from "../defaults";
import {
  ItemsEditor,
  Numeric,
  Select,
  TextField,
  tips,
  money,
} from "../components/ui";
import { storage, parseBackup } from "../storage/repository";
type Props = {
  state: State;
  setState: (s: State) => void;
  notify: (s: string) => void;
  reset: () => void;
};
export function Settings({ state, setState, notify, reset }: Props) {
  const [backup, setBackup] = useState<string | null>(null);
  const s = state.settings;
  const patch = (v: Partial<SettingsType>) =>
    setState({ ...state, settings: { ...s, ...v } });
  const fields = (list: [keyof SettingsType, string, string?][]) =>
    list.map(([key, label, hint]) => (
      <Numeric
        key={key}
        label={label}
        hint={hint}
        value={s[key] as number}
        onChange={(v) => patch({ [key]: v })}
      />
    ));
  const updateF = (f: Filament) =>
      setState({
        ...state,
        filaments: state.filaments.map((i) => (i.id === f.id ? f : i)),
      }),
    updateP = (p: Printer) =>
      setState({
        ...state,
        printers: state.printers.map((i) => (i.id === p.id ? p : i)),
      }),
    updateC = (c: Channel) =>
      setState({
        ...state,
        channels: state.channels.map((i) => (i.id === c.id ? c : i)),
      });
  return (
    <div className="settings-page">
      <div className="page-intro">
        <span className="eyebrow">A BASE DOS SEUS CÁLCULOS</span>
        <h1>Seu negócio, suas regras.</h1>
        <p>Configure uma vez. Refine sempre que precisar.</p>
      </div>
      <div className="note">
        Valores iniciais são exemplos editáveis. Taxas de canais começam em
        zero. Não há atualização automática de tarifas ou impostos.
      </div>
      <details className="panel" open>
        <summary>
          Filamentos <span className="count">{state.filaments.length}</span>
        </summary>
        {state.filaments.map((f) => (
          <div className="config-card" key={f.id}>
            <div className="section-row">
              <h3>{f.name}</h3>
              <button
                className="icon-button danger"
                aria-label={`Excluir ${f.name}`}
                disabled={
                  state.filaments.length === 1 ||
                  f.id === state.simulation.filamentId
                }
                onClick={() => {
                  if (confirm("Excluir este filamento?"))
                    setState({
                      ...state,
                      filaments: state.filaments.filter((i) => i.id !== f.id),
                    });
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="form-grid">
              <TextField
                label="Nome"
                value={f.name}
                onChange={(name) => updateF({ ...f, name })}
              />
              <TextField
                label="Fabricante"
                value={f.manufacturer}
                onChange={(manufacturer) => updateF({ ...f, manufacturer })}
              />
              <Select
                label="Tipo"
                value={f.type}
                options={["PLA", "PETG", "ABS", "ASA", "TPU", "Outro"].map(
                  (n) => ({ id: n, name: n }),
                )}
                onChange={(type) => updateF({ ...f, type })}
              />
              <TextField
                label="Cor"
                value={f.color}
                onChange={(color) => updateF({ ...f, color })}
              />
              {(
                [
                  ["weight", "Peso do rolo (g)"],
                  ["price", "Preço do rolo (R$)"],
                  ["shipping", "Frete pago (R$)"],
                  ["extra", "Outros custos (R$)"],
                ] as const
              ).map(([k, l]) => (
                <Numeric
                  key={k}
                  label={l}
                  value={f[k]}
                  min={k === "weight" ? 1 : 0}
                  onChange={(v) => updateF({ ...f, [k]: v })}
                />
              ))}
            </div>
            <p className="muted small">
              Total do rolo: {money(f.price + f.shipping + f.extra)} · Custo/g:{" "}
              {money(
                f.weight > 0
                  ? (f.price + f.shipping + f.extra) / f.weight
                  : null,
                4,
              )}
            </p>
          </div>
        ))}
        <button
          className="secondary"
          onClick={() =>
            setState({
              ...state,
              filaments: [
                ...state.filaments,
                {
                  id: id(),
                  name: "Novo filamento",
                  manufacturer: "",
                  type: "PLA",
                  color: "",
                  weight: 1000,
                  price: 90,
                  shipping: 0,
                  extra: 0,
                },
              ],
            })
          }
        >
          <Plus size={16} />
          Novo filamento
        </button>
      </details>
      <details className="panel">
        <summary>
          Impressoras <span className="count">{state.printers.length}</span>
        </summary>
        {state.printers.map((p) => (
          <div className="config-card" key={p.id}>
            <div className="section-row">
              <h3>{p.name}</h3>
              <button
                className="icon-button danger"
                aria-label={`Excluir ${p.name}`}
                disabled={
                  state.printers.length === 1 ||
                  p.id === state.simulation.printerId
                }
                onClick={() => {
                  if (confirm("Excluir esta impressora?"))
                    setState({
                      ...state,
                      printers: state.printers.filter((i) => i.id !== p.id),
                    });
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="form-grid">
              <TextField
                label="Nome"
                value={p.name}
                onChange={(name) => updateP({ ...p, name })}
              />
              <TextField
                label="Fabricante"
                value={p.manufacturer}
                onChange={(manufacturer) => updateP({ ...p, manufacturer })}
              />
              <TextField
                label="Modelo"
                value={p.model}
                onChange={(model) => updateP({ ...p, model })}
              />
              {(
                [
                  ["price", "Valor pago (R$)"],
                  ["accessories", "Acessórios (R$)"],
                  ["multicolor", "Multicolor adicional (R$)"],
                  ["extra", "Investimento adicional (R$)"],
                  ["life", "Vida útil econômica (h)"],
                  ["residual", "Valor residual (R$)"],
                  ["used", "Horas já utilizadas"],
                ] as const
              ).map(([k, l]) => (
                <Numeric
                  key={k}
                  label={l}
                  value={p[k]}
                  hint={k === "life" ? tips.depreciation : undefined}
                  min={k === "life" ? 1 : 0}
                  onChange={(v) => updateP({ ...p, [k]: v })}
                />
              ))}
            </div>
            <p className="muted small">
              Investimento:{" "}
              {money(p.price + p.accessories + p.multicolor + p.extra)} ·
              Depreciação/h:{" "}
              {money(
                p.life > 0
                  ? (p.price +
                      p.accessories +
                      p.multicolor +
                      p.extra -
                      p.residual) /
                      p.life
                  : null,
              )}
              . Se o combo já inclui multicolor, não conte o valor novamente.
            </p>
          </div>
        ))}
        <button
          className="secondary"
          onClick={() =>
            setState({
              ...state,
              printers: [
                ...state.printers,
                { ...state.printers[0], id: id(), name: "Nova impressora" },
              ],
            })
          }
        >
          <Plus size={16} />
          Nova impressora
        </button>
      </details>
      <details className="panel">
        <summary>Energia, trabalho e manutenção</summary>
        <div className="form-grid">
          {fields([
            ["kwh", "Preço do kWh (R$)"],
            ["watts", "Consumo da impressora (W)"],
            ["dryer", "Multicolor / secador (W)"],
            ["additionalWatts", "Equipamentos adicionais (W)"],
            ["hourly", "Quanto vale sua hora (R$/h)"],
            ["failure", "Taxa de falha (%)", tips.failure],
          ])}
          <Select
            label="Reserva de manutenção"
            value={s.maintenanceMode}
            options={[
              { id: "simple", name: "Valor por hora" },
              { id: "detailed", name: "Composição por peças" },
            ]}
            onChange={(maintenanceMode) =>
              patch({
                maintenanceMode:
                  maintenanceMode as SettingsType["maintenanceMode"],
              })
            }
          />
          {s.maintenanceMode === "simple" &&
            fields([["maintenance", "Manutenção (R$/h)"]])}
        </div>
        {s.maintenanceMode === "detailed" && (
          <>
            <p className="muted small">
              Informe a reserva por hora de cada peça (custo de reposição ÷
              intervalo em horas). A soma substitui a reserva simples.
            </p>
            <ItemsEditor
              title="Reservas por componente"
              items={s.maintenanceItems}
              onChange={(maintenanceItems) => patch({ maintenanceItems })}
              unitLabel="Reserva R$/h"
              scope={false}
            />
          </>
        )}
      </details>
      <details className="panel">
        <summary>Custos fixos, impostos e marketing</summary>
        <ItemsEditor
          title="Despesas mensais"
          items={s.fixedItems}
          onChange={(fixedItems) => patch({ fixedItems })}
          unitLabel="Valor mensal (R$)"
          scope={false}
        />
        <div className="form-grid">
          <Select
            label="Rateio de custos fixos"
            value={s.allocation}
            options={[
              { id: "pieces", name: "Peças por mês" },
              { id: "orders", name: "Pedidos por mês" },
              { id: "hours", name: "Horas de máquina por mês" },
            ]}
            onChange={(allocation) =>
              patch({ allocation: allocation as SettingsType["allocation"] })
            }
          />
          {fields([
            ["allocationVolume", "Volume mensal para rateio", tips.fixed],
          ])}
          <Select
            label="Regime de simulação"
            value={s.taxMode}
            options={[
              { id: "none", name: "Nenhum" },
              { id: "mei", name: "MEI (DAS mensal)" },
              { id: "percent", name: "Percentual sobre venda" },
              { id: "custom", name: "Personalizado (%)" },
            ]}
            onChange={(taxMode) =>
              patch({ taxMode: taxMode as SettingsType["taxMode"] })
            }
          />
          {s.taxMode === "mei"
            ? fields([["das", "DAS mensal (R$)"]])
            : s.taxMode !== "none"
              ? fields([["taxPercent", "Imposto sobre venda (%)"]])
              : null}
          <Select
            label="Marketing"
            value={s.marketingMode}
            options={[
              { id: "fixed", name: "Custo por pedido (R$)" },
              { id: "percent", name: "Percentual da receita (%)" },
            ]}
            onChange={(marketingMode) =>
              patch({
                marketingMode: marketingMode as SettingsType["marketingMode"],
              })
            }
          />
          {fields([
            [
              "marketing",
              s.marketingMode === "fixed"
                ? "Aquisição por pedido (R$)"
                : "Marketing (%)",
            ],
          ])}
        </div>
        <p className="muted small">
          No modo MEI, o DAS entra nos custos mensais. Não cadastre o mesmo DAS
          novamente em despesas. Valores tributários são fornecidos por você.
        </p>
      </details>
      <details className="panel">
        <summary>Canais de venda e pagamento</summary>
        <Select
          label="Canal em edição e na simulação"
          value={state.simulation.channelId}
          options={state.channels}
          onChange={(channelId) =>
            setState({
              ...state,
              simulation: { ...state.simulation, channelId },
            })
          }
        />
        {state.channels
          .filter((c) => c.id === state.simulation.channelId)
          .map((c) => (
            <div className="config-card" key={c.id}>
              <div className="form-grid">
                <TextField
                  label="Nome"
                  value={c.name}
                  onChange={(name) => updateC({ ...c, name })}
                />
                {(
                  [
                    ["percent", "Taxa do canal (%)"],
                    ["fixed", "Taxa fixa / pedido (R$)"],
                    ["payment", "Taxa de pagamento (%)"],
                    ["paymentFixed", "Pagamento fixo / pedido (R$)"],
                    ["extra", "Taxa adicional / pedido (R$)"],
                    ["shipping", "Frete subsidiado padrão (R$)"],
                    ["advertising", "Publicidade do canal (%)"],
                  ] as const
                ).map(([k, l]) => (
                  <Numeric
                    key={k}
                    label={l}
                    value={c[k]}
                    onChange={(v) => updateC({ ...c, [k]: v })}
                  />
                ))}
              </div>
              <p className="muted small">
                Frete padrão e publicidade do canal são somados aos valores da
                simulação. Evite cadastrá-los duas vezes.
              </p>
            </div>
          ))}
        <button
          className="secondary"
          onClick={() => {
            const c = {
              id: id(),
              name: "Novo canal",
              percent: 0,
              fixed: 0,
              payment: 0,
              paymentFixed: 0,
              extra: 0,
              shipping: 0,
              advertising: 0,
            };
            setState({
              ...state,
              channels: [...state.channels, c],
              simulation: { ...state.simulation, channelId: c.id },
            });
          }}
        >
          <Plus size={16} />
          Novo canal
        </button>
      </details>
      <details className="panel">
        <summary>Margens, capacidade e critérios de rentabilidade</summary>
        <div className="form-grid">
          {fields([
            ["minMargin", "Margem mínima (%)"],
            ["targetMargin", "Margem alvo (%)"],
            ["premiumMargin", "Margem premium (%)"],
            ["productiveHours", "Horas produtivas por dia"],
            ["daysMonth", "Dias produtivos por mês"],
            ["excellentHour", "Excelente: lucro/h mínimo (R$)"],
            ["goodHour", "Muito bom: lucro/h mínimo (R$)"],
            ["minimumHour", "Bom: lucro/h mínimo (R$)"],
          ])}
        </div>
        <p className="muted small">
          Excelente exige margem premium; muito bom exige margem alvo; bom exige
          margem mínima. Cada nível também exige o retorno/hora correspondente.
          Abaixo desses critérios: atenção, ruim ou prejuízo.
        </p>
      </details>
      <section className="panel">
        <h3>Seus dados ficam com você.</h3>
        <p className="muted">
          Dados salvos neste navegador e nesta origem. Exporte backups
          regularmente.
        </p>
        <div className="button-row">
          <button
            className="secondary"
            disabled={validate(state.simulation, state).length > 0}
            onClick={() => {
              const text = JSON.stringify(state, null, 2);
              parseBackup(text);
              setBackup(text);
              storage.export(state);
            }}
          >
            <Download size={16} />
            Exportar backup
          </button>
          <label
            className="secondary file-button"
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.currentTarget
                  .querySelector<HTMLInputElement>("input")
                  ?.click();
              }
            }}
          >
            <Upload size={16} />
            Importar backup
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 10_000_000)
                    throw new Error("Use um arquivo de até 10 MB.");
                  const incoming = parseBackup(await file.text());
                  if (
                    confirm(
                      "Substituir os dados atuais pelo backup validado? Exporte antes se quiser preservá-los.",
                    )
                  ) {
                    setState(incoming);
                    notify("Backup importado e validado.");
                  }
                } catch (error) {
                  notify(
                    error instanceof Error ? error.message : "Backup inválido.",
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
          <button className="secondary danger" onClick={reset}>
            <RotateCcw size={16} />
            Restaurar configurações
          </button>
        </div>
        {backup !== null && (
          <div className="backup-preview">
            <h3>Seu backup JSON está pronto.</h3>
            <p className="muted small">
              O download foi solicitado. Você também pode copiar o conteúdo e
              salvar em um arquivo .json.
            </p>
            <label className="field">
              <span>Conteúdo do backup JSON</span>
              <textarea
                readOnly
                value={backup}
                rows={8}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <div className="button-row">
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(backup);
                    notify("JSON copiado. Salve em um arquivo .json.");
                  } catch {
                    notify("Selecione o conteúdo e use Ctrl+C para copiar.");
                  }
                }}
              >
                Copiar JSON
              </button>
              <button className="secondary" onClick={() => setBackup(null)}>
                Fechar prévia
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
