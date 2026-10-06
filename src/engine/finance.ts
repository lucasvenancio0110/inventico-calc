import type { Item, Simulation, Snapshot, Result, Settings } from "../types";
export const safeDivide = (a: number, b: number): number | null =>
  b > 0 && Number.isFinite(a / b) ? a / b : null;
export const decimalHours = (hours: number, minutes: number) =>
  hours + minutes / 60;
export const calculateMaterialCost = (grams: number, costPerGram: number) =>
  grams * costPerGram;
export const calculateEnergyCost = (
  watts: number,
  hours: number,
  kwh: number,
) => (watts / 1000) * hours * kwh;
export const calculateMachineDepreciation = (
  investment: number,
  residual: number,
  life: number,
  hours: number,
) => (Math.max(0, investment - residual) / life) * hours;
export const calculateMaintenanceCost = (rate: number, hours: number) =>
  rate * hours;
export const calculateLaborCost = (minutes: number, rate: number) =>
  (minutes / 60) * rate;
export const calculateDevelopmentAllocation = (
  hours: number,
  rate: number,
  units: number,
) => (hours * rate) / units;
export const calculateItems = (items: Item[], quantity: number) =>
  items.reduce(
    (s, i) => s + i.quantity * i.cost * (i.scope === "unit" ? quantity : 1),
    0,
  );
export const calculateFailureReserve = (retryCost: number, percent: number) =>
  (retryCost * percent) / (100 - percent);
export const calculateShippingSubsidy = (real: number, charged: number) =>
  real - charged;
export const calculateTargetPrice = (
  cost: number,
  rate: number,
  margin: number,
): number | null =>
  rate + margin / 100 >= 1 - Number.EPSILON
    ? null
    : safeDivide(Math.max(0, cost), 1 - rate - margin / 100);
export const calculateBreakEvenPrice = (cost: number, rate: number) =>
  calculateTargetPrice(cost, rate, 0);
export const calculateProfit = (revenue: number, cost: number) =>
  revenue - cost;
export const calculateMargin = (profit: number, revenue: number) =>
  revenue > 0 ? (profit / revenue) * 100 : 0;
export const calculateROI = (profit: number, cost: number) =>
  cost > 0 ? (profit / cost) * 100 : null;
