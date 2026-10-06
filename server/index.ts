import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAIService } from "./service.ts";

const budgetFile = resolve(".inventico-ai-budget.json");
const limit = Number(process.env.INVENTICO_MAX_CALLS ?? 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
  throw Error("INVENTICO_MAX_CALLS deve estar entre 1 e 10000.");
const epoch = process.env.INVENTICO_BUDGET_PERIOD ?? "default";
const reserve = () => {
  const old = existsSync(budgetFile)
    ? JSON.parse(readFileSync(budgetFile, "utf8"))
    : { period: epoch, calls: 0 };
  if (
    typeof old.period !== "string" ||
    !Number.isInteger(old.calls) ||
    old.calls < 0
  )
    throw Error("Arquivo de orçamento inválido; chamadas bloqueadas.");
  const calls = old.period === epoch ? old.calls : 0;
  if (calls >= limit)
    throw Error(
      "Limite global de chamadas atingido. Revise o orçamento no servidor.",
    );
  writeFileSync(
    budgetFile,
    JSON.stringify({ period: epoch, calls: calls + 1 }),
    { mode: 0o600 },
  );
};
const service = createAIService({
  key: process.env.OPENAI_API_KEY ?? "",
  token: process.env.INVENTICO_SERVICE_TOKEN ?? "",
  imageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
  visionModel: process.env.OPENAI_VISION_MODEL ?? "",
  origins: (
    process.env.INVENTICO_ALLOWED_ORIGINS ??
    "http://localhost:5173,http://localhost:4173"
  )
    .split(",")
    .map((s) => s.trim()),
  reserve,
});
service.requestTimeout = 200000;
service.headersTimeout = 10000;
service.listen(Number(process.env.INVENTICO_AI_PORT ?? 8787), "127.0.0.1", () =>
  console.log(
    "Serviço Inventico: http://127.0.0.1:" +
      (process.env.INVENTICO_AI_PORT ?? 8787) +
      " — configure a credencial temporária no app.",
  ),
);
