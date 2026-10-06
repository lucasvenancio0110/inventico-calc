import type { Env } from "./worker";
type BudgetState = {
  period: string;
  calls: number;
  lease: string | null;
  expires: number;
};
export class AIBudget {
  constructor(
    private state: DurableObjectState,
    private environment: Env,
  ) {}
  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (request.method !== "POST" || !["/reserve", "/release"].includes(path))
      return Response.json({ error: "Rota inexistente." }, { status: 404 });
    return this.state.blockConcurrencyWhile(async () => {
      const limit = Number(this.environment.INVENTICO_MAX_CALLS);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
        return Response.json(
          { error: "Limite de chamadas inválido." },
          { status: 503 },
        );
      const period = this.environment.INVENTICO_BUDGET_PERIOD;
      const old = await this.state.storage.get<BudgetState>("budget");
      const current: BudgetState = old ?? {
        period,
        calls: 0,
        lease: null,
        expires: 0,
      };
      if (path === "/release") {
        const data = (await request.json()) as { lease?: string };
        if (data.lease && current.lease === data.lease) {
          current.lease = null;
          await this.state.storage.put("budget", current);
        }
        return Response.json({ released: true });
      }
      if (current.lease && current.expires > Date.now())
        return Response.json(
          { error: "Uma geração está em andamento." },
          { status: 429 },
        );
      if (current.period !== period) {
        current.period = period;
        current.calls = 0;
      }
      if (current.calls >= limit)
        return Response.json(
          {
            error:
              "Limite global de chamadas atingido. Revise o orçamento no servidor.",
          },
          { status: 429 },
        );
      current.calls += 1;
      current.lease = crypto.randomUUID();
      current.expires = Date.now() + 240000;
      await this.state.storage.put("budget", current);
      return Response.json({ lease: current.lease });
    });
  }
}
