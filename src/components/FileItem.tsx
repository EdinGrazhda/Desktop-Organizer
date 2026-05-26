import { SlotItem } from "../types/slot";
import { fileTypeIcons } from "../utils/icons";
import { openFile } from "../services/fileService";
import { detectSlotFromExtension, getFileExtension } from "../utils/fileTypes";

interface FileItemProps {
  item: SlotItem;
  onRemove: () => void;
  onReturnToDesktop?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onTogglePin?: () => void;
  onOpened?: () => void;
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
}: FileItemProps) {
  const { icon, badge } = getItemVisual(item);

  async function handleOpen() {
    try {
      await openFile(item.path);
      onOpened?.();
    } catch (e) {
      console.error("Failed to open file:", e);
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
          {selected ? "✓" : ""}
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-2xl shrink-0">
          {icon}
        </div>
        <div className="flex items-center gap-1">
          {item.pinned && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-300/25">
              📌
            </span>
          )}
          <span className="text-[10px] px-2 py-1 rounded-full bg-white/8 text-gray-300 border border-white/10 capitalize">
            {badge}
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
            ↗
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
              ↩
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              className={`p-1.5 rounded-lg transition-colors text-xs ${
                item.pinned
                  ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  : "hover:bg-amber-500/20 text-gray-400 hover:text-amber-300"
              }`}
              title={item.pinned ? "Unpin item" : "Pin item"}
            >
              📌
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
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function getItemVisual(item: SlotItem): { icon: string; badge: string } {
  if (item.type !== "file") {
    return { icon: fileTypeIcons[item.type] ?? "📄", badge: item.type };
  }

  const ext = item.extension ?? getFileExtension(item.name);
  const category = detectSlotFromExtension(ext);
  if (category === "images") return { icon: "🖼️", badge: "image" };
  if (category === "videos") return { icon: "🎬", badge: "video" };
  if (category === "music") return { icon: "🎵", badge: "audio" };
  if (category === "coding") return { icon: "💻", badge: "code" };
  if (category === "archives") return { icon: "🗜️", badge: "archive" };
  if (category === "programs") return { icon: "⚙️", badge: "program" };
  if (category === "games") return { icon: "🎮", badge: "game" };
  if (category === "documents") return { icon: "📄", badge: ext ? `.${ext}` : "file" };

  return { icon: "📄", badge: ext ? `.${ext}` : "file" };
}
