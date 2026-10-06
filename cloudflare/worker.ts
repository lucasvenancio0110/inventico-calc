export { AIBudget } from "./budget";
import { env } from "cloudflare:workers";
import { handleAsNodeRequest } from "cloudflare:node";
import { createAIService } from "../server/service";

export interface Env {
  ASSETS: Fetcher;
  AI_BUDGET: DurableObjectNamespace;
  OPENAI_API_KEY?: string;
  INVENTICO_SERVICE_TOKEN?: string;
  OPENAI_IMAGE_MODEL: string;
  OPENAI_VISION_MODEL: string;
  INVENTICO_ALLOWED_ORIGINS: string;
  INVENTICO_MAX_CALLS: string;
  INVENTICO_BUDGET_PERIOD: string;
}
const settings = env as unknown as Env;
const budget = () =>
  settings.AI_BUDGET.get(settings.AI_BUDGET.idFromName("global"));
const service = createAIService({
  key: settings.OPENAI_API_KEY ?? "",
  token: settings.INVENTICO_SERVICE_TOKEN ?? "",
  imageModel: settings.OPENAI_IMAGE_MODEL,
  visionModel: settings.OPENAI_VISION_MODEL,
  origins: settings.INVENTICO_ALLOWED_ORIGINS.split(",").map((v) => v.trim()),
  async reserve() {
    const response = await budget().fetch("https://budget/reserve", {
      method: "POST",
    });
    const body = (await response.json()) as { lease?: string; error?: string };
    if (!response.ok) throw Error(body.error ?? "Orçamento indisponível.");
    return body.lease!;
  },
  async release(lease) {
    await budget().fetch("https://budget/release", {
      method: "POST",
      body: JSON.stringify({ lease }),
    });
  },
});
service.listen(8080);
export default {
  async fetch(request: Request, environment: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      url.pathname = url.pathname.slice(4);
      return handleAsNodeRequest(
        8080,
        new Request(url, request) as Request<
          unknown,
          IncomingRequestCfProperties
        >,
      );
    }
    return environment.ASSETS.fetch(request);
  },
};
