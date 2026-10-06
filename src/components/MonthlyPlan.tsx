import { useState } from "react";
import type { Result } from "../types";
import { money, num, Numeric, Stat } from "./ui";

export function MonthlyPlan({ r, daysMonth }: { r: Result; daysMonth: number }) {
  const [daily, setDaily] = useState(1);
  const [days, setDays] = useState(daysMonth);
  const valid = Number.isInteger(daily) && daily >= 0 && daily <= 100000 &&
    Number.isInteger(days) && days >= 1 && days <= 31;
  const units = daily * days;
  const profit = units * r.contribution - r.monthlyFixed;
  const exceedsCapacity = r.unitsDay !== null && daily > r.unitsDay;
  return (
    <section className="panel monthly-plan">
      <span className="eyebrow">SEU PRODUTO NO MÊS</span>
      <h3>Quanto eu ganharia por mês?</h3>
      <p>Use o produto e o preço desta simulação para planejar suas vendas.</p>
      <div className="stats-grid">
        <Numeric label="Peças vendidas por dia" value={daily} onChange={setDaily} min={0} max={100000} />
        <Numeric label="Dias de venda no mês" value={days} onChange={setDays} min={1} max={31} />
      </div>
      {valid ? <>
        <div className="hero-result">
          <span className="eyebrow">LUCRO ESTIMADO NO MÊS</span>
          <h2>{money(profit)}</h2>
          <p>Vendendo {num(daily, 0)} {daily === 1 ? "peça" : "peças"} por dia durante {days} dias, a {money(r.price)} cada, você {profit >= 0 ? "teria um lucro" : "teria um prejuízo"} estimado de {money(Math.abs(profit))} no mês.</p>
        </div>
        <div className="stats-grid">
          <Stat label="Peças no mês" value={num(units, 0)} />
          <Stat label="Faturamento no mês" value={money(units * r.price)} />
          <Stat label="Lucro médio por dia de venda" value={money(profit / days)} />
          <Stat label="Horas de máquina no mês" value={`${num(units * r.hours / r.quantity)} h`} />
        </div>
        {exceedsCapacity && <p className="alert">Essa meta ultrapassa a capacidade estimada de {num(r.unitsDay)} peças por dia da impressora configurada. Você precisaria de mais horas ou máquinas para produzir esse volume.</p>}
      </> : <p className="alert">Informe uma quantidade inteira de peças e de 1 a 31 dias.</p>}
      <p className="note">Estimativa supondo a venda de todas as peças, com o mesmo preço, custos e proporção de peças por pedido desta simulação. Inclui a mão de obra e desconta os custos fixos mensais uma vez, atribuindo-os a este produto. Não some esta projeção com a de outros produtos: os custos fixos seriam repetidos. Não garante vendas nem desconta paradas.</p>
    </section>
  );
}
