import { invoke } from "@tauri-apps/api/core";
import { Slot, SlotItem } from "../types/slot";
import { normalizePathKey } from "../utils/path";

const SLOTS_KEY = "desknest_slots";

const now = () => new Date().toISOString();

const defaultSlotTemplates = [
  {
    id: "slot_games",
    name: "Games",
    icon: "🎮",
    color: "purple",
    description: "Games and entertainment",
  },
  {
    id: "slot_documents",
    name: "Documents",
    icon: "📄",
    color: "blue",
    description: "Documents and office files",
  },
  {
    id: "slot_coding",
    name: "Coding",
    icon: "💻",
    color: "green",
    description: "Code projects and dev files",
  },
  {
    id: "slot_work",
    name: "Work",
    icon: "💼",
    color: "yellow",
    description: "Work-related files",
  },
  {
    id: "slot_images",
    name: "Images",
    icon: "🖼️",
    color: "pink",
    description: "Photos and images",
  },
  {
    id: "slot_videos",
    name: "Videos",
    icon: "🎬",
    color: "red",
    description: "Videos and movies",
  },
  {
    id: "slot_school",
    name: "School",
    icon: "🎓",
    color: "orange",
    description: "School and education files",
  },
  {
    id: "slot_downloads",
    name: "Downloads",
    icon: "📥",
    color: "gray",
    description: "Recently downloaded files",
  },
] as const;

interface StoredSlotItem {
  name: string;
  path: string;
  isDir: boolean;
  is_dir?: boolean;
}

interface StoredSlotSnapshot {
  name: string;
  items: StoredSlotItem[];
}

export interface PathRemap {
  fromPath: string;
  toPath: string;
}

export interface DuplicateCleanupResult {
  removed: number;
  affectedSlots: number;
}

export interface PinMostUsedResult {
  pinned: number;
}

type PersistedSlot = Partial<Slot> & { items?: Array<Partial<SlotItem>> };

