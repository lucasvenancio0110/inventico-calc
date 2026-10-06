import { useEffect, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import type { Item } from "../types";
import { id } from "../defaults";
export const money = (n: number | null, decimals = 2) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(n);
export const num = (n: number | null, digits = 1) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
        n,
      );
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  max,
  optional = false,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  min?: number;
  max?: number;
  optional?: boolean;
  hint?: string;
}) {
  const [text, setText] = useState(
    value === null
      ? ""
      : Number.isFinite(value)
        ? String(value).replace(".", ",")
        : "",
  );
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus)
      setText(
        value === null
          ? ""
          : Number.isFinite(value)
            ? String(value).replace(".", ",")
            : "",
      );
  }, [value, focus]);
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized),
    invalid =
      (!optional && text === "") ||
      (!/^\d*([.,]\d*)?$/.test(text) &&
        !/^\d{1,3}(\.\d{3})*,\d*$/.test(text)) ||
      !Number.isFinite(parsed) ||
      parsed < min ||
      (max !== undefined && parsed > max);
  return (
    <label className="field">
      <span>
        {label}
        {hint && (
          <span title={hint} className="help" tabIndex={0}>
            <Info size={13} />
            <span className="tooltip">{hint}</span>
          </span>
        )}
      </span>
      <div className={`input-wrap ${invalid ? "invalid" : ""}`}>
        <input
          inputMode="decimal"
          value={text}
          placeholder={optional ? "Automático" : "0"}
          aria-invalid={invalid}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const n = Number(
              t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t,
            );
            if (t === "" && optional) onChange(null);
            else if (
              t !== "" &&
              Number.isFinite(n) &&
              (/^\d*([.,]\d*)?$/.test(t) || /^\d{1,3}(\.\d{3})*,\d*$/.test(t))
            )
              onChange(n);
            else onChange(NaN);
          }}
        />
        {suffix && <small>{suffix}</small>}
      </div>
      {invalid && (
        <small className="error">
          Use {min}
          {max !== undefined ? ` a ${max}` : " ou mais"}, em formato numérico.
        </small>
      )}
    </label>
  );
}
export function Numeric({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <NumberField
      label={label}
      value={value}
      onChange={(v) => onChange(v ?? 0)}
      {...rest}
    />
  );
}
export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ItemsEditor({
  title,
  items,
  onChange,
  unitLabel = "Custo unitário",
  scope = true,
}: {
  title: string;
  items: Item[];
  onChange: (v: Item[]) => void;
  unitLabel?: string;
  scope?: boolean;
}) {
  return (
    <section className="editor">
      <div className="section-row">
        <h3>{title}</h3>
        <button
          className="text-button"
          onClick={() =>
            onChange([
              ...items,
              {
                id: id(),
                name: "Novo item",
                quantity: 1,
                cost: 0,
                scope: "unit",
              },
            ])
          }
        >
          <Plus size={15} />
          Adicionar
        </button>
      </div>
      {items.length === 0 && (
        <p className="muted small">Nenhum item adicionado.</p>
      )}
      {items.map((item, index) => (
        <div className="item-row" key={item.id}>
          <TextField
            label="Nome"
            value={item.name}
            onChange={(name) =>
              onChange(items.map((i, j) => (j === index ? { ...i, name } : i)))
            }
          />
          <Numeric
            label="Quantidade"
            value={item.quantity}
            onChange={(quantity) =>
              onChange(
                items.map((i, j) => (j === index ? { ...i, quantity } : i)),
              )
            }
          />
          <Numeric
            label={unitLabel}
            value={item.cost}
            suffix="R$"
            onChange={(cost) =>
              onChange(items.map((i, j) => (j === index ? { ...i, cost } : i)))
            }
          />
          {scope && (
            <Select
              label="Aplicação"
              value={item.scope}
              options={[
                { id: "unit", name: "Por unidade" },
                { id: "job", name: "Por lote / pedido" },
              ]}
              onChange={(v) =>
                onChange(
                  items.map((i, j) =>
                    j === index ? { ...i, scope: v as Item["scope"] } : i,
                  ),
                )
              }
            />
          )}
          <button
            className="icon-button danger"
            aria-label={`Excluir ${item.name}`}
            onClick={() => onChange(items.filter((_, j) => j !== index))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </section>
  );
}
export function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <div className="eyebrow">
        {label}
        {hint && (
          <span className="help" tabIndex={0}>
            <Info size={13} />
            <span className="tooltip">{hint}</span>
          </span>
        )}
      </div>
      <strong>{value}</strong>
    </div>
  );
}
export const tips = {
  margin: "Lucro líquido dividido pelo faturamento. Não confundir com markup.",
  markup:
    "Preço dividido pelo custo total real. Markup % é (multiplicador − 1) × 100.",
  roi: "Nesta ferramenta: lucro líquido ÷ custo total real × 100.",
  payback:
    "Investimento da impressora dividido pelo lucro unitário, já após depreciação. Estimativa conservadora; não é fluxo de caixa.",
  contribution:
    "Receita menos custos, excluindo o rateio mensal. Usada para cobrir os custos fixos.",
  depreciation:
    "Investimento menos valor residual, dividido pela vida útil em horas.",
  failure:
    "Custo repetível × taxa de falha ÷ (1 − taxa). Inclui material, energia, depreciação e manutenção; não repete trabalho humano.",
  breakEven: "Preço em que a receita cobre custos e taxas, sem lucro.",
  hour: "Lucro do lote dividido pelo tempo de máquina do lote.",
  fixed: "Despesas mensais rateadas pelo volume planejado.",
  variable: "Custos que variam com a produção ou com a venda.",
};
