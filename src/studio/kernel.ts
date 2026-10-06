import Module, { type ManifoldToplevel } from "manifold-3d";
import wasmURL from "manifold-3d/manifold.wasm?url";
let initialized: Promise<ManifoldToplevel> | null = null;
export function loadKernel() {
  if (!initialized)
    initialized = Module(
      import.meta.env.MODE === "test"
        ? undefined
        : { locateFile: () => wasmURL },
    ).then((m) => {
      m.setup();
      return m;
    });
  return initialized;
}
