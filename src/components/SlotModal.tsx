import { useState, useEffect } from "react";
import { Slot } from "../types/slot";
import { SLOT_COLORS, SLOT_ICONS, getSlotColors } from "../utils/icons";

interface SlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, icon: string, color: string, description: string) => void;
  editSlot?: Slot | null;
}

export function SlotModal({ isOpen, onClose, onSave, editSlot }: SlotModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (editSlot) {
      setName(editSlot.name);
      setIcon(editSlot.icon);
      setColor(editSlot.color);
      setDescription(editSlot.description ?? "");
    } else {
      setName("");
      setIcon("📁");
      setColor("blue");
      setDescription("");
    }
  }, [editSlot, isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), icon, color, description.trim());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">
            {editSlot ? "Edit Slot" : "Create New Slot"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Slot Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Projects"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
              autoFocus
              maxLength={30}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What goes in this slot?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
              maxLength={60}
            />
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Icon</label>
            <div className="grid grid-cols-10 gap-1.5">
              {SLOT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`p-1.5 rounded-lg text-base transition-colors ${icon === ic ? "bg-white/15 ring-1 ring-white/30" : "hover:bg-white/10"}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {SLOT_COLORS.map((c) => {
                const colors = getSlotColors(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`px-3 py-1 rounded-lg text-xs transition-all capitalize border ${colors.border} ${colors.text} ${colors.bg} ${color === c ? "ring-1 ring-white/30 scale-105" : "opacity-60 hover:opacity-100"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${getSlotColors(color).border} ${getSlotColors(color).bg}`}>
            <span className="text-2xl">{icon}</span>
            <div>
              <p className={`text-sm font-medium ${getSlotColors(color).text}`}>{name || "Slot Name"}</p>
              {description && <p className="text-xs text-gray-500">{description}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editSlot ? "Save Changes" : "Create Slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
