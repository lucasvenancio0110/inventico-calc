import { defaults } from "../defaults";
import { calculate, validate } from "../engine/finance";
import type { State } from "../types";
const KEY = "inventico-calc:v1";
const item = { id: "", name: "", quantity: 0, cost: 0, scope: "unit" as const };
function shape(value: unknown, example: unknown, path: string): void {
  if (example === null) {
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw new Error(`Valor inválido: ${path}`);
    return;
  }
  if (Array.isArray(example)) {
    if (!Array.isArray(value)) throw new Error(`Lista inválida: ${path}`);
    if (example.length)
      value.forEach((v, i) => shape(v, example[0], `${path}[${i}]`));
    return;
  }
  if (typeof example === "object" && example) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`Objeto inválido: ${path}`);
    for (const [k, v] of Object.entries(example)) {
      shape((value as Record<string, unknown>)[k], v, `${path}.${k}`);
    }
    return;
  }
  if (
    typeof value !== typeof example ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    throw new Error(`Campo inválido: ${path}`);
}
export function parseBackup(raw: string): State {
  const value: unknown = JSON.parse(raw),
    template = defaults();
  template.simulation.price = null;
  template.simulation.packaging = [item];
  template.simulation.components = [item];
  template.simulation.other = [item];
  template.simulation.waste = [{ id: "", name: "", value: 0, mode: "g" }];
  template.settings.fixedItems = [item];
  template.settings.maintenanceItems = [item];
  shape(value, template, "backup");
  const state = value as State;
  if (state.version !== 1) throw new Error("Versão de backup incompatível.");
  const inspect = (
    s: Pick<State, "settings" | "filaments" | "printers" | "channels">,
    input: State["simulation"],
  ) => {
    if (
      !["pieces", "orders", "hours"].includes(s.settings.allocation) ||
      !["none", "mei", "percent", "custom"].includes(s.settings.taxMode) ||
      !["fixed", "percent"].includes(s.settings.marketingMode) ||
      !["simple", "detailed"].includes(s.settings.maintenanceMode)
    )
      throw new Error("Configuração de cálculo inválida.");
    if (
      [
        ...input.packaging,
        ...input.components,
        ...input.other,
        ...input.labor,
        ...s.settings.fixedItems,
        ...s.settings.maintenanceItems,
      ].some((i) => !["unit", "job"].includes(i.scope)) ||
      input.waste.some((w) => !["g", "%"].includes(w.mode))
    )
      throw new Error("Unidade de custo inválida.");
    for (const list of [s.filaments, s.printers, s.channels])
      if (new Set(list.map((i) => i.id)).size !== list.length)
        throw new Error("IDs duplicados no cadastro.");
    const errors = validate(input, s);
    if (errors.length) throw new Error(errors[0]);
  };
  inspect(state, state.simulation);
  state.products = state.products.map((p) => {
    shape(
      p,
      {
        id: "",
        createdAt: "",
        input: template.simulation,
        snapshot: {
          settings: template.settings,
          filaments: template.filaments,
          printers: template.printers,
          channels: template.channels,
        },
      },
      "produto",
    );
    inspect(p.snapshot, p.input);
    if (Number.isNaN(Date.parse(p.createdAt)))
      throw new Error("Data inválida.");
    return { ...p, result: calculate(p.input, p.snapshot) };
  });
  return state;
}
export const storage = {
  load(): { state: State; error: string | null } {
    try {
      const raw = localStorage.getItem(KEY);
      return { state: raw ? parseBackup(raw) : defaults(), error: null };
    } catch {
      return {
        state: defaults(),
        error:
          "Não foi possível ler os dados salvos. O conteúdo anterior foi preservado. Importe um backup válido antes de continuar.",
      };
    }
  },
  save(state: State) {
    localStorage.setItem(KEY, JSON.stringify(state));
  },
  export(state: State) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventico-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Keep the Blob alive while the browser starts the download.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};
