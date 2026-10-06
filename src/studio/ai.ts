import { z } from "zod";
export const planSchema = z
  .object({
    status: z.enum(["proposal", "clarification", "unsuitable", "failure"]),
    summary: z.string().max(1500),
    mounting: z.enum(["wall", "counter"]),
    backing: z.enum(["none", "silhouette", "outline", "plate"]),
    supportColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    baseColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    targetWidthMm: z.number().finite().min(5).max(1000).nullable(),
    layers: z
      .array(
        z.object({
          regionId: z.string().max(80),
          heightMm: z.number().finite().min(0.2).max(50),
        }),
      )
      .max(128),
    palette: z
      .array(
        z.object({
          regionId: z.string().max(80),
          color: z.string().regex(/^#[0-9a-f]{6}$/i),
        }),
      )
      .max(128),
    assumptions: z.array(z.string().max(500)).max(20),
    questions: z.array(z.string().max(500)).max(10),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export function validatePlan(value: unknown, ids: string[]) {
  const p = planSchema.parse(value);
  if ([...p.layers, ...p.palette].some((r) => !ids.includes(r.regionId)))
    throw Error("Plano faz referência a uma região inexistente.");
  return p;
}
export function endpointURL(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    )
  )
    throw Error("Use HTTPS ou um serviço local em localhost.");
  if (u.username || u.password || u.search || u.hash)
    throw Error("Endpoint inválido.");
  return u.origin + u.pathname.replace(/\/+$/, "");
}
