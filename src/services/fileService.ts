import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { normalizePathKey } from "../utils/path";

export interface DesktopFile {
  name: string;
  path: string;
  isDir: boolean;
}

interface StoredSlotItem {
  name: string;
  path: string;
  isDir?: boolean;
  is_dir?: boolean;
}

interface StoredSlotSnapshot {
  name: string;
  items: StoredSlotItem[];
}

export interface RestorePathMapping {
  fromPath: string;
  toPath: string;
}

export interface RestoreAllResult {
  moved: number;
  failed: number;
  skipped: number;
  mappings: RestorePathMapping[];
}

export async function openFile(path: string): Promise<string> {
  const raw = typeof path === "string" ? path.trim() : "";
  if (!raw) {
    throw new Error("Missing item path");
  }

  const normalized = raw.replace(/\//g, "\\");
  let resolvedFromBackend: string | null = null;

  try {
    const openedPath = await invoke<string>("open_item_path", {
      path: normalized,
    });

    if (typeof openedPath === "string" && openedPath.trim().length > 0) {
      return openedPath;
    }
  } catch (invokeError) {
    console.warn("open_item_path failed, trying opener fallback:", invokeError);

    try {
      const resolved = await invoke<string>("resolve_item_path", {
        path: normalized,
      });
      if (typeof resolved === "string" && resolved.trim().length > 0) {
        resolvedFromBackend = resolved.trim();
      }
    } catch (resolveError) {
      console.warn("resolve_item_path fallback failed:", resolveError);
    }
  }

  // Fallback: try opening with plugin-opener directly from the frontend.
  const candidates = Array.from(
    new Set([resolvedFromBackend ?? "", raw, normalized]),
  ).filter((candidate) => candidate.length > 0);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      await openPath(candidate);
      return candidate.replace(/\\/g, "/");
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Unable to open path: ${raw}. ${lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown error")}`,
  );
}

export async function moveItemToSlot(
  path: string,
  slotName: string,
): Promise<string> {
  return invoke<string>("move_item_to_slot", { path, slotName });
}

export async function moveItemToDesktop(path: string): Promise<string> {
  return invoke<string>("move_item_to_desktop", { path });
}

export async function scanDesktop(): Promise<DesktopFile[]> {
  return invoke<DesktopFile[]>("scan_desktop");
}

export async function enableAutostart(): Promise<void> {
  await invoke("enable_autostart");
}

export async function disableAutostart(): Promise<void> {
  await invoke("disable_autostart");
}

export async function restoreAllSlotItemsToDesktop(): Promise<RestoreAllResult> {
  const payload = await invoke<unknown>("scan_slot_storage");
  if (!Array.isArray(payload)) {
    return { moved: 0, failed: 0, skipped: 0, mappings: [] };
  }

  const uniquePaths = new Set<string>();
  const targets: string[] = [];
  let skipped = 0;

  for (const entry of payload) {
    const snapshot = entry as Partial<StoredSlotSnapshot>;
    if (!Array.isArray(snapshot.items)) continue;

    for (const item of snapshot.items) {
      const candidate = item as Partial<StoredSlotItem>;
      const path =
        typeof candidate.path === "string" ? candidate.path.trim() : "";
      if (!path) {
        skipped += 1;
        continue;
      }

      const key = normalizePathKey(path);
      if (uniquePaths.has(key)) {
        skipped += 1;
        continue;
      }

      uniquePaths.add(key);
      targets.push(path);
    }
  }

  let moved = 0;
  let failed = 0;
  const mappings: RestorePathMapping[] = [];

  for (const fromPath of targets) {
    try {
      const toPath = await moveItemToDesktop(fromPath);
      mappings.push({ fromPath, toPath });
      moved += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    moved,
    failed,
    skipped,
    mappings,
  };
}
