import { useState, useCallback } from "react";
import { Slot } from "../types/slot";
import { AppSettings } from "../types/settings";
import { SlotGrid } from "../components/SlotGrid";
import { SlotModal } from "../components/SlotModal";
import { AutoSortModal, SortCandidate } from "../components/AutoSortModal";
import {
  createSlot,
  updateSlot,
  deleteSlot,
  addItemToSlot,
} from "../services/slotService";
import { useDragDrop } from "../hooks/useDragDrop";
import { detectItemType, getFileExtension } from "../utils/fileTypes";
import { isDesktopOriginPath, normalizePathKey } from "../utils/path";
import { scanDesktop, moveItemToSlot } from "../services/fileService";

interface DashboardProps {
  slots: Slot[];
  settings: AppSettings;
  onSlotsChange: () => void;
  onOpenSlot: (slot: Slot) => void;
}

export function Dashboard({
  slots,
  settings,
  onSlotsChange,
  onOpenSlot,
}: DashboardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Slot | null>(null);
  const [sortCandidates, setSortCandidates] = useState<SortCandidate[]>([]);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizeNameKey = (name: string) => name.trim().toLowerCase();

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (paths: string[], slotId: string | null) => {
      if (paths.length === 0) return;

      const dedupedPaths = Array.from(
        new Map(
          paths
            .map((path) => [normalizePathKey(path), path] as const)
            .filter(([key]) => key.length > 0),
        ).values(),
      );
      if (dedupedPaths.length === 0) return;

      const assignedPathKeys = new Set(
        slots
          .flatMap((slot) =>
            slot.items.map((item) => normalizePathKey(item.path)),
          )
          .filter((key) => key.length > 0),
      );
      const assignedNameKeys = new Set(
        slots
          .flatMap((slot) =>
            slot.items.map((item) => normalizeNameKey(item.name)),
          )
          .filter((key) => key.length > 0),
      );

      if (slotId) {
        // Dropped directly on a slot.
        const targetSlot = slots.find((s) => s.id === slotId) ?? null;
        const pendingPaths = dedupedPaths.filter((path) => {
          const pathKey = normalizePathKey(path);
          if (!pathKey || assignedPathKeys.has(pathKey)) return false;
          const name = path.split(/[\\/]/).pop() ?? path;
          const nameKey = normalizeNameKey(name);
          return nameKey.length === 0 || !assignedNameKeys.has(nameKey);
        });
        let skippedDuplicates = dedupedPaths.length - pendingPaths.length;

        if (pendingPaths.length === 0) {
          alert("All dropped items are already sorted in slots.");
          return;
        }

        const moveCount = pendingPaths.filter(
          (path) =>
            settings.moveFilesPhysically ||
            isDesktopOriginPath(path, settings.desktopPath),
        ).length;

        if (moveCount > 0 && targetSlot) {
          const confirmed = confirm(
            `Move ${moveCount} item${moveCount !== 1 ? "s" : ""} into Documents\\DeskNest\\Slots\\${targetSlot.name}?\n\n` +
              "Desktop items are moved out of Desktop when added to a slot.",
          );
          if (!confirmed) return;
        }

        void (async () => {
          let moveFailures = 0;

          for (const originalPath of pendingPaths) {
            let finalPath = originalPath;
            const shouldMove =
              Boolean(targetSlot) &&
              (settings.moveFilesPhysically ||
                isDesktopOriginPath(originalPath, settings.desktopPath));

            if (shouldMove && targetSlot) {
              try {
                finalPath = await moveItemToSlot(originalPath, targetSlot.name);
              } catch (e) {
                moveFailures += 1;
                console.error("Failed to move dropped item:", originalPath, e);
                continue;
              }
            }

            const name = finalPath.split(/[\\/]/).pop() ?? finalPath;
            const isDir = !name.includes(".");
            const added = addItemToSlot(slotId, {
              name,
              path: finalPath,
              type: detectItemType(finalPath, isDir),
              extension: isDir ? undefined : getFileExtension(name),
            });

            if (!added) {
              skippedDuplicates += 1;
            } else {
              const finalKey = normalizePathKey(finalPath);
              if (finalKey) assignedPathKeys.add(finalKey);
              const finalNameKey = normalizeNameKey(name);
              if (finalNameKey) assignedNameKeys.add(finalNameKey);
            }
          }

          onSlotsChange();
          if (moveFailures > 0 || skippedDuplicates > 0) {
            const notices: string[] = [];
            if (moveFailures > 0) {
              notices.push(
                `${moveFailures} item${moveFailures !== 1 ? "s" : ""} could not be moved and were skipped.`,
              );
            }
            if (skippedDuplicates > 0) {
              notices.push(
                `${skippedDuplicates} item${skippedDuplicates !== 1 ? "s" : ""} were already in slots and were skipped.`,
              );
            }
            alert(notices.join(" "));
          }
        })();
      } else {
        // Dropped on empty space — open auto-sort modal
        const candidates: SortCandidate[] = dedupedPaths
          .filter((path) => {
            const pathKey = normalizePathKey(path);
            if (!pathKey || assignedPathKeys.has(pathKey)) return false;
            const name = path.split(/[\\/]/).pop() ?? path;
            const nameKey = normalizeNameKey(name);
            return nameKey.length === 0 || !assignedNameKeys.has(nameKey);
          })
          .map((p) => {
            const name = p.split(/[\\/]/).pop() ?? p;
            return { path: p, name, isDir: !name.includes(".") };
          });

        if (candidates.length === 0) {
          alert("All dropped files are already sorted in slots.");
          return;
        }

        setSortCandidates(candidates);
        setSortModalOpen(true);
      }
    },
    [slots, onSlotsChange, settings.moveFilesPhysically, settings.desktopPath],
  );

  const { isDragging, hoveredSlotId } = useDragDrop(handleDrop);

  // ── Auto Sort Desktop ──────────────────────────────────────────────────────
  async function handleAutoSort() {
    setScanning(true);
    try {
      const files = await scanDesktop();
      const assignedPathKeys = new Set(
        slots
          .flatMap((slot) =>
            slot.items.map((item) => normalizePathKey(item.path)),
          )
          .filter((key) => key.length > 0),
      );
      const assignedNameKeys = new Set(
        slots
          .flatMap((slot) =>
            slot.items.map((item) => normalizeNameKey(item.name)),
          )
          .filter((key) => key.length > 0),
      );

      const candidates: SortCandidate[] = files
        .filter((f) => {
          const pathKey = normalizePathKey(f.path);
          if (!pathKey || assignedPathKeys.has(pathKey)) return false;
          const nameKey = normalizeNameKey(f.name);
          return nameKey.length === 0 || !assignedNameKeys.has(nameKey);
        })
        .map((f) => ({
          path: f.path,
          name: f.name,
          isDir: f.isDir,
        }));

      if (candidates.length === 0) {
        alert(
          "No new desktop files to sort. Everything detected is already in slots.",
        );
        return;
      }

      setSortCandidates(candidates);
      setSortModalOpen(true);
    } catch (e) {
      console.error("Desktop scan failed:", e);
    } finally {
      setScanning(false);
    }
  }

  // ── Slot CRUD ──────────────────────────────────────────────────────────────
  function handleCreate(
    name: string,
    icon: string,
    color: string,
    description: string,
  ) {
    createSlot(name, icon, color, description);
    onSlotsChange();
  }

  function handleEdit(
    name: string,
    icon: string,
    color: string,
    description: string,
  ) {
    if (!editTarget) return;
    updateSlot(editTarget.id, { name, icon, color, description });
    setEditTarget(null);
    onSlotsChange();
  }

  function handleDelete(slot: Slot) {
    if (
      !confirm(
        `Delete slot "${slot.name}"? Items will not be deleted from your computer.`,
      )
    )
      return;
    deleteSlot(slot.id);
    onSlotsChange();
  }

  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }
  function openEdit(slot: Slot) {
    setEditTarget(slot);
    setModalOpen(true);
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredSlots = query
    ? slots.filter((slot) => {
        if (slot.name.toLowerCase().includes(query)) return true;
        if ((slot.description ?? "").toLowerCase().includes(query)) return true;
        return slot.items.some(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.path.toLowerCase().includes(query),
        );
      })
    : slots;

  const totalItems = slots.reduce((sum, s) => sum + s.items.length, 0);

  // Show how many files in the current drop would be auto-matched
  return (
    <div className="flex flex-col h-full relative">
      {/* Drag-over overlay banner */}
      {isDragging && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-2.5 text-sm text-white font-medium shadow-xl">
            {hoveredSlotId
              ? `Drop to add to "${slots.find((s) => s.id === hoveredSlotId)?.name ?? "slot"}"`
              : "Drop anywhere to auto-sort"}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredSlots.length !== slots.length
                ? `${filteredSlots.length} of ${slots.length} slots shown · ${totalItems} items organized`
                : `${slots.length} slots · ${totalItems} items organized`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoSort}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors disabled:opacity-50"
              title="Scan your Desktop and sort files into slots automatically"
            >
              {scanning ? "⟳ Scanning…" : "✦ Auto Sort Desktop"}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              + New Slot
            </button>
          </div>
        </div>

        {slots.length > 0 && (
          <div className="mt-3 relative max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
              ⌕
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search slots, descriptions, or files..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/25"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drag hint bar */}
      {!isDragging && slots.length > 0 && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5 text-xs text-gray-600">
          <span>📂</span>
          <span>
            Drag files from File Explorer and drop onto a slot card to organize
            them instantly
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-5xl">🪺</span>
            <h2 className="text-base font-medium text-gray-300">
              No slots yet
            </h2>
            <p className="text-sm text-gray-600 max-w-xs">
              Create your first slot to start organizing your desktop files.
            </p>
            <button
              onClick={openCreate}
              className="mt-2 px-5 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              + Create First Slot
            </button>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-4xl opacity-40">🔍</span>
            <h2 className="text-base font-medium text-gray-300">
              No matching slots
            </h2>
            <p className="text-sm text-gray-600 max-w-sm">
              No slots or files match "{searchQuery}".
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-gray-200 transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <SlotGrid
            slots={filteredSlots}
            onSlotClick={onOpenSlot}
            onEditSlot={openEdit}
            onDeleteSlot={handleDelete}
            onCreateSlot={openCreate}
            isDragging={isDragging}
            hoveredSlotId={hoveredSlotId}
          />
        )}
      </div>

      <SlotModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        onSave={editTarget ? handleEdit : handleCreate}
        editSlot={editTarget}
      />

      <AutoSortModal
        isOpen={sortModalOpen}
        candidates={sortCandidates}
        slots={slots}
        moveFilesPhysically={settings.moveFilesPhysically}
        desktopPath={settings.desktopPath}
        onClose={() => setSortModalOpen(false)}
        onDone={() => {
          setSortModalOpen(false);
          onSlotsChange();
        }}
      />
    </div>
  );
}
