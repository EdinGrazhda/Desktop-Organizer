import { SlotItem } from "../types/slot";
import {
  AppWindow,
  Archive,
  Braces,
  Check,
  Clapperboard,
  ExternalLink,
  FileText,
  FolderTree,
  Gamepad2,
  ImageIcon,
  Link2,
  Music2,
  Pin,
  Reply,
  X,
  type LucideIcon,
} from "lucide-react";
import { openFile } from "../services/fileService";
import { detectSlotFromExtension, getFileExtension } from "../utils/fileTypes";
import { normalizePathKey } from "../utils/path";

type IconTone =
  | "slate"
  | "blue"
  | "emerald"
  | "rose"
  | "amber"
  | "violet"
  | "cyan"
  | "red";

interface ItemVisual {
  Icon: LucideIcon;
  badge: string;
  tone: IconTone;
}

const ICON_TONE_STYLES: Record<
  IconTone,
  { shell: string; inner: string; icon: string; badge: string }
> = {
  slate: {
    shell:
      "border-slate-300/20 bg-gradient-to-br from-slate-200/30 via-slate-500/20 to-zinc-700/20 shadow-[0_0_20px_rgba(148,163,184,0.22)]",
    inner: "bg-slate-950/55",
    icon: "text-slate-100",
    badge: "bg-slate-500/20 text-slate-200 border-slate-300/30",
  },
  blue: {
    shell:
      "border-blue-300/25 bg-gradient-to-br from-cyan-200/35 via-blue-500/25 to-indigo-700/20 shadow-[0_0_20px_rgba(59,130,246,0.28)]",
    inner: "bg-blue-950/55",
    icon: "text-blue-100",
    badge: "bg-blue-500/20 text-blue-200 border-blue-300/30",
  },
  emerald: {
    shell:
      "border-emerald-300/25 bg-gradient-to-br from-emerald-200/35 via-green-500/25 to-teal-700/20 shadow-[0_0_20px_rgba(16,185,129,0.28)]",
    inner: "bg-emerald-950/55",
    icon: "text-emerald-100",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-300/30",
  },
  rose: {
    shell:
      "border-rose-300/25 bg-gradient-to-br from-pink-200/35 via-rose-500/25 to-fuchsia-700/20 shadow-[0_0_20px_rgba(244,63,94,0.28)]",
    inner: "bg-rose-950/55",
    icon: "text-rose-100",
    badge: "bg-rose-500/20 text-rose-200 border-rose-300/30",
  },
  amber: {
    shell:
      "border-amber-300/25 bg-gradient-to-br from-amber-200/35 via-orange-500/25 to-yellow-700/20 shadow-[0_0_20px_rgba(245,158,11,0.28)]",
    inner: "bg-amber-950/55",
    icon: "text-amber-100",
    badge: "bg-amber-500/20 text-amber-200 border-amber-300/30",
  },
  violet: {
    shell:
      "border-violet-300/25 bg-gradient-to-br from-violet-200/35 via-purple-500/25 to-fuchsia-700/20 shadow-[0_0_20px_rgba(139,92,246,0.28)]",
    inner: "bg-violet-950/55",
    icon: "text-violet-100",
    badge: "bg-violet-500/20 text-violet-200 border-violet-300/30",
  },
  cyan: {
    shell:
      "border-cyan-300/25 bg-gradient-to-br from-cyan-200/35 via-sky-500/25 to-blue-700/20 shadow-[0_0_20px_rgba(34,211,238,0.28)]",
    inner: "bg-cyan-950/55",
    icon: "text-cyan-100",
    badge: "bg-cyan-500/20 text-cyan-200 border-cyan-300/30",
  },
  red: {
    shell:
      "border-red-300/25 bg-gradient-to-br from-orange-200/35 via-red-500/25 to-rose-700/20 shadow-[0_0_20px_rgba(239,68,68,0.28)]",
    inner: "bg-red-950/55",
    icon: "text-red-100",
    badge: "bg-red-500/20 text-red-200 border-red-300/30",
  },
};

interface FileItemProps {
  item: SlotItem;
  onRemove: () => void;
  onReturnToDesktop?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onTogglePin?: () => void;
  onOpened?: () => void;
  onPathResolved?: (resolvedPath: string) => void;
}

