import { expect, it } from "vitest";
import { defaults } from "../defaults";
import {
  simulateDiscount,
  simulatePrices,
  simulateWholesale,
} from "./scenarios";
it("desconto recompõe taxas proporcionais à receita", () => {
  const d = defaults();
  d.simulation.discount = 10;
  d.channels[0].percent = 10;
  const result = simulateDiscount(d.simulation, d);
  expect(result.price).toBeCloseTo(98.91);
  expect(
    result.lines.find((l) => l.name === "Canal e taxas fixas")?.value,
  ).toBeCloseTo(9.891);
});
it("atacado escala lote, componentes, perdas e trabalho e mantém taxas por pedido", () => {
  const d = defaults();
  d.simulation.quantity = 10;
  d.simulation.grams = 150;
  d.simulation.hours = 4;
  d.simulation.minutes = 0;
  d.simulation.wholesaleStep = 0;
  d.simulation.components = [
    { id: "x", name: "Argola", quantity: 1, cost: 2, scope: "unit" },
  ];
  d.channels[0].fixed = 5;
  const result = simulateWholesale(d.simulation, d).find(
    (x) => x.quantity === 20,
  )!;
  expect(result.hours).toBe(8);
  expect(result.result.lines.find((l) => l.name === "Componentes")?.value).toBe(
    40,
  );
  expect(
    result.result.lines.find((l) => l.name === "Canal e taxas fixas")?.value,
  ).toBe(5);
  expect(result.result.lines.find((l) => l.name === "Mão de obra")?.value).toBe(
    20,
  );
});
it("preços gerados incluem o recomendado", () => {
  const d = defaults();
  const rows = simulatePrices(d.simulation, d);
  expect(rows).toHaveLength(9);
  expect(rows[4].margin).toBeCloseTo(d.settings.targetMargin);
});
