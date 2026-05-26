import { Slot, SlotItem } from "../types/slot";

export const fileTypeRules: Record<string, string[]> = {
  documents: ["pdf", "docx", "doc", "txt", "xlsx", "xls", "pptx", "ppt", "odt", "rtf", "csv"],
  images: ["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp", "ico", "tiff"],
  videos: ["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm", "m4v"],
  coding: ["js", "ts", "tsx", "jsx", "php", "html", "css", "json", "py", "rs", "go", "java", "cs", "cpp", "c", "rb", "swift", "kt", "vue", "svelte", "sh", "yml", "yaml", "toml"],
  archives: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  programs: ["exe", "msi", "bat", "cmd", "com", "app", "dmg", "lnk", "url", "appref-ms", "desktop"],
  music: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"],
};

const slotAliases: Record<string, string[]> = {
  documents: ["documents", "docs", "work", "school", "office", "study"],
  images: ["images", "photos", "pictures", "wallpapers"],
  videos: ["videos", "movies", "films", "clips"],
  coding: ["coding", "code", "dev", "development", "programming"],
  archives: ["archives", "compressed", "zip", "downloads"],
  games: ["games", "gaming", "steam", "epic", "riot", "battle", "launcher"],
  programs: ["programs", "apps", "applications", "software", "tools", "utilities"],
  music: ["music", "audio", "songs", "podcasts"],
};

const gameNameHints = [
  "steam",
  "steamapps",
  "epic games",
  "epic",
  "riot",
  "battle.net",
  "blizzard",
  "ubisoft",
  "origin",
  "ea app",
  "rockstar",
  "launcher",
  "valorant",
  "fortnite",
  "minecraft",
  "counter-strike",
  "counter strike",
  "cs 1.6",
  "cs1.6",
  "cs-go",
  "cs2",
  "league of legends",
  "dota",
  "elden ring",
  "diablo",
  "gta",
  "world of warcraft",
];

const nonGameHints = [
  "uninstall",
  "installer",
  "install",
  "setup",
  "updater",
  "update",
  "patch",
  "crash",
  "diagnostic",
  "readme",
  "manual",
  "support",
  "helper",
  "redist",
  "redistributable",
];

function findSlotByKeywords(slots: Slot[], keywords: string[]): Slot | null {
  return slots.find((s) => keywords.some((k) => s.name.toLowerCase().includes(k))) ?? null;
}

function looksLikeGameTarget(filename: string, fullPath?: string): boolean {
  const lowerName = filename.toLowerCase();
  const lowerPath = (fullPath ?? "").toLowerCase();

  if (nonGameHints.some((hint) => lowerName.includes(hint) || lowerPath.includes(hint))) {
    return false;
  }

  return gameNameHints.some((hint) => lowerName.includes(hint) || lowerPath.includes(hint));
}

export function detectSlotFromExtension(ext: string): string | null {
  for (const [slot, exts] of Object.entries(fileTypeRules)) {
    if (exts.includes(ext.toLowerCase())) return slot;
  }
  return null;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/** Detect the SlotItem type from a path + isDir flag */
export function detectItemType(path: string, isDir = false): SlotItem["type"] {
  if (isDir) return "folder";
  const ext = getFileExtension(path.split(/[\\/]/).pop() ?? path);
  if (["exe", "msi", "bat", "cmd", "com"].includes(ext)) return "program";
  if (["lnk", "url", "appref-ms", "desktop"].includes(ext)) return "shortcut";
  return "file";
}

/**
 * Given a list of slots and a filename, find the slot that best matches
 * the file's type. Matches by category name (e.g. "coding" → "Coding" slot).
 */
export function findBestMatchingSlot(slots: Slot[], filename: string, fullPath?: string): Slot | null {
  const gamesSlot = findSlotByKeywords(slots, slotAliases.games);
  if (gamesSlot && looksLikeGameTarget(filename, fullPath)) {
    return gamesSlot;
  }

  const ext = getFileExtension(filename);
  if (!ext) return null;

  const category = detectSlotFromExtension(ext);
  if (!category) return null;

  // Exact name match first, then partial match.
  const directMatch =
    slots.find((s) => s.name.toLowerCase() === category) ??
    slots.find((s) => s.name.toLowerCase().includes(category));
  if (directMatch) return directMatch;

  const aliasMatch = findSlotByKeywords(slots, slotAliases[category] ?? []);
  return aliasMatch;
}
