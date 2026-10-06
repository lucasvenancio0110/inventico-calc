import type { Item, Simulation, Snapshot } from "../types";
import { calculate, decimalHours, safeDivide } from "./finance";

export function simulatePrices(input: Simulation, data: Snapshot) {
  const current = calculate(input, data);
  const anchor = current.recommended ?? current.price;
  return Array.from({ length: 9 }, (_, index) =>
    calculate(
      { ...input, price: Math.max(0, anchor * (0.5 + index * 0.125)) },
      data,
    ),
  );
}

export function simulateDiscount(input: Simulation, data: Snapshot) {
  const current = calculate(input, data);
  return calculate(
    { ...input, price: current.price * (1 - input.discount / 100) },
    data,
  );
}

export function simulateWholesale(input: Simulation, data: Snapshot) {
  const current = calculate(input, data);
  return [1, 5, 10, 20, 50, 100, 500].map((quantity, index) => {
    const factor = quantity / input.quantity;
    const discount = Math.min(100, index * input.wholesaleStep);
    const hours = decimalHours(input.hours, input.minutes) * factor;
    const scaleItems = (items: Item[]) =>
      items.map((item) =>
        item.scope === "job"
          ? { ...item, quantity: item.quantity * factor }
          : item,
      );
    const result = calculate(
      {
        ...input,
        quantity,
        grams: input.grams * factor,
        hours,
        minutes: 0,
        price: current.price * (1 - discount / 100),
        waste: input.waste.map((item) =>
          item.mode === "g" ? { ...item, value: item.value * factor } : item,
        ),
        labor: input.labor.map((item) =>
          item.scope === "job"
            ? { ...item, minutes: item.minutes * factor }
            : item,
        ),
        packaging: scaleItems(input.packaging),
        components: scaleItems(input.components),
        other: scaleItems(input.other),
      },
      data,
    );
    return {
      quantity,
      discount,
      hours,
      days: safeDivide(hours, data.settings.productiveHours),
      result,
    };
  });
}
