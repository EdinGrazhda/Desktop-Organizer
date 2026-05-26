import { Slot } from "../types/slot";
import { getSlotColors } from "../utils/icons";

interface SlotCardProps {
  slot: Slot;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** True when the user is dragging files over the app window */
  isDragging?: boolean;
  /** True when the cursor is specifically over this card during a drag */
  isDragTarget?: boolean;
}

export function SlotCard({ slot, onClick, onEdit, onDelete, isDragging, isDragTarget }: SlotCardProps) {
  const colors = getSlotColors(slot.color);

  return (
    <div
      data-slot-id={slot.id}
      className={[
        "relative group rounded-xl border p-5 cursor-pointer transition-all duration-150",
        colors.border,
        colors.bg,
        isDragTarget
          ? "scale-[1.04] ring-2 ring-white/40 shadow-xl brightness-125"
          : isDragging
          ? "opacity-60 scale-[0.98]"
          : "hover:scale-[1.02] hover:shadow-lg",
      ].join(" ")}
      onClick={onClick}
    >
      {/* Drop hint shown while dragging */}
      {isDragTarget && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-white/5 pointer-events-none z-10">
          <span className="text-xs font-semibold text-white/80 bg-black/40 px-3 py-1 rounded-full">
            Drop here
          </span>
        </div>
      )}

      {/* Action buttons — appear on hover (hidden during drag) */}
      {!isDragging && (
        <div className="absolute top-3 right-3 hidden group-hover:flex gap-1 z-10">
          <button
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xs"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit slot"
          >
            ✏️
          </button>
          <button
            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors text-xs"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete slot"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Icon */}
      <div className="text-3xl mb-3">{slot.icon}</div>

      {/* Name */}
      <h3 className={`font-semibold text-base ${colors.text} mb-1`}>{slot.name}</h3>

      {/* Description */}
      {slot.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-1">{slot.description}</p>
      )}

      {/* Item count badge */}
      <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
        <span>{slot.items.length}</span>
        <span>{slot.items.length === 1 ? "item" : "items"}</span>
      </div>
    </div>
  );
}