function buildDefaultSlots(): Slot[] {
  const timestamp = now();
  return defaultSlotTemplates.map((template) => ({
    ...template,
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function createId(prefix: "slot" | "item"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function detectRecoveredType(path: string, isDir: boolean): SlotItem["type"] {
  if (isDir) return "folder";

  const fileName = path.split(/[\\/]/).pop() ?? path;
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();

  if (["lnk", "url"].includes(ext)) return "shortcut";
  if (["exe", "msi", "bat", "cmd", "com", "appref-ms"].includes(ext))
    return "program";
  return "file";
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeItem(input: Partial<SlotItem>): SlotItem | null {
  const rawPath = typeof input.path === "string" ? input.path.trim() : "";
  if (!rawPath) return null;

  const name =
    typeof input.name === "string" && input.name.trim().length > 0
      ? input.name.trim()
      : (rawPath.split(/[\\/]/).pop() ?? rawPath);

  const type: SlotItem["type"] =
    input.type === "file" ||
    input.type === "folder" ||
    input.type === "program" ||
    input.type === "shortcut"
      ? input.type
      : detectRecoveredType(rawPath, !name.includes("."));

  const ext = typeof input.extension === "string" ? input.extension.trim() : "";
  const useCountRaw =
    typeof input.useCount === "number" && Number.isFinite(input.useCount)
      ? input.useCount
      : 0;
  const useCount = Math.max(0, Math.floor(useCountRaw));
  const pinned = input.pinned === true;
  const lastOpenedAt =
    typeof input.lastOpenedAt === "string" && input.lastOpenedAt.trim().length > 0
      ? input.lastOpenedAt
      : undefined;

  return {
    id:
      typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : createId("item"),
    name,
    path: rawPath,
    type,
    extension: ext.length > 0 ? ext : undefined,
    pinned,
    useCount,
    lastOpenedAt,
    addedAt:
      typeof input.addedAt === "string" && input.addedAt.trim().length > 0
        ? input.addedAt
        : now(),
  };
}

function normalizeSlot(input: PersistedSlot): Slot | null {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return null;

  const itemsRaw = Array.isArray(input.items) ? input.items : [];
  const items = itemsRaw
    .map((candidate) => normalizeItem(candidate))
    .filter((item): item is SlotItem => item !== null);

  const updatedAt =
    typeof input.updatedAt === "string" && input.updatedAt.trim().length > 0
      ? input.updatedAt
      : now();

  return {
    id:
      typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : createId("slot"),
    name,
    icon:
      typeof input.icon === "string" && input.icon.trim().length > 0
        ? input.icon
        : "📁",
    color:
      typeof input.color === "string" && input.color.trim().length > 0
        ? input.color
        : "gray",
    description:
      typeof input.description === "string" ? input.description : undefined,
    items,
    createdAt:
      typeof input.createdAt === "string" && input.createdAt.trim().length > 0
        ? input.createdAt
        : updatedAt,
    updatedAt,
  };
}

function normalizeSlots(payload: unknown): Slot[] | null {
  if (!Array.isArray(payload)) return null;

  return payload
    .map((candidate) => normalizeSlot(candidate as PersistedSlot))
    .filter((slot): slot is Slot => slot !== null);
}

function readLocalSlots(): Slot[] | null {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    return normalizeSlots(parsed);
  } catch {
    return null;
  }
}

function writeLocalSlots(slots: Slot[]): void {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
  } catch (err) {
    console.error("Failed to write slots to localStorage:", err);
  }
}

function totalItemCount(slots: Slot[]): number {
  return slots.reduce((sum, slot) => sum + slot.items.length, 0);
}

function collectAssignedPathKeys(slots: Slot[]): Set<string> {
  const keys = new Set<string>();
  for (const slot of slots) {
    for (const item of slot.items) {
      const key = normalizePathKey(item.path);
      if (!key) continue;
      keys.add(key);
    }
  }
  return keys;
}

async function loadSlotsStateFromDisk(): Promise<Slot[] | null> {
  try {
    const payload = await invoke<unknown>("load_slots_state");
    if (!payload) return null;
    return normalizeSlots(payload);
  } catch {
    return null;
  }
}

async function persistSlotsStateToDisk(slots: Slot[]): Promise<void> {
  try {
    await invoke("save_slots_state", { slots });
  } catch {
    // Ignore: localStorage remains the immediate source while disk is best-effort backup.
  }
}

async function loadStoredSlotSnapshots(): Promise<StoredSlotSnapshot[] | null> {
  try {
    const payload = await invoke<unknown>("scan_slot_storage");
    if (!Array.isArray(payload)) return null;

    const snapshots: StoredSlotSnapshot[] = [];
    for (const entry of payload) {
      const candidate = entry as Partial<StoredSlotSnapshot>;
      const name =
        typeof candidate.name === "string" ? candidate.name.trim() : "";
      if (!name || !Array.isArray(candidate.items)) continue;

      const items = candidate.items
        .map((item) => {
          const raw = item as Partial<StoredSlotItem>;
          if (typeof raw.path !== "string" || raw.path.trim().length === 0)
            return null;
          const itemName =
            typeof raw.name === "string" && raw.name.trim().length > 0
              ? raw.name.trim()
              : (raw.path.split(/[\\/]/).pop() ?? raw.path);
          const isDir =
            typeof raw.isDir === "boolean"
              ? raw.isDir
              : Boolean((raw as { is_dir?: boolean }).is_dir);
          return {
            name: itemName,
            path: raw.path,
            isDir,
          };
        })
        .filter((item): item is StoredSlotItem => item !== null);

      snapshots.push({ name, items });
    }

    return snapshots;
  } catch {
    return null;
  }
}

function createRecoveredSlot(name: string): Slot {
  const timestamp = now();
  return {
    id: createId("slot"),
    name,
    icon: "📁",
    color: "gray",
    description: "Recovered from DeskNest storage",
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergeRecoveredStorage(
  current: Slot[],
  snapshots: StoredSlotSnapshot[],
): Slot[] {
  const merged = current.map((slot) => ({
    ...slot,
    items: [...slot.items],
  }));

  const slotLookup = new Map<string, Slot>();
  for (const slot of merged) {
    slotLookup.set(normalizeLabel(slot.name), slot);
  }

  for (const snapshot of snapshots) {
    if (snapshot.items.length === 0) continue;

    const slotKey = normalizeLabel(snapshot.name);
    let target = slotLookup.get(slotKey);

    if (!target) {
      target = createRecoveredSlot(snapshot.name);
      merged.push(target);
      slotLookup.set(slotKey, target);
    }

    const existingPaths = new Set(
      target.items
        .map((item) => normalizePathKey(item.path))
        .filter((key) => key.length > 0),
    );

    for (const stored of snapshot.items) {
      const pathKey = normalizePathKey(stored.path);
      if (!pathKey) continue;
      if (existingPaths.has(pathKey)) continue;

      const ext = stored.isDir
        ? undefined
        : (stored.name.split(".").pop() ?? "").toLowerCase() || undefined;

      target.items.push({
        id: createId("item"),
        name: stored.name,
        path: stored.path,
        type: detectRecoveredType(stored.path, stored.isDir),
        extension: ext,
        addedAt: now(),
      });

      existingPaths.add(pathKey);
      target.updatedAt = now();
    }
  }

  return merged;
}

function shouldPreferDisk(localSlots: Slot[], diskSlots: Slot[]): boolean {
  const localCount = totalItemCount(localSlots);
  const diskCount = totalItemCount(diskSlots);

  if (diskCount === 0) return false;
  if (localCount === 0) return true;
  return diskCount > localCount;
}

export async function recoverSlotsOnStartup(): Promise<void> {
  const localSlots = loadSlots();
  let working = localSlots;

  const diskSlots = await loadSlotsStateFromDisk();
  if (diskSlots && shouldPreferDisk(localSlots, diskSlots)) {
    working = diskSlots;
    writeLocalSlots(working);
  }

  if (totalItemCount(working) === 0) {
    const snapshots = await loadStoredSlotSnapshots();
    if (snapshots && snapshots.length > 0) {
      const recovered = mergeRecoveredStorage(working, snapshots);
      if (totalItemCount(recovered) > 0) {
        working = recovered;
        writeLocalSlots(working);
      }
    }
  }

  await persistSlotsStateToDisk(working);
}

export function loadSlots(): Slot[] {
  const local = readLocalSlots();
  return local ?? buildDefaultSlots();
}

export function saveSlots(slots: Slot[]): void {
  writeLocalSlots(slots);
  void persistSlotsStateToDisk(slots);
}

export function createSlot(
  name: string,
  icon: string,
  color: string,
  description?: string,
): Slot {
  const slots = loadSlots();
  const slot: Slot = {
    id: `slot_${Date.now()}`,
    name,
    icon,
    color,
    description,
    items: [],
    createdAt: now(),
    updatedAt: now(),
  };
  saveSlots([...slots, slot]);
  return slot;
}

export function updateSlot(
  id: string,
  updates: Partial<Pick<Slot, "name" | "icon" | "color" | "description">>,
): void {
  const slots = loadSlots();
  const idx = slots.findIndex((s) => s.id === id);
  if (idx === -1) return;
  slots[idx] = { ...slots[idx], ...updates, updatedAt: now() };
  saveSlots(slots);
}

export function deleteSlot(id: string): void {
  saveSlots(loadSlots().filter((s) => s.id !== id));
}

export function addItemToSlot(
  slotId: string,
  item: Omit<SlotItem, "id" | "addedAt">,
): boolean {
  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return false;

  const pathKey = normalizePathKey(item.path);
  if (!pathKey) return false;

  const assignedKeys = collectAssignedPathKeys(slots);
  if (assignedKeys.has(pathKey)) return false;

  const useCountRaw =
    typeof item.useCount === "number" && Number.isFinite(item.useCount)
      ? item.useCount
      : 0;
  const useCount = Math.max(0, Math.floor(useCountRaw));

  slot.items.push({
    ...item,
    pinned: item.pinned === true,
    useCount,
    lastOpenedAt:
      typeof item.lastOpenedAt === "string" && item.lastOpenedAt.trim().length > 0
        ? item.lastOpenedAt
        : undefined,
    id: createId("item"),
    addedAt: now(),
  });
  slot.updatedAt = now();
  saveSlots(slots);
  return true;
}

export function getAssignedSlotPathKeys(): Set<string> {
  return collectAssignedPathKeys(loadSlots());
}

export function cleanupDuplicateSlotItems(): DuplicateCleanupResult {
  const slots = loadSlots();
  let removed = 0;
  let affectedSlots = 0;

  for (const slot of slots) {
    if (slot.items.length <= 1) continue;

    const seenPathKeys = new Set<string>();
    const seenNameTypeKeys = new Set<string>();
    const nextItems: SlotItem[] = [];
    let slotRemoved = 0;

    for (const item of slot.items) {
      const pathKey = normalizePathKey(item.path);
      const nameTypeKey = `${normalizeNameKey(item.name)}::${item.type}`;

      const duplicateByPath = pathKey.length > 0 && seenPathKeys.has(pathKey);
      const duplicateByNameType =
        normalizeNameKey(item.name).length > 0 &&
        seenNameTypeKeys.has(nameTypeKey);

      if (duplicateByPath || duplicateByNameType) {
        slotRemoved += 1;
        continue;
      }

      if (pathKey.length > 0) seenPathKeys.add(pathKey);
      if (normalizeNameKey(item.name).length > 0) {
        seenNameTypeKeys.add(nameTypeKey);
      }
      nextItems.push(item);
    }

    if (slotRemoved > 0) {
      slot.items = nextItems;
      slot.updatedAt = now();
      removed += slotRemoved;
      affectedSlots += 1;
    }
  }

  if (removed > 0) {
    saveSlots(slots);
  }

  return { removed, affectedSlots };
}

export function removeItemFromSlot(slotId: string, itemId: string): void {
  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return;
  slot.items = slot.items.filter((i) => i.id !== itemId);
  slot.updatedAt = now();
  saveSlots(slots);
}

export function removeItemsFromSlot(slotId: string, itemIds: string[]): number {
  const normalizedIds = new Set(
    itemIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  if (normalizedIds.size === 0) return 0;

  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return 0;

  const beforeCount = slot.items.length;
  slot.items = slot.items.filter((item) => !normalizedIds.has(item.id));
  const removedCount = beforeCount - slot.items.length;

  if (removedCount > 0) {
    slot.updatedAt = now();
    saveSlots(slots);
  }

  return removedCount;
}

export function updateItemInSlot(
  slotId: string,
  itemId: string,
  updates: Partial<
    Pick<
      SlotItem,
      "name" | "path" | "type" | "extension" | "pinned" | "useCount" | "lastOpenedAt"
    >
  >,
): void {
  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return;

  const idx = slot.items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  slot.items[idx] = { ...slot.items[idx], ...updates };
  slot.updatedAt = now();
  saveSlots(slots);
}

export function toggleItemPinned(slotId: string, itemId: string): boolean {
  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return false;

  const idx = slot.items.findIndex((i) => i.id === itemId);
  if (idx === -1) return false;

  const current = slot.items[idx];
  slot.items[idx] = {
    ...current,
    pinned: !current.pinned,
  };
  slot.updatedAt = now();
  saveSlots(slots);
  return true;
}

export function recordItemOpened(slotId: string, itemId: string): boolean {
  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return false;

  const idx = slot.items.findIndex((i) => i.id === itemId);
  if (idx === -1) return false;

  const current = slot.items[idx];
  const currentCount =
    typeof current.useCount === "number" && Number.isFinite(current.useCount)
      ? current.useCount
      : 0;

  slot.items[idx] = {
    ...current,
    useCount: Math.max(0, Math.floor(currentCount)) + 1,
    lastOpenedAt: now(),
  };
  slot.updatedAt = now();
  saveSlots(slots);
  return true;
}

export function pinMostUsedItems(
  slotId: string,
  limit = 5,
): PinMostUsedResult {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 5;

  const slots = loadSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || slot.items.length === 0) {
    return { pinned: 0 };
  }

  const ranked = [...slot.items]
    .map((item) => ({
      item,
      count:
        typeof item.useCount === "number" && Number.isFinite(item.useCount)
          ? Math.max(0, Math.floor(item.useCount))
          : 0,
      openedAt: item.lastOpenedAt ?? "",
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.openedAt !== b.openedAt) {
        return b.openedAt.localeCompare(a.openedAt);
      }
      return a.item.name.localeCompare(b.item.name);
    });

  if (ranked.length === 0) {
    return { pinned: 0 };
  }

  const targetIds = new Set(ranked.slice(0, safeLimit).map((entry) => entry.item.id));
  let changed = 0;

  slot.items = slot.items.map((item) => {
    if (!targetIds.has(item.id) || item.pinned) return item;
    changed += 1;
    return { ...item, pinned: true };
  });

  if (changed > 0) {
    slot.updatedAt = now();
    saveSlots(slots);
  }

  return { pinned: changed };
}

export function remapSlotItemPaths(remaps: PathRemap[]): number {
  if (remaps.length === 0) return 0;

  const pathMap = new Map<string, string>();
  for (const remap of remaps) {
    const fromPath =
      typeof remap.fromPath === "string" ? remap.fromPath.trim() : "";
    const toPath = typeof remap.toPath === "string" ? remap.toPath.trim() : "";
    if (!fromPath || !toPath) continue;

    const fromKey = normalizePathKey(fromPath);
    if (!fromKey) continue;
    pathMap.set(fromKey, toPath);
  }

  if (pathMap.size === 0) return 0;

  const slots = loadSlots();
  let updatedCount = 0;

  for (const slot of slots) {
    let slotChanged = false;

    slot.items = slot.items.map((item) => {
      const nextPath = pathMap.get(normalizePathKey(item.path));
      if (!nextPath) return item;

      const nextName = nextPath.split(/[\\/]/).pop() ?? item.name;
      const isDir = item.type === "folder" || !nextName.includes(".");
      const nextType = detectRecoveredType(nextPath, isDir);
      const nextExt = isDir
        ? undefined
        : (nextName.split(".").pop() ?? "").toLowerCase() || undefined;

      updatedCount += 1;
      slotChanged = true;

      return {
        ...item,
        name: nextName,
        path: nextPath,
        type: nextType,
        extension: nextExt,
      };
    });

    if (slotChanged) {
      slot.updatedAt = now();
    }
  }

  if (updatedCount > 0) {
    saveSlots(slots);
  }

  return updatedCount;
}
