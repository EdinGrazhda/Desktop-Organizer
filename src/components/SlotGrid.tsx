import { Slot } from "../types/slot";
import { SlotCard } from "./SlotCard";

interface SlotGridProps {
  slots: Slot[];
  onSlotClick: (slot: Slot) => void;
  onEditSlot: (slot: Slot) => void;
  onDeleteSlot: (slot: Slot) => void;
  onCreateSlot: () => void;
  /** Set when the user is dragging files over the window */
  isDragging?: boolean;
  /** The slot-id of the card currently under the cursor */
  hoveredSlotId?: string | null;
}

export function SlotGrid({ slots, onSlotClick, onEditSlot, onDeleteSlot, onCreateSlot, isDragging, hoveredSlotId }: SlotGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {slots.map((slot) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          onClick={() => onSlotClick(slot)}
          onEdit={() => onEditSlot(slot)}
          onDelete={() => onDeleteSlot(slot)}
          isDragging={isDragging}
          isDragTarget={isDragging && hoveredSlotId === slot.id}
        />
      ))}

      {/* Create new slot card */}
      <button
        onClick={onCreateSlot}
        className="rounded-xl border border-dashed border-white/10 bg-white/2 p-5 cursor-pointer transition-all duration-200 hover:border-white/20 hover:bg-white/5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-300 min-h-[120px]"
      >
        <span className="text-2xl">+</span>
        <span className="text-sm">New Slot</span>
      </button>
    </div>
  );
}