export const calculatePrinterPayback = (
  investment: number,
  unitProfit: number,
) => {
  const units = safeDivide(investment, unitProfit);
  return units === null ? null : Math.ceil(units);
};
export const calculateMonthlyBreakEven = (
  fixed: number,
  contribution: number,
) => {
  const units = safeDivide(fixed, contribution);
  return units === null ? null : Math.ceil(units);
};
export function classify(margin: number, hour: number | null, s: Settings) {
  if (margin < 0)
    return ["PREJUÍZO", "O preço não cobre os custos desta operação."];
  if (hour === null)
    return [
      "ATENÇÃO",
      "Informe o tempo de impressão para avaliar a capacidade da máquina.",
    ];
  if (margin >= s.premiumMargin && hour >= s.excellentHour)
    return [
      "EXCELENTE",
      "O produto utiliza muito bem a capacidade da máquina.",
    ];
  if (margin >= s.targetMargin && hour >= s.goodHour)
    return ["MUITO BOM", "Boa margem e ótimo retorno pelo tempo de máquina."];
  if (margin >= s.minMargin && hour >= s.minimumHour)
    return ["BOM", "O produto remunera os custos e gera um retorno saudável."];
  if (margin <= 0 || hour < 1)
    return ["RUIM", "Retorno muito baixo. Revise o preço ou os custos."];
  return [
    "ATENÇÃO",
    "O produto gera lucro, mas a margem ou o retorno por hora merece atenção.",
  ];
}
export function validate(input: Simulation, data: Snapshot): string[] {
  const errors: string[] = [];
  const labels: Record<string, string> = {
    grams: "peso",
    hours: "horas",
    minutes: "minutos",
    quantity: "quantidade",
    price: "preço",
    weight: "peso do rolo",
    cost: "custo",
    value: "valor",
    settings: "financeiro",
    filaments: "filamentos",
    printers: "impressoras",
    channels: "canais",
    kwh: "kWh",
    hourly: "valor da hora",
    failure: "taxa de falha",
  };
  const check = (v: unknown, path: string) => {
    if (
      typeof v === "number" &&
      (!Number.isFinite(v) || v < 0 || v > 1e12 || (v > 0 && v < 1e-9))
    )
      errors.push(`${path}: use um número válido, maior ou igual a zero.`);
    else if (v && typeof v === "object")
      Object.entries(v).forEach(([k, n]) =>
        check(n, `${path} ${labels[k] ?? k}`),
      );
  };
  check(input, "Simulação");
  check(data, "Configuração");
  if (input.quantity < 1 || !Number.isInteger(input.quantity))
    errors.push("A quantidade deve ser um número inteiro maior que zero.");
  if (input.minutes >= 60) errors.push("Use minutos entre 0 e 59.");
  if (input.developmentUnits < 1)
    errors.push("A diluição de desenvolvimento deve ser maior que zero.");
  if (data.filaments.some((f) => f.weight < 1))
    errors.push("O peso de cada rolo deve ser maior que zero.");
  if (
    data.printers.some(
      (p) =>
        p.life < 1 ||
        p.residual > p.price + p.accessories + p.multicolor + p.extra,
    )
  )
    errors.push("Confira a vida útil e o valor residual da impressora.");
  if (
    !data.filaments.some((f) => f.id === input.filamentId) ||
    !data.printers.some((p) => p.id === input.printerId) ||
    !data.channels.some((c) => c.id === input.channelId)
  )
    errors.push("Selecione filamento, impressora e canal válidos.");
  const s = data.settings;
  if (s.failure >= 100) errors.push("A taxa de falha deve ser menor que 100%.");
  if (s.allocationVolume < 1)
    errors.push("O volume de rateio deve ser maior que zero.");
  if (s.productiveHours > 24 || s.daysMonth > 31)
    errors.push("Use até 24 horas por dia e 31 dias por mês.");
  if (
    [
      s.minMargin,
      s.targetMargin,
      s.premiumMargin,
      s.taxPercent,
      s.marketingMode === "percent" ? s.marketing : 0,
      input.discount,
    ].some((n) => n > 100)
  )
    errors.push("Os percentuais devem ficar entre 0 e 100%.");
  if (input.wholesaleStep > 100 / 6)
    errors.push("O desconto por faixa deve ser no máximo 16,66%.");
  if (s.minimumHour > s.goodHour || s.goodHour > s.excellentHour)
    errors.push(
      "Os critérios de lucro/h devem seguir a ordem bom, muito bom e excelente.",
    );
  if (s.minMargin > s.targetMargin || s.targetMargin > s.premiumMargin)
    errors.push("As margens devem seguir a ordem mínima, alvo e premium.");
  if (
    data.channels.some((c) =>
      [c.percent, c.payment, c.advertising].some((n) => n > 100),
    )
  )
    errors.push("Confira os percentuais dos canais.");
  return errors;
}
export function calculate(input: Simulation, data: Snapshot): Result {
  const errors = validate(input, data);
  if (errors.length) throw new Error(errors.join(" "));
  const s = data.settings,
    f = data.filaments.find((f) => f.id === input.filamentId)!,
    p = data.printers.find((p) => p.id === input.printerId)!,
    c = data.channels.find((c) => c.id === input.channelId)!;
  const q = input.quantity,
    h = decimalHours(input.hours, input.minutes),
    g = (f.price + f.shipping + f.extra) / f.weight;
  const waste = input.waste.reduce(
    (a, w) => a + (w.mode === "g" ? w.value : (input.grams * w.value) / 100),
    0,
  );
  const investment = p.price + p.accessories + p.multicolor + p.extra;
  const material = input.grams * g,
    loss = waste * g,
    energy = calculateEnergyCost(
      s.watts + s.dryer + s.additionalWatts,
      h,
      s.kwh,
    ),
    depreciation = calculateMachineDepreciation(
      investment,
      p.residual,
      p.life,
      h,
    );
  const maintenance = calculateMaintenanceCost(
    s.maintenanceMode === "simple"
      ? s.maintenance
      : calculateItems(s.maintenanceItems, 1),
    h,
  );
  const humanMinutes = input.labor.reduce(
      (a, l) => a + l.minutes * (l.scope === "unit" ? q : 1),
      0,
    ),
    labor = calculateLaborCost(humanMinutes, s.hourly);
  const development =
    calculateDevelopmentAllocation(
      input.developmentHours,
      input.developmentRate,
      input.developmentUnits,
    ) * q;
  const monthlyFixed =
    calculateItems(s.fixedItems, 1) + (s.taxMode === "mei" ? s.das : 0);
  const fixedAllocated =
    (monthlyFixed / s.allocationVolume) *
    (s.allocation === "pieces" ? q : s.allocation === "orders" ? 1 : h);
  const failure = calculateFailureReserve(
    material + loss + energy + depreciation + maintenance,
    s.failure,
  );
  const lines = [
    { name: "Material útil", value: material },
    { name: "Perdas e suportes", value: loss },
    { name: "Energia", value: energy },
    { name: "Depreciação", value: depreciation },
    { name: "Manutenção", value: maintenance },
    { name: "Mão de obra", value: labor },
    { name: "Desenvolvimento rateado", value: development },
    { name: "Embalagem", value: calculateItems(input.packaging, q) },
    { name: "Componentes", value: calculateItems(input.components, q) },
    { name: "Reserva para falhas", value: failure },
    { name: "Custos fixos rateados", value: fixedAllocated },
    { name: "Outros custos", value: calculateItems(input.other, q) },
  ];
  const production = lines.reduce((a, l) => a + l.value, 0);
  const shipping =
    calculateShippingSubsidy(input.shippingReal, input.shippingCharged) +
    c.shipping;
  const marketingFixed = s.marketingMode === "fixed" ? s.marketing : 0;
  const base =
    production + c.fixed + c.paymentFixed + c.extra + shipping + marketingFixed;
  const taxRate =
    s.taxMode === "percent" || s.taxMode === "custom" ? s.taxPercent / 100 : 0;
  const marketingRate =
    (s.marketingMode === "percent" ? s.marketing / 100 : 0) +
    c.advertising / 100;
  const rate = (c.percent + c.payment) / 100 + taxRate + marketingRate;
  const recommended = calculateTargetPrice(base / q, rate, s.targetMargin),
    price = input.price ?? recommended ?? 0,
    revenue = price * q;
  lines.push(
    {
      name: "Canal e taxas fixas",
      value: (revenue * c.percent) / 100 + c.fixed + c.extra,
    },
    { name: "Pagamento", value: (revenue * c.payment) / 100 + c.paymentFixed },
    { name: "Marketing", value: revenue * marketingRate + marketingFixed },
    { name: "Frete líquido", value: shipping },
    { name: "Impostos sobre venda", value: revenue * taxRate },
  );
  const total = base + revenue * rate,
    profit = calculateProfit(revenue, total),
    margin = calculateMargin(profit, revenue),
    profitHour = safeDivide(profit, h),
    contribution = (profit + fixedAllocated) / q;
  const unitsDay = h > 0 ? (s.productiveHours / h) * q : null,
    unitsMonth = unitsDay === null ? null : unitsDay * s.daysMonth;
  const paybackUnits = calculatePrinterPayback(investment, profit / q),
    paybackHours = paybackUnits === null ? null : (paybackUnits * h) / q;
  const [status, message] =
    profit < 0
      ? ["PREJUÍZO", "O preço não cobre os custos desta operação."]
      : classify(margin, profitHour, s);
  return {
    hours: h,
    quantity: q,
    waste,
    consumption: input.grams + waste,
    materialPerGram: g,
    investment,
    lifePercent: (h / p.life) * 100,
    humanHours: humanMinutes / 60,
    production,
    base,
    rate,
    fixedAllocated,
    monthlyFixed,
    lines,
    price,
    revenue,
    total,
    profit,
    margin,
    markup: safeDivide(revenue, total),
    markupPercent: total > 0 ? (revenue / total - 1) * 100 : null,
    roi: calculateROI(profit, total),
    profitHour,
    revenueHour: safeDivide(revenue, h),
    costHour: safeDivide(total, h),
    costGram: safeDivide(total, input.grams),
    breakEven: calculateBreakEvenPrice(base / q, rate),
    minimum: calculateTargetPrice(base / q, rate, s.minMargin),
    recommended,
    premium: calculateTargetPrice(base / q, rate, s.premiumMargin),
    contribution,
    monthlyBreakEven: calculateMonthlyBreakEven(monthlyFixed, contribution),
    paybackUnits,
    paybackHours,
    paybackDays:
      paybackHours === null
        ? null
        : safeDivide(paybackHours, s.productiveHours),
    unitsDay,
    unitsWeek: unitsDay === null ? null : unitsDay * 7,
    unitsMonth,
    monthlyRevenue: unitsMonth === null ? null : unitsMonth * price,
    monthlyProfit:
      unitsMonth === null ? null : unitsMonth * contribution - monthlyFixed,
    status,
    message,
  };
}
