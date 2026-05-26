export interface SlotColorTheme {
  bg: string;
  border: string;
  text: string;
  badge: string;
  iconShell: string;
  iconInner: string;
  iconGlow: string;
}

export const slotColorMap: Record<string, SlotColorTheme> = {
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-300",
    iconShell:
      "bg-gradient-to-br from-violet-300/35 via-purple-500/25 to-fuchsia-500/20",
    iconInner: "bg-violet-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(168,85,247,0.34)]",
  },
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-300",
    iconShell:
      "bg-gradient-to-br from-cyan-300/35 via-blue-500/25 to-indigo-500/20",
    iconInner: "bg-blue-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(59,130,246,0.34)]",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    badge: "bg-green-500/20 text-green-300",
    iconShell:
      "bg-gradient-to-br from-emerald-300/35 via-green-500/25 to-lime-500/20",
    iconInner: "bg-emerald-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(34,197,94,0.34)]",
  },
  yellow: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-300",
    iconShell:
      "bg-gradient-to-br from-amber-300/35 via-yellow-500/25 to-orange-500/20",
    iconInner: "bg-amber-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(234,179,8,0.34)]",
  },
  pink: {
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    text: "text-pink-400",
    badge: "bg-pink-500/20 text-pink-300",
    iconShell:
      "bg-gradient-to-br from-rose-300/35 via-pink-500/25 to-fuchsia-500/20",
    iconInner: "bg-rose-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(236,72,153,0.34)]",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-500/20 text-red-300",
    iconShell:
      "bg-gradient-to-br from-orange-300/35 via-red-500/25 to-rose-500/20",
    iconInner: "bg-red-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(239,68,68,0.34)]",
  },
  orange: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    badge: "bg-orange-500/20 text-orange-300",
    iconShell:
      "bg-gradient-to-br from-amber-300/35 via-orange-500/25 to-red-500/20",
    iconInner: "bg-orange-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(249,115,22,0.34)]",
  },
  gray: {
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    text: "text-gray-300",
    badge: "bg-gray-500/20 text-gray-300",
    iconShell:
      "bg-gradient-to-br from-slate-300/25 via-gray-500/20 to-zinc-500/15",
    iconInner: "bg-slate-950/45",
    iconGlow: "shadow-[0_0_22px_rgba(148,163,184,0.25)]",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-300",
    iconShell:
      "bg-gradient-to-br from-cyan-300/35 via-teal-500/25 to-sky-500/20",
    iconInner: "bg-cyan-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(6,182,212,0.34)]",
  },
  teal: {
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    text: "text-teal-400",
    badge: "bg-teal-500/20 text-teal-300",
    iconShell:
      "bg-gradient-to-br from-teal-300/35 via-emerald-500/25 to-cyan-500/20",
    iconInner: "bg-teal-950/45",
    iconGlow: "shadow-[0_0_24px_rgba(20,184,166,0.34)]",
  },
};

export const SLOT_COLORS = Object.keys(slotColorMap);

export const SLOT_ICONS = [
  "games",
  "documents",
  "coding",
  "work",
  "images",
  "videos",
  "school",
  "downloads",
  "music",
  "archive",
  "folder",
  "science",
  "home",
  "travel",
  "design",
  "library",
  "energy",
  "tools",
  "idea",
  "spark",
] as const;

export type SlotIconKey = (typeof SLOT_ICONS)[number];

const SLOT_ICON_LABELS: Record<SlotIconKey, string> = {
  games: "Games",
  documents: "Documents",
  coding: "Coding",
  work: "Work",
  images: "Images",
  videos: "Videos",
  school: "School",
  downloads: "Downloads",
  music: "Music",
  archive: "Archive",
  folder: "Folder",
  science: "Science",
  home: "Home",
  travel: "Travel",
  design: "Design",
  library: "Library",
  energy: "Energy",
  tools: "Tools",
  idea: "Idea",
  spark: "Spark",
};

const LEGACY_SLOT_ICON_MAP: Record<string, SlotIconKey> = {
  "🎮": "games",
  "📄": "documents",
  "💻": "coding",
  "💼": "work",
  "🖼️": "images",
  "🎬": "videos",
  "🎓": "school",
  "📥": "downloads",
  "🎵": "music",
  "📦": "archive",
  "📁": "folder",
  "🔬": "science",
  "🏠": "home",
  "✈️": "travel",
  "🎨": "design",
  "📚": "library",
  "⚡": "energy",
  "🔧": "tools",
  "💡": "idea",
  "🌟": "spark",
};

export function normalizeSlotIcon(
  icon: string | undefined | null,
): SlotIconKey {
  const raw = typeof icon === "string" ? icon.trim() : "";
  if (!raw) return "folder";

  const lower = raw.toLowerCase();
  if ((SLOT_ICONS as readonly string[]).includes(lower)) {
    return lower as SlotIconKey;
  }

  return LEGACY_SLOT_ICON_MAP[raw] ?? "folder";
}

export function getSlotIconLabel(icon: string): string {
  return SLOT_ICON_LABELS[normalizeSlotIcon(icon)];
}

export function getSlotColors(color: string) {
  return slotColorMap[color] ?? slotColorMap["gray"];
}