export function FileItem({
  item,
  onRemove,
  onReturnToDesktop,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onTogglePin,
  onOpened,
  onPathResolved,
}: FileItemProps) {
  const visual = getItemVisual(item);
  const VisualIcon = visual.Icon;
  const toneStyles = ICON_TONE_STYLES[visual.tone];

  async function handleOpen() {
    try {
      const openedPath = await openFile(item.path);
      const openedPathKey = normalizePathKey(openedPath);
      const currentPathKey = normalizePathKey(item.path);

      if (
        openedPathKey.length > 0 &&
        currentPathKey.length > 0 &&
        openedPathKey !== currentPathKey
      ) {
        onPathResolved?.(openedPath);
      }

      onOpened?.();
    } catch (e) {
      console.error("Failed to open file:", e);
      const message = e instanceof Error ? e.message : String(e);
      alert(`Could not open "${item.name}". ${message}`);
    }
  }

  function handleCardActivate() {
    if (selectionMode) {
      onToggleSelect?.();
      return;
    }
    void handleOpen();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardActivate();
        }
      }}
      className={`group relative rounded-2xl border bg-white/[0.035] transition-all p-3 min-h-[124px] ${
        selectionMode
          ? selected
            ? "border-cyan-400/60 bg-cyan-500/10"
            : "border-white/12 hover:border-white/25"
          : "border-white/8 hover:bg-white/[0.06] hover:border-white/15 cursor-pointer"
      }`}
    >
      {selectionMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border text-[11px] flex items-center justify-center transition-colors ${
            selected
              ? "bg-cyan-500/80 border-cyan-300 text-black"
              : "bg-black/40 border-white/20 text-gray-300"
          }`}
          title={selected ? "Unselect item" : "Select item"}
        >
          {selected ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div
          className={`relative w-11 h-11 rounded-2xl border ${toneStyles.shell} flex items-center justify-center shrink-0 overflow-hidden`}
        >
          <span
            className={`absolute inset-[2px] rounded-[11px] border border-white/15 ${toneStyles.inner}`}
          />
          <VisualIcon
            className={`relative w-5 h-5 ${toneStyles.icon} drop-shadow-[0_0_10px_rgba(255,255,255,0.22)]`}
            strokeWidth={2}
          />
        </div>
        <div className="flex items-center gap-1">
          {!selectionMode && onTogglePin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              className={`p-1.5 rounded-lg transition-colors text-xs border ${
                item.pinned
                  ? "bg-amber-500/20 text-amber-300 border-amber-300/30 hover:bg-amber-500/30"
                  : "bg-white/5 text-gray-300 border-white/10 hover:bg-amber-500/20 hover:text-amber-300"
              }`}
              title={item.pinned ? "Unpin app/item" : "Pin app/item"}
            >
              <Pin className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
          {item.pinned && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-300/25 inline-flex items-center gap-1">
              <Pin className="w-3 h-3" strokeWidth={2} />
              Pinned
            </span>
          )}
          <span
            className={`text-[10px] px-2 py-1 rounded-full border capitalize ${toneStyles.badge}`}
          >
            {visual.badge}
          </span>
        </div>
      </div>

      <div className={`mt-3 min-w-0 ${!selectionMode ? "pb-7" : ""}`}>
        <p className="text-sm text-white font-medium truncate">{item.name}</p>
        <p className="text-[11px] text-gray-600 break-all mt-1 line-clamp-2">
          {item.path}
        </p>
        {typeof item.useCount === "number" && item.useCount > 0 && (
          <p className="text-[10px] text-gray-500 mt-1">
            Opened {item.useCount} time{item.useCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {!selectionMode && (
        <div className="absolute bottom-2 right-2 hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleOpen();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xs"
            title="Open"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          {onReturnToDesktop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReturnToDesktop();
              }}
              className="p-1.5 rounded-lg hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-300 transition-colors text-xs"
              title="Return to Desktop"
            >
              <Reply className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors text-xs"
            title="Remove from slot"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

function getItemVisual(item: SlotItem): ItemVisual {
  if (item.type === "folder") {
    return { Icon: FolderTree, badge: "folder", tone: "amber" };
  }

  if (item.type === "program") {
    return { Icon: AppWindow, badge: "program", tone: "cyan" };
  }

  if (item.type === "shortcut") {
    return { Icon: Link2, badge: "shortcut", tone: "violet" };
  }

  const ext = item.extension ?? getFileExtension(item.name);
  const category = detectSlotFromExtension(ext);
  if (category === "images")
    return { Icon: ImageIcon, badge: "image", tone: "rose" };
  if (category === "videos")
    return { Icon: Clapperboard, badge: "video", tone: "red" };
  if (category === "music")
    return { Icon: Music2, badge: "audio", tone: "violet" };
  if (category === "coding")
    return { Icon: Braces, badge: "code", tone: "blue" };
  if (category === "archives")
    return { Icon: Archive, badge: "archive", tone: "amber" };
  if (category === "programs")
    return { Icon: AppWindow, badge: "program", tone: "cyan" };
  if (category === "games")
    return { Icon: Gamepad2, badge: "game", tone: "emerald" };
  if (category === "documents")
    return {
      Icon: FileText,
      badge: ext ? `.${ext}` : "file",
      tone: "blue",
    };

  return {
    Icon: FileText,
    badge: ext ? `.${ext}` : "file",
    tone: "slate",
  };
}
