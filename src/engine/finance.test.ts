import { describe, expect, it } from "vitest";
import { defaults } from "../defaults";
import {
  calculate,
  calculateTargetPrice,
  calculateFailureReserve,
  calculateItems,
  calculatePrinterPayback,
  calculateMonthlyBreakEven,
  decimalHours,
  validate,
  calculateShippingSubsidy,
  calculateROI,
} from "./finance";
import { parseBackup } from "../storage/repository";
const setup = () => {
  const d = defaults();
  return { d, i: d.simulation };
};
describe("Exemplo Wave e fundamentos", () => {
  it("341,09 g, 11h18 e 20 min humanos", () => {
    const { d, i } = setup(),
      r = calculate(i, d);
    expect(r.hours).toBe(11.3);
    expect(r.lines[0].value).toBeCloseTo(30.6981, 8);
    expect(r.lines[2].value).toBeCloseTo(2.034, 8);
    expect(r.lines[5].value).toBe(10);
  });
  it("horas decimais não confundem minutos com centésimos", () => {
    expect(decimalHours(11, 18)).toBe(11.3);
    expect(decimalHours(0, 30)).toBe(0.5);
  });
  it("rolo inclui frete e adicionais", () => {
    const { d, i } = setup();
    d.filaments[0].shipping = 10;
    d.filaments[0].extra = 5;
    expect(calculate(i, d).materialPerGram).toBe(0.105);
  });
  it("depreciação com acessórios e residual", () => {
    const { d, i } = setup();
    Object.assign(d.printers[0], {
      price: 4000,
      accessories: 500,
      multicolor: 500,
      extra: 100,
      residual: 100,
      life: 10000,
    });
    expect(calculate(i, d).lines[3].value).toBeCloseTo(5.65);
  });
  it("manutenção simples e detalhada", () => {
    const { d, i } = setup();
    expect(calculate(i, d).lines[4].value).toBeCloseTo(2.26);
    d.settings.maintenanceMode = "detailed";
    d.settings.maintenanceItems = [
      { id: "x", name: "Bico", quantity: 1, cost: 0.5, scope: "job" },
    ];
    expect(calculate(i, d).lines[4].value).toBe(5.65);
  });
  it("desenvolvimento diluído por unidade", () => {
    const { d, i } = setup();
    Object.assign(i, {
      developmentHours: 3,
      developmentRate: 30,
      developmentUnits: 50,
      quantity: 10,
    });
    expect(calculate(i, d).lines[6].value).toBe(18);
  });
  it("perdas em gramas e percentual", () => {
    const { d, i } = setup();
    i.grams = 100;
    i.waste = [
      { id: "a", name: "Purga", mode: "g", value: 10 },
      { id: "b", name: "Suporte", mode: "%", value: 20 },
    ];
    const r = calculate(i, d);
    expect(r.consumption).toBe(130);
    expect(r.lines[1].value).toBeCloseTo(2.7);
  });
  it("custos por lote e unidade", () => {
    expect(
      calculateItems(
        [
          { id: "a", name: "Argola", quantity: 1, cost: 2, scope: "unit" },
          { id: "b", name: "Caixa", quantity: 1, cost: 3, scope: "job" },
        ],
        10,
      ),
    ).toBe(23);
  });
  it("tempo humano por unidade escala no lote", () => {
    const { d, i } = setup();
    i.quantity = 10;
    i.labor = [{ id: "a", name: "Montar", minutes: 2, scope: "unit" }];
    expect(calculate(i, d).lines[5].value).toBe(10);
  });
  it("reserva de falha usa tentativas esperadas", () => {
    expect(calculateFailureReserve(90, 10)).toBe(10);
    expect(calculateFailureReserve(90, 0)).toBe(0);
  });
});
describe("Preços, taxas e rentabilidade", () => {
  it("margem não é markup", () => {
    expect(calculateTargetPrice(60, 0, 40)).toBe(100);
  });
  it("taxas múltiplas e margem alvo", () => {
    expect(calculateTargetPrice(60, 0.1 + 0.06 + 0.04, 20)).toBeCloseTo(100);
  });
  it("denominador impossível retorna null", () => {
    expect(calculateTargetPrice(60, 0.7, 30)).toBeNull();
    expect(calculateTargetPrice(60, 1.1, 0)).toBeNull();
  });
  it("taxa fixa é por pedido; percentual incide sobre faturamento", () => {
    const { d, i } = setup();
    i.quantity = 10;
    i.price = 100;
    Object.assign(d.channels[0], {
      fixed: 5,
      percent: 10,
      payment: 2,
      paymentFixed: 3,
      extra: 1,
    });
    const r = calculate(i, d);
    expect(r.lines.find((l) => l.name === "Canal e taxas fixas")?.value).toBe(
      106,
    );
    expect(r.lines.find((l) => l.name === "Pagamento")?.value).toBe(23);
  });
  it("imposto, marketing e frete", () => {
    const { d, i } = setup();
    i.price = 100;
    i.shippingReal = 20;
    i.shippingCharged = 12;
    Object.assign(d.settings, {
      taxMode: "percent",
      taxPercent: 6,
      marketingMode: "percent",
      marketing: 8,
    });
    const r = calculate(i, d);
    expect(r.lines.find((l) => l.name === "Impostos sobre venda")?.value).toBe(
      6,
    );
    expect(r.lines.find((l) => l.name === "Marketing")?.value).toBe(8);
    expect(r.lines.find((l) => l.name === "Frete líquido")?.value).toBe(8);
    expect(calculateShippingSubsidy(20, 20)).toBe(0);
    expect(calculateShippingSubsidy(20, 25)).toBe(-5);
  });
  it("preço de equilíbrio zera lucro e alvo atinge margem", () => {
    const { d, i } = setup();
    d.channels[0].percent = 13;
    d.channels[0].fixed = 6;
    const r = calculate(i, d);
    expect(calculate({ ...i, price: r.breakEven }, d).profit).toBeCloseTo(0, 9);
    expect(calculate({ ...i, price: r.recommended }, d).margin).toBeCloseTo(
      35,
      9,
    );
  });
  it("resultado concilia todos os centavos e indicadores", () => {
    const { d, i } = setup(),
      r = calculate(i, d);
    expect(r.lines.reduce((a, l) => a + l.value, 0)).toBeCloseTo(r.total, 10);
    expect(r.profit).toBeCloseTo(r.revenue - r.total);
    expect(r.profitHour).toBeCloseTo(r.profit / 11.3);
    expect(r.roi).toBeCloseTo((r.profit / r.total) * 100);
    expect(r.markup).toBeCloseTo(r.revenue / r.total);
    expect(r.markupPercent).toBeCloseTo((r.revenue / r.total - 1) * 100);
  });
  it("payback e ponto de equilíbrio arredondam para cima", () => {
    expect(calculatePrinterPayback(4000, 30)).toBe(134);
    expect(calculateMonthlyBreakEven(301, 30)).toBe(11);
    expect(calculatePrinterPayback(4000, -5)).toBeNull();
    expect(calculateMonthlyBreakEven(300, 0)).toBeNull();
    expect(calculateROI(1, 0)).toBeNull();
  });
  it("custos fixos e MEI são rateados uma vez", () => {
    const { d, i } = setup();
    d.settings.fixedItems = [
      { id: "x", name: "Internet", quantity: 1, cost: 300, scope: "unit" },
    ];
    Object.assign(d.settings, {
      taxMode: "mei",
      das: 100,
      allocationVolume: 100,
    });
    const r = calculate(i, d);
    expect(r.fixedAllocated).toBe(4);
    expect(r.monthlyFixed).toBe(400);
    expect(r.contribution).toBeCloseTo(r.profit + 4);
  });
  it("rateio por pedidos e por horas", () => {
    const { d, i } = setup();
    d.settings.fixedItems = [
      { id: "x", name: "Aluguel", quantity: 1, cost: 300, scope: "job" },
    ];
    d.settings.allocation = "orders";
    d.settings.allocationVolume = 100;
    i.quantity = 10;
    expect(calculate(i, d).fixedAllocated).toBe(3);
    d.settings.allocation = "hours";
    expect(calculate(i, d).fixedAllocated).toBeCloseTo(33.9);
  });
  it("capacidade e payback temporal", () => {
    const { d, i } = setup(),
      r = calculate(i, d);
    expect(r.unitsDay).toBeCloseTo(20 / 11.3);
    expect(r.unitsMonth).toBeCloseTo(600 / 11.3);
    expect(r.paybackHours).toBeCloseTo(r.paybackUnits! * 11.3);
    expect(r.paybackDays).toBeCloseTo(r.paybackHours! / 20);
  });
  it("zero horas não produz Infinity ou NaN", () => {
    const { d, i } = setup();
    i.hours = 0;
    i.minutes = 0;
    const r = calculate(i, d);
    expect(r.profitHour).toBeNull();
    expect(r.unitsDay).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/Infinity|NaN/);
  });
  it("preço nulo usa recomendado; zero é preço manual", () => {
    const { d, i } = setup();
    i.price = null;
    expect(calculate(i, d).margin).toBeCloseTo(35);
    i.price = 0;
    expect(calculate(i, d).revenue).toBe(0);
    expect(calculate(i, d).profit).toBeLessThan(0);
  });
});
describe("Validação e backups", () => {
  it.each(["grams", "hours", "minutes", "quantity", "price"] as const)(
    "rejeita %s negativo",
    (key) => {
      const { d, i } = setup();
      i[key] = -1;
      expect(() => calculate(i, d)).toThrow();
    },
  );
  it("rejeita quantidade zero, vida zero, falhas 100 e diluição zero", () => {
    const { d, i } = setup();
    i.quantity = 0;
    d.printers[0].life = 0;
    d.settings.failure = 100;
    i.developmentUnits = 0;
    expect(validate(i, d).length).toBeGreaterThanOrEqual(4);
  });
  it("rejeita NaN e números infinitos", () => {
    const { d, i } = setup();
    i.grams = NaN;
    i.hours = Infinity;
    expect(() => calculate(i, d)).toThrow();
  });
  it("backup válido faz roundtrip", () => {
    const d = defaults();
    expect(parseBackup(JSON.stringify(d))).toEqual(d);
  });
  it.each(["{}", '{"version":2}', "não é json"])(
    "rejeita backup inválido %s",
    (raw) => expect(() => parseBackup(raw)).toThrow(),
  );
  it("rejeita conteúdo de listas malformado", () => {
    const d = defaults();
    const raw = JSON.stringify({
      ...d,
      simulation: { ...d.simulation, packaging: [{ name: "inválido" }] },
    });
    expect(() => parseBackup(raw)).toThrow();
  });
  it("rejeita modos desconhecidos", () => {
    const d = defaults();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...d,
          settings: { ...d.settings, allocation: "unknown" },
        }),
      ),
    ).toThrow();
  });
  it("recalcula resultados salvos em vez de confiar no backup", () => {
    const d = defaults();
    d.products = [
      {
        id: "x",
        createdAt: new Date().toISOString(),
        input: d.simulation,
        snapshot: {
          settings: d.settings,
          filaments: d.filaments,
          printers: d.printers,
          channels: d.channels,
        },
        result: { ...calculate(d.simulation, d), profit: 999999 },
      },
    ];
    expect(parseBackup(JSON.stringify(d)).products[0].result.profit).not.toBe(
      999999,
    );
  });
});

describe("Regressões de persistência e projeção", () => {
  it("backup aceita preço automático nulo", () => {
    const d = defaults();
    d.simulation.price = null;
    expect(parseBackup(JSON.stringify(d)).simulation.price).toBeNull();
  });
  it("projeção mensal desconta despesas fixas apenas uma vez", () => {
    const d = defaults();
    d.settings.fixedItems = [
      { id: "x", name: "Software", quantity: 1, cost: 300, scope: "unit" },
    ];
    const r = calculate(d.simulation, d);
    expect(r.monthlyProfit).toBeCloseTo(r.unitsMonth! * r.contribution - 300);
  });
  it("venda grátis com custo é prejuízo", () => {
    const d = defaults();
    d.simulation.price = 0;
    expect(calculate(d.simulation, d).status).toBe("PREJUÍZO");
  });
  it("rejeita denominadores positivos próximos a zero", () => {
    const d = defaults();
    d.printers[0].life = Number.MIN_VALUE;
    expect(() => calculate(d.simulation, d)).toThrow();
  });
});
