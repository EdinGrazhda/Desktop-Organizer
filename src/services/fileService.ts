import { invoke } from "@tauri-apps/api/core";
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

export async function openFile(path: string): Promise<void> {
  const normalized = path.replace(/\//g, "\\");
  await invoke("open_item_path", { path: normalized });
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
