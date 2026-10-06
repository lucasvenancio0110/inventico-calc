import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Target } from "lucide-react";
import {
  simulatePrices,
  simulateDiscount,
  simulateWholesale,
} from "../engine/scenarios";
import type { State, Result } from "../types";
import { money, num, Numeric, Stat, tips } from "../components/ui";
export function Analysis({
  state,
  r,
  setState,
}: {
  state: State;
  r: Result;
  setState: (s: State) => void;
}) {
  const input = state.simulation;
  const rows = simulatePrices(input, state);
  const discounted = simulateDiscount(input, state);
  const wholesale = simulateWholesale(input, state);
  return (
    <div className="analysis-page">
      <div className="page-intro">
        <span className="eyebrow">DECISÕES COM MAIS CLAREZA</span>
        <h1>Faça sua máquina valer mais.</h1>
        <p>
          Análise de {input.name || "produto sem nome"} · {num(r.hours)} h por
          lote
        </p>
      </div>
      <div className="stats-grid four">
        <Stat
          label="Margem de contribuição / un."
          value={money(r.contribution)}
          hint={tips.contribution}
        />
        <Stat
          label="Equilíbrio mensal"
          value={`${num(r.monthlyBreakEven, 0)} un.`}
          hint="Custos fixos mensais ÷ contribuição unitária, arredondado para cima."
        />
        <Stat
          label="Receita para equilíbrio"
          value={
            r.monthlyBreakEven === null
              ? "—"
              : money(r.monthlyBreakEven * r.price)
          }
        />
        <Stat
          label="ROI por produto"
          value={`${num(r.roi)}%`}
          hint={tips.roi}
        />
      </div>
      <section className="panel payback">
        <div>
          <span className="eyebrow">
            <Target size={16} /> PAYBACK DA IMPRESSORA
          </span>
          <h2>
            {num(r.paybackUnits, 0)} <small>unidades</small>
          </h2>
          <p>
            {r.paybackUnits === null
              ? "Este produto precisa gerar lucro para pagar o investimento."
              : `Vendendo este produto nestas condições, aproximadamente ${num(r.paybackUnits, 0)} unidades pagariam o investimento de ${money(r.investment)}.`}
          </p>
          <span className="muted small">{tips.payback}</span>
        </div>
        <div className="payback-side">
          <Stat
            label="Horas de impressão necessárias"
            value={`${num(r.paybackHours)} h`}
          />
          <Stat label="Dias de produção" value={num(r.paybackDays)} />
        </div>
      </section>
      <section className="panel">
        <h3>
          <TrendingUp size={18} /> Capacidade produtiva
        </h3>
        <div className="stats-grid four">
          <Stat label="Unidades / dia" value={num(r.unitsDay)} />
          <Stat label="Unidades / semana (7 dias)" value={num(r.unitsWeek)} />
          <Stat label="Unidades / mês" value={num(r.unitsMonth)} />
          <Stat label="Faturamento / mês" value={money(r.monthlyRevenue)} />
          <Stat label="Lucro / mês" value={money(r.monthlyProfit)} />
          <Stat
            label="Horas disponíveis / mês"
            value={`${num(state.settings.productiveHours * state.settings.daysMonth)} h`}
          />
        </div>
        <p className="note">
          Projeção teórica baseada na capacidade configurada, em lotes
          equivalentes contínuos. Não garante demanda e não desconta paradas ou
          tempo extra de reimpressão. O lucro mensal usa a contribuição
          projetada e desconta os custos fixos mensais uma única vez.
        </p>
      </section>
      <section className="panel">
        <div className="section-row">
          <h3>Preço × lucro do lote</h3>
          <span className="muted small">Encontre seu ponto de virada</span>
        </div>
        <div className="line-chart">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={rows.map((x) => ({
                price: Number(x.price.toFixed(2)),
                profit: x.profit,
              }))}
              margin={{ top: 15, right: 20, bottom: 10, left: 0 }}
            >
              <CartesianGrid stroke="#2b3036" strokeDasharray="3 6" />
              <XAxis
                dataKey="price"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke="#90999f"
                tickFormatter={(v) => `R$${num(Number(v), 0)}`}
              />
              <YAxis
                stroke="#90999f"
                tickFormatter={(v) => num(Number(v), 0)}
              />
              <Tooltip
                labelFormatter={(v) => money(Number(v))}
                formatter={(v) => [money(Number(v)), "Lucro do lote"]}
                contentStyle={{
                  background: "#20252b",
                  border: "1px solid #414850",
                  borderRadius: 12,
                }}
              />
              <ReferenceLine y={0} stroke="#f0aa7c" />
              {r.breakEven !== null && (
                <ReferenceLine
                  x={r.breakEven}
                  stroke="#f0aa7c"
                  label={{
                    value: "Equilíbrio",
                    fill: "#f0aa7c",
                    position: "insideTopRight",
                  }}
                />
              )}
              <Line
                type="linear"
                dataKey="profit"
                stroke="#ccf582"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="table-scroll">
          <table className="price-table">
            <thead>
              <tr>
                {[
                  "Preço/un.",
                  "Custo/un.",
                  "Lucro/un.",
                  "Margem",
                  "Markup",
                  "Lucro/h",
                  "ROI",
                  "Status",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={i}>
                  <td>{money(x.price)}</td>
                  <td>{money(x.total / x.quantity)}</td>
                  <td className={x.profit < 0 ? "loss" : "gain"}>
                    {money(x.profit / x.quantity)}
                  </td>
                  <td>{num(x.margin)}%</td>
                  <td>{num(x.markup, 2)}×</td>
                  <td>{money(x.profitHour)}</td>
                  <td>{num(x.roi)}%</td>
                  <td>
                    <span className="mini-status">{x.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h3>Até onde o desconto vale a pena?</h3>
        <div className="discount-layout">
          <Numeric
            label="Desconto sobre o preço atual"
            suffix="%"
            max={100}
            value={input.discount}
            onChange={(discount) =>
              setState({ ...state, simulation: { ...input, discount } })
            }
          />
          <Stat
            label="Preço normal → com desconto"
            value={`${money(r.price)} → ${money(discounted.price)}`}
          />
          <Stat
            label="Lucro do lote antes → depois"
            value={`${money(r.profit)} → ${money(discounted.profit)}`}
          />
          <Stat
            label="Margem antes → depois"
            value={`${num(r.margin)}% → ${num(discounted.margin)}%`}
          />
        </div>
        {discounted.profit < 0 ? (
          <div className="alert">
            PREJUÍZO: o desconto leva o preço abaixo do equilíbrio.
          </div>
        ) : discounted.margin < state.settings.minMargin ? (
          <div className="note">
            Atenção: o desconto reduz a margem abaixo do mínimo configurado.
          </div>
        ) : null}
      </section>
      <section className="panel">
        <h3>Atacado, com os pés no chão.</h3>
        <div className="narrow">
          <Numeric
            label="Acréscimo de desconto por faixa"
            suffix="%"
            max={100 / 6}
            value={input.wholesaleStep}
            onChange={(wholesaleStep) =>
              setState({ ...state, simulation: { ...input, wholesaleStep } })
            }
          />
        </div>
        <p className="muted small">
          Custos e tempo de impressão escalam por lotes equivalentes; taxas
          fixas, aquisição e frete ocorrem uma vez por pedido. Não presume ganho
          de eficiência nem múltiplas máquinas.
        </p>
        <div className="table-scroll">
          <table className="wholesale-table">
            <thead>
              <tr>
                {[
                  "Unidades",
                  "Desconto",
                  "Preço/un.",
                  "Faturamento",
                  "Custo total",
                  "Lucro total",
                  "Lucro/un.",
                  "Margem",
                  "Horas",
                  "Dias",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wholesale.map(
                ({ quantity: q, discount, hours, days, result }) => {
                  return (
                    <tr key={q}>
                      <td>{q}</td>
                      <td>{num(discount)}%</td>
                      <td>{money(result.price)}</td>
                      <td>{money(result.revenue)}</td>
                      <td>{money(result.total)}</td>
                      <td className={result.profit < 0 ? "loss" : "gain"}>
                        {money(result.profit)}
                      </td>
                      <td>{money(result.profit / q)}</td>
                      <td
                        className={
                          result.margin < state.settings.minMargin ? "loss" : ""
                        }
                      >
                        {num(result.margin)}%
                        {result.margin < state.settings.minMargin ? " ⚠" : ""}
                      </td>
                      <td>{num(hours)}</td>
                      <td>{num(days)}</td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
        <p className="muted small">⚠ Margem abaixo do mínimo configurado.</p>
      </section>
    </div>
  );
}
