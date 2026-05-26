export const slotColorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", badge: "bg-purple-500/20 text-purple-300" },
  blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-400",   badge: "bg-blue-500/20 text-blue-300"   },
  green:  { bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-400",  badge: "bg-green-500/20 text-green-300"  },
  yellow: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-300" },
  pink:   { bg: "bg-pink-500/10",   border: "border-pink-500/30",   text: "text-pink-400",   badge: "bg-pink-500/20 text-pink-300"   },
  red:    { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    badge: "bg-red-500/20 text-red-300"    },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", badge: "bg-orange-500/20 text-orange-300" },
  gray:   { bg: "bg-gray-500/10",   border: "border-gray-500/30",   text: "text-gray-400",   badge: "bg-gray-500/20 text-gray-300"   },
  cyan:   { bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   text: "text-cyan-400",   badge: "bg-cyan-500/20 text-cyan-300"   },
  teal:   { bg: "bg-teal-500/10",   border: "border-teal-500/30",   text: "text-teal-400",   badge: "bg-teal-500/20 text-teal-300"   },
};

export const SLOT_COLORS = Object.keys(slotColorMap);

export const SLOT_ICONS = ["🎮", "📄", "💻", "💼", "🖼️", "🎬", "🎓", "📥", "🎵", "📦", "📁", "🔬", "🏠", "✈️", "🎨", "📚", "⚡", "🔧", "💡", "🌟"];

export function getSlotColors(color: string) {
  return slotColorMap[color] ?? slotColorMap["gray"];
}

export const fileTypeIcons: Record<string, string> = {
  file: "📄",
  folder: "📁",
  program: "⚙️",
  shortcut: "🔗",
};
