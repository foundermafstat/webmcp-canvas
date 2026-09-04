import type { CanvasDocument } from "./types";

export interface SceneRepository {
  load(): CanvasDocument | null;
  save(document: CanvasDocument): void;
}

export class MemorySceneRepository implements SceneRepository {
  private value: CanvasDocument | null;

  constructor(initial: CanvasDocument | null = null) {
    this.value = initial ? structuredClone(initial) : null;
  }

  load() {
    return this.value ? structuredClone(this.value) : null;
  }

  save(document: CanvasDocument) {
    this.value = structuredClone(document);
  }
}

const STORAGE_KEY = "voice-canvas:document:prototype-v1";

export class LocalSceneRepository implements SceneRepository {
  constructor(private readonly storage: Storage) {}

  load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CanvasDocument;
      if (
        parsed.schemaVersion !== 1 ||
        !Number.isInteger(parsed.documentVersion) ||
        !Array.isArray(parsed.events) ||
        typeof parsed.objects !== "object"
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  save(document: CanvasDocument) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(document));
  }
}
