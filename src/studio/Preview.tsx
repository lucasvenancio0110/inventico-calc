import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Generated } from "./geometry";
export function Preview({
  generated,
  component = "all",
  mounting = "wall",
}: {
  generated: Generated;
  component?: string;
  mounting?: "wall" | "counter";
}) {
  const host = useRef<HTMLDivElement>(null),
    api = useRef<((view: string) => void) | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "Prévia WebGL indisponível. O resumo e os arquivos validados continuam disponíveis.",
      );
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#14191e");
    const group = new THREE.Group();
    scene.add(group);
    const resources: THREE.Mesh[] = [];
    const loader = new STLLoader();
    generated.parts
      .filter((p) => component === "all" || component === p.id)
      .forEach((p) => {
        const geometry = loader.parse(p.stl.buffer);
        const material = new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.65,
          metalness: 0,
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        resources.push(mesh);
      });
    const box = new THREE.Box3().setFromObject(group),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()),
      extent = Math.max(size.x, size.y, size.z, 10);
    group.position.sub(center);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, extent * 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    camera.up.set(
      0,
      mounting === "counter" ? 0 : 1,
      mounting === "counter" ? 1 : 0,
    );
    const views = (view: string) => {
      const d = extent * 1.9;
      camera.up.set(
        0,
        mounting === "counter" ? 0 : 1,
        mounting === "counter" ? 1 : 0,
      );
      if (mounting === "counter") {
        if (view === "bottom") {
          camera.up.set(0, 1, 0);
          camera.position.set(0, 0, -d);
        } else if (view === "back") camera.position.set(0, d, 0);
        else if (view === "side") camera.position.set(d, 0, 0);
        else if (view === "front") camera.position.set(0, -d, 0);
        else camera.position.set(extent * 0.6, -d, extent * 0.4);
      } else if (view === "back") camera.position.set(0, 0, -d);
      else if (view === "side") camera.position.set(d, 0, 0);
      else if (view === "front") camera.position.set(0, 0, d);
      else camera.position.set(extent * 0.6, extent * 0.4, d);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    api.current = views;
    views("center");
    scene.add(new THREE.HemisphereLight("#ffffff", "#4b5266", 2.8));
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(100, mounting === "counter" ? -150 : 150, 200);
    scene.add(light);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Modelo 3D dos arquivos STL. Arraste para orbitar e use a roda para aproximar.",
    );
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
    const lost = (e: Event) => {
      e.preventDefault();
      setError(
        "Contexto gráfico perdido. Reabra o projeto para tentar novamente.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      resources.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [generated, component, mounting]);
  return (
    <div>
      <div ref={host} className="studio-canvas" />
      {error && <p role="status">{error}</p>}
      <div className="studio-toolbar">
        {[
          ["center", "Centralizar"],
          ["front", "Frente"],
          ["back", "Traseira"],
          ["side", "Lateral"],
        ].map(([v, n]) => (
          <button
            className="secondary"
            key={v}
            onClick={() => api.current?.(v)}
          >
            {n}
          </button>
        ))}
        {mounting === "counter" && (
          <button className="secondary" onClick={() => api.current?.("bottom")}>
            Base por baixo
          </button>
        )}
        <button
          className="secondary"
          onClick={() => {
            const el = host.current?.querySelector("canvas");
            if (el)
              el.dispatchEvent(
                new WheelEvent("wheel", { deltaY: -200, bubbles: true }),
              );
          }}
        >
          Aproximar
        </button>
      </div>
      <p className="muted small">
        A prévia usa os bytes dos STLs desta revisão. Cores são sugestões de
        filamento.
      </p>
    </div>
  );
}
