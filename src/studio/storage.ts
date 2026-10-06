import { parseProject, type Project } from "./model";
import type { Generated } from "./geometry";
export type StoredProject = {
  id: string;
  draft: Project;
  validated: Project | null;
  mesh: Generated | null;
  savedRevision: string;
  updatedAt: string;
};
const DB = "inventico-3d-projects-v1";
const BUDGET = 150_000_000;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("projects", { keyPath: "id" });
    r.onerror = () =>
      reject(
        Error("Armazenamento de projetos indisponível. Exporte o projeto."),
      );
    r.onsuccess = () => resolve(r.result);
  });
}
export async function listProjects(): Promise<StoredProject[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("projects").objectStore("projects").getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function saveProject(
  project: Project,
  mesh: Generated | null,
  expected: string | null,
): Promise<StoredProject> {
  const draft = parseProject(JSON.stringify(project));
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite"),
      store = tx.objectStore("projects");
    let result: StoredProject;
    const fail = (message: string) => {
      tx.abort();
      reject(Error(message));
    };
    const get = store.get(project.projectId);
    get.onsuccess = () => {
      const old: StoredProject | undefined = get.result;
      if (old && old.savedRevision !== expected) {
        fail(
          "Projeto foi alterado em outra aba. Reabra ou exporte sua edição antes de substituir.",
        );
        return;
      }
      const all = store.getAll();
      all.onsuccess = () => {
        const records: StoredProject[] = all.result;
        const size =
          records
            .filter((r) => r.id !== draft.projectId)
            .reduce(
              (s, r) =>
                s +
                JSON.stringify(r.draft).length * 2 +
                (r.mesh?.parts.reduce((s, p) => s + p.stl.length, 0) || 0),
              0,
            ) +
          JSON.stringify(draft).length * 2 +
          (mesh?.parts.reduce((s, p) => s + p.stl.length, 0) || 0);
        if (size > BUDGET) {
          fail(
            "Orçamento local de 150 MB atingido. Exporte e remova projetos antigos.",
          );
          return;
        }
        const valid = mesh?.revision === draft.revisionId;
        result = {
          id: draft.projectId,
          draft,
          validated: valid ? draft : old?.validated || null,
          mesh: valid ? mesh : old?.mesh || null,
          savedRevision: draft.revisionId,
          updatedAt: new Date().toISOString(),
        };
        store.put(result);
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        Error(
          "Não foi possível salvar: conflito, quota ou armazenamento bloqueado. Exporte o projeto.",
        ),
      );
    };
  });
}
export async function deleteProject(id: string) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
