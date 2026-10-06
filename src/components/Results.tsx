import { ArrowUpRight, Clock3, Layers3, Sparkles } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Result } from "../types";
import { money, num, Stat, tips } from "./ui";
const colors = [
  "#ccf582",
  "#87b6ff",
  "#b5a2ed",
  "#e9bc74",
  "#7bd2bb",
  "#f49b9b",
  "#8494a6",
];
export function Results({ r }: { r: Result }) {
  const chart = r.lines.filter((l) => l.value > 0);
  return (
    <div className="results">
      <div className="result-header">
        <span className="eyebrow">
          <span className="live-dot" /> RESULTADO EM TEMPO REAL
        </span>
        <span className="muted small">
          {r.quantity} {r.quantity === 1 ? "unidade" : "unidades"} / lote
        </span>
      </div>
      <div className="hero-result">
        <div>
          <span className="eyebrow">LUCRO POR HORA DE MÁQUINA</span>
          <h2>
            {money(r.profitHour)}
            <span>/h</span>
          </h2>
          <p>O retorno de cada hora da sua impressora.</p>
        </div>
        <span className="hero-icon">
          <ArrowUpRight size={30} />
        </span>
        <div className="hero-footer">
          <span className={`status ${r.profit <= 0 ? "negative" : ""}`}>
            {r.status}
          </span>
          <span>{r.message}</span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Custo real / un."
          value={money(r.total / r.quantity)}
          hint="Inclui produção, taxas sobre venda e custos comerciais."
        />
        <Stat
          label="Preço recomendado"
          value={money(r.recommended)}
          hint="Preço unitário para atingir a margem alvo configurada."
        />
        <Stat label="Lucro líquido / lote" value={money(r.profit)} accent />
        <Stat
          label="Margem líquida"
          value={`${num(r.margin)}%`}
          hint={tips.margin}
        />
      </div>
      {(r.recommended === null ||
        r.minimum === null ||
        r.premium === null ||
        r.breakEven === null) && (
        <div className="alert">
          Uma ou mais faixas de preço são inviáveis: taxas + margem chegam a
          100% ou mais. Ajuste as configurações. “—” indica que não existe preço
          calculável.
        </div>
      )}
      <section className="panel">
        <div className="section-row">
          <h3>
            <Layers3 size={17} />
            Para onde vai cada centavo
          </h3>
          <span className="muted small">Por lote</span>
        </div>
        <div className="cost-visual">
          <div className="donut">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={chart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {chart.map((l, i) => (
                    <Cell key={l.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{
                    background: "#20252b",
                    border: "1px solid #414850",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <small>CUSTO TOTAL</small>
              <strong>{money(r.total)}</strong>
            </div>
          </div>
          <div className="cost-summary">
            <span>
              Produção <b>{money(r.production)}</b>
            </span>
            <span>
              Venda e distribuição <b>{money(r.total - r.production)}</b>
            </span>
            <span>
              Consumo real <b>{num(r.consumption, 2)} g</b>
            </span>
            <span>
              Tempo humano <b>{num(r.humanHours * 60)} min</b>
            </span>
          </div>
        </div>
        <details className="breakdown">
          <summary>Ver composição completa</summary>
          {r.lines.map((l) => (
            <div className="cost-line" key={l.name}>
              <span>{l.name}</span>
              <b>{money(l.value)}</b>
            </div>
          ))}
          <div className="cost-line total">
            <span>Custo total real</span>
            <b>{money(r.total)}</b>
          </div>
        </details>
      </section>
      <section className="panel">
        <div className="section-row">
          <h3>
            <Sparkles size={17} />
            Sua régua de preços
          </h3>
          <span className="muted small">Por unidade</span>
        </div>
        <div className="price-grid">
          {[
            ["Equilíbrio", r.breakEven],
            ["Mínimo", r.minimum],
            ["Recomendado", r.recommended],
            ["Premium", r.premium],
          ].map(([name, value]) => (
            <div
              key={String(name)}
              className={name === "Recomendado" ? "selected" : ""}
            >
              <span>{name}</span>
              <strong>{money(value as number | null)}</strong>
            </div>
          ))}
        </div>
        <p className="muted small">
          Margens sobre a receita, com todas as taxas configuradas.{" "}
          {tips.breakEven}
        </p>
      </section>
      <details className="panel">
        <summary>
          <Clock3 size={17} /> Indicadores complementares
        </summary>
        <div className="stats-grid compact">
          <Stat label="Faturamento / lote" value={money(r.revenue)} />
          <Stat label="Faturamento / h" value={money(r.revenueHour)} />
          <Stat label="Custo / h" value={money(r.costHour)} />
          <Stat label="Filamento / g" value={money(r.materialPerGram, 4)} />
          <Stat label="Produto pronto / g útil" value={money(r.costGram, 4)} />
          <Stat
            label="Markup"
            value={`${num(r.markup, 2)}×`}
            hint={tips.markup}
          />
          <Stat label="Markup %" value={`${num(r.markupPercent)}%`} />
          <Stat
            label="ROI por produto"
            value={`${num(r.roi)}%`}
            hint={tips.roi}
          />
          <Stat
            label="Vida útil usada / lote"
            value={`${num(r.lifePercent, 3)}%`}
            hint={tips.depreciation}
          />
          <Stat label="Perdas adicionais" value={`${num(r.waste, 2)} g`} />
        </div>
      </details>
    </div>
  );
}
