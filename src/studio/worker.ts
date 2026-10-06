import { generate } from "./geometry";
import { traceRaster } from "./trace";
self.onmessage = async (e) => {
  const { id, revision, kind, payload } = e.data;
  try {
    const result =
      kind === "trace"
        ? traceRaster(
            payload.data,
            payload.width,
            payload.height,
            payload.processing,
          )
        : await generate(payload.regions, payload.options, revision);
    self.postMessage({ id, revision, result });
  } catch (error) {
    self.postMessage({
      id,
      revision,
      error: error instanceof Error ? error.message : "Falha na geração.",
    });
  }
};
