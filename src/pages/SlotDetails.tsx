import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Slot, SlotItem } from "../types/slot";
import { AppSettings } from "../types/settings";
import { FileItem } from "../components/FileItem";
import {
  addItemToSlot,
  pinMostUsedItems,
  recordItemOpened,
  removeItemFromSlot,
  removeItemsFromSlot,
  toggleItemPinned,
  updateItemInSlot,
  getAssignedSlotPathKeys,
} from "../services/slotService";
import { moveItemToSlot, moveItemToDesktop } from "../services/fileService";
import { getSlotColors } from "../utils/icons";
import {
  getFileExtension,
  detectItemType,
  detectSlotFromExtension,
} from "../utils/fileTypes";
import { isDesktopOriginPath, normalizePathKey } from "../utils/path";

interface SlotDetailsProps {
  slot: Slot;
  settings: AppSettings;
  onBack: () => void;
  onSlotsChange: () => void;
}

type ItemType = SlotItem["type"];

export function SlotDetails({
  slot,
  settings,
  onBack,
  onSlotsChange,
}: SlotDetailsProps) {
  const [addPath, setAddPath] = useState("");
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<ItemType>("file");
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [restoringAll, setRestoringAll] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const isGamesSlot = slot.name.toLowerCase().includes("game");

  const colors = getSlotColors(slot.color);

  async function handleBrowse(mode: "file" | "folder" | "program") {
    const isWindows =
      typeof navigator !== "undefined" &&
      navigator.userAgent.includes("Windows");
    const defaultPath =
      isWindows && (isGamesSlot || mode === "program")
        ? mode === "folder"
          ? "C:\\"
          : "C:\\Program Files"
        : undefined;

    const selected = await open({
      multiple: false,
      directory: mode === "folder",
      title:
        mode === "folder"
          ? "Select a folder"
          : mode === "program"
            ? "Select a program or launcher"
            : "Select a file",
      defaultPath,
      filters:
        mode === "program"
          ? [
              {
                name: "Programs",
                extensions: [
                  "exe",
                  "msi",
                  "bat",
                  "cmd",
                  "com",
                  "lnk",
                  "url",
                  "appref-ms",
                ],
              },
            ]
          : undefined,
    });
    if (typeof selected === "string" && selected) {
      handlePathChange(selected);
      setAddName("");
      setAddType(
        mode === "folder"
          ? "folder"
          : mode === "program"
            ? "program"
            : detectItemType(selected, false),
      );
    }
  }

  /** Called whenever the path input changes — auto-fills type and detects category */
  function handlePathChange(path: string) {
    setAddPath(path);
    if (!path.trim()) return;
    // Auto-detect type
    const isDir =
      path.endsWith("\\") || path.endsWith("/") || !path.includes(".");
    const detected = detectItemType(path, isDir);
    setAddType(detected);
  }

  // Detect if this file "belongs" in a different slot category
  const pathExt = getFileExtension(addPath.split(/[\\/]/).pop() ?? addPath);
  const suggestedCategory = pathExt ? detectSlotFromExtension(pathExt) : null;
  const slotMatchesCategory = suggestedCategory
    ? slot.name.toLowerCase().includes(suggestedCategory)
    : true;

  const itemQuery = itemSearch.trim().toLowerCase();
  const filteredItems = itemQuery
    ? slot.items.filter((item) => {
        if (item.name.toLowerCase().includes(itemQuery)) return true;
        if (item.path.toLowerCase().includes(itemQuery)) return true;
        if (item.type.toLowerCase().includes(itemQuery)) return true;
        return (item.extension ?? "").toLowerCase().includes(itemQuery);
      })
    : slot.items;

  const displayItems = [...filteredItems].sort((a, b) => {
    const aPinned = a.pinned === true;
    const bPinned = b.pinned === true;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    const aCount =
      typeof a.useCount === "number" && Number.isFinite(a.useCount)
        ? a.useCount
        : 0;
    const bCount =
      typeof b.useCount === "number" && Number.isFinite(b.useCount)
        ? b.useCount
        : 0;
    if (bCount !== aCount) return bCount - aCount;

    const aOpened = a.lastOpenedAt ?? "";
    const bOpened = b.lastOpenedAt ?? "";
    if (aOpened !== bOpened) return bOpened.localeCompare(aOpened);

    return a.name.localeCompare(b.name);
  });

  const selectedCount = selectedItemIds.length;
  const allItemsSelected =
    slot.items.length > 0 && selectedCount === slot.items.length;

  useEffect(() => {
    const validIds = new Set(slot.items.map((item) => item.id));
    setSelectedItemIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [slot.items]);

  function enterSelectionMode() {
    setSelectionMode(true);
    setShowAddForm(false);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedItemIds([]);
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }

  function handleSelectAllItems() {
    setSelectedItemIds(slot.items.map((item) => item.id));
  }

  function handleRemoveSelected() {
    if (selectedItemIds.length === 0) return;

    if (
      !confirm(
        `Remove ${selectedItemIds.length} selected item${selectedItemIds.length !== 1 ? "s" : ""} from this slot?\n\n` +
          "This only removes them from DeskNest. Files stay on your computer.",
      )
    ) {
      return;
    }

    const removedCount = removeItemsFromSlot(slot.id, selectedItemIds);
    if (removedCount > 0) {
      onSlotsChange();
    }

    setSelectedItemIds([]);
    setSelectionMode(false);
  }

  function handleRemoveAllFromSlot() {
    if (slot.items.length === 0) return;

    if (
      !confirm(
        `Remove all ${slot.items.length} item${slot.items.length !== 1 ? "s" : ""} from this slot?\n\n` +
          "This only removes them from DeskNest. Files stay on your computer.",
      )
    ) {
      return;
    }

    const removedCount = removeItemsFromSlot(
      slot.id,
      slot.items.map((item) => item.id),
    );

    if (removedCount > 0) {
      onSlotsChange();
    }

    setSelectedItemIds([]);
    setSelectionMode(false);
  }

  function handleTogglePin(itemId: string) {
    const changed = toggleItemPinned(slot.id, itemId);
    if (changed) {
      onSlotsChange();
    }
  }

  function handleItemOpened(itemId: string) {
    const changed = recordItemOpened(slot.id, itemId);
    if (changed) {
      onSlotsChange();
    }
  }

  function handlePinMostUsed() {
    const result = pinMostUsedItems(slot.id, 5);
    if (result.pinned > 0) {
      onSlotsChange();
      return;
    }

    alert("No frequently used items yet. Open files from this slot first, then try again.");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addPath.trim()) return;

    let finalPath = addPath.trim();
    const sourcePathKey = normalizePathKey(finalPath);
    if (sourcePathKey && getAssignedSlotPathKeys().has(sourcePathKey)) {
      alert("This item is already sorted in a slot.");
      return;
    }

    const shouldMove =
      settings.moveFilesPhysically ||
      isDesktopOriginPath(finalPath, settings.desktopPath);
    if (shouldMove) {
      const targetName =
        addName.trim() || finalPath.split(/[\\/]/).pop() || finalPath;
      const confirmed = confirm(
        `Move "${targetName}" into Documents\\DeskNest\\Slots\\${slot.name}?\n\n` +
          "It will no longer stay in its current location.",
      );
      if (!confirmed) return;

      try {
        finalPath = await moveItemToSlot(finalPath, slot.name);
      } catch (err) {
        console.error("Failed to move item before adding to slot:", err);
        alert(
          "Could not move this file/folder into DeskNest storage. Please check permissions and try again.",
        );
        return;
      }
    }

    const finalName =
      addName.trim() || finalPath.split(/[\\/]/).pop() || finalPath;
    const ext = getFileExtension(finalPath.split(/[\\/]/).pop() ?? finalPath);
    const added = addItemToSlot(slot.id, {
      name: finalName,
      path: finalPath,
      type: addType,
      extension: ext || undefined,
    });

    if (!added) {
      alert("This item is already sorted in a slot.");
      return;
    }

    setAddPath("");
    setAddName("");
    setAddType("file");
    setShowAddForm(false);
    onSlotsChange();
  }

  function handleRemove(itemId: string) {
    removeItemFromSlot(slot.id, itemId);
    onSlotsChange();
  }

  async function handleReturnToDesktop(item: SlotItem) {
    if (restoringAll || restoringItemId) return;
    setRestoringItemId(item.id);

    try {
      const desktopPath = await moveItemToDesktop(item.path);
      const nextName = desktopPath.split(/[\\/]/).pop() ?? item.name;
      const isDir = item.type === "folder" || !nextName.includes(".");

      updateItemInSlot(slot.id, item.id, {
        name: nextName,
        path: desktopPath,
        type: detectItemType(desktopPath, isDir),
        extension: isDir ? undefined : getFileExtension(nextName),
      });
      onSlotsChange();
    } catch (err) {
      console.error("Failed to return item to Desktop:", err);
      alert(
        "Could not move this item back to Desktop. Please check permissions and try again.",
      );
    } finally {
      setRestoringItemId(null);
    }
  }

  async function handleReturnAllToDesktop() {
    if (restoringAll || slot.items.length === 0) return;

    const movableItems = slot.items.filter(
      (item) => !isDesktopOriginPath(item.path, settings.desktopPath),
    );
    if (movableItems.length === 0) {
      alert("All items in this slot are already on Desktop.");
      return;
    }

    if (
      !confirm(
        `Return ${movableItems.length} item${movableItems.length !== 1 ? "s" : ""} from this slot back to Desktop?`,
      )
    ) {
      return;
    }

    setRestoringAll(true);
    let restoredCount = 0;
    let failedCount = 0;

    for (const item of movableItems) {
      try {
        const desktopPath = await moveItemToDesktop(item.path);
        const nextName = desktopPath.split(/[\\/]/).pop() ?? item.name;
        const isDir = item.type === "folder" || !nextName.includes(".");

        updateItemInSlot(slot.id, item.id, {
          name: nextName,
          path: desktopPath,
          type: detectItemType(desktopPath, isDir),
          extension: isDir ? undefined : getFileExtension(nextName),
        });
        restoredCount += 1;
      } catch (err) {
        failedCount += 1;
        console.error("Failed to return item to Desktop:", item.path, err);
      }
    }

    setRestoringAll(false);
    onSlotsChange();

    if (failedCount > 0) {
      alert(
        `Returned ${restoredCount} item${restoredCount !== 1 ? "s" : ""} to Desktop, but ${failedCount} failed.`,
      );
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-6 pt-6 pb-4 border-b border-white/5`}>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{slot.icon}</span>
            <div>
              <h1 className={`text-lg font-semibold ${colors.text}`}>
                {slot.name}
              </h1>
              {slot.description && (
                <p className="text-xs text-gray-500">{slot.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full ${colors.badge}`}
            >
              {filteredItems.length !== slot.items.length
                ? `${filteredItems.length} of ${slot.items.length} items`
                : `${slot.items.length} ${slot.items.length === 1 ? "item" : "items"}`}
            </span>
            {selectionMode ? (
              <>
                <button
                  onClick={handleSelectAllItems}
                  disabled={allItemsSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Select every item in this slot"
                >
                  ☑ Select All
                </button>
                <button
                  onClick={() => void handleRemoveSelected()}
                  disabled={selectedCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-200 text-sm hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Remove selected items from this slot only"
                >
                  🗑 Remove Selected
                </button>
                <button
                  onClick={exitSelectionMode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handlePinMostUsed}
                  disabled={slot.items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-200 text-sm hover:bg-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Pin your most-used items in this slot"
                >
                  📌 Pin Most Used
                </button>
                <button
                  onClick={handleRemoveAllFromSlot}
                  disabled={slot.items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-200 text-sm hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Remove every item from this slot in DeskNest only"
                >
                  🗑 Remove All
                </button>
                <button
                  onClick={enterSelectionMode}
                  disabled={slot.items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Select multiple items to remove from this slot"
                >
                  ☑ Select
                </button>
                <button
                  onClick={() => void handleReturnAllToDesktop()}
                  disabled={restoringAll || slot.items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Move all items in this slot back to Desktop"
                >
                  {restoringAll ? "Returning..." : "↩ Return All"}
                </button>
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  + Add Item
                </button>
              </>
            )}
          </div>
        </div>

        {selectionMode && (
          <p className="text-xs text-gray-400 mt-2">
            {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected. Removing from slot does not delete files from disk.
          </p>
        )}

        {slot.items.length > 0 && (
          <div className="mt-3 relative max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
              ⌕
            </span>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search items in this slot..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/25"
            />
            {itemSearch && (
              <button
                onClick={() => setItemSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add item form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mx-6 mt-4 p-4 rounded-xl bg-white/3 border border-white/10 space-y-3"
        >
          <p className="text-xs font-medium text-gray-400">
            Add file, folder, or program to this slot
          </p>

          {/* Browse buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleBrowse("file")}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm text-gray-300 transition-colors"
            >
              📄 Browse file
            </button>
            <button
              type="button"
              onClick={() => handleBrowse("folder")}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm text-gray-300 transition-colors"
            >
              📁 Browse folder
            </button>
            <button
              type="button"
              onClick={() => handleBrowse("program")}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm text-gray-300 transition-colors"
            >
              ⚙️ Browse program
            </button>
          </div>

          {isGamesSlot && (
            <p className="text-[11px] text-gray-500">
              Tip: use "Browse program" for launchers (.exe/.lnk) or "Browse
              folder" for full game install folders.
            </p>
          )}

          {/* Manual path + type override */}
          <div className="flex gap-2">
            <input
              type="text"
              value={addPath}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder={`or type path manually…`}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 font-mono"
            />
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as ItemType)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/30"
            >
              <option value="file">📄 File</option>
              <option value="folder">📁 Folder</option>
              <option value="program">⚙️ Program</option>
              <option value="shortcut">🔗 Shortcut</option>
            </select>
          </div>

          {/* Category suggestion hint */}
          {addPath && suggestedCategory && !slotMatchesCategory && (
            <p className="text-xs text-yellow-500/80">
              ⚡ Detected as <strong>{suggestedCategory}</strong> — you're
              adding it to <strong>{slot.name}</strong> anyway, which is fine!
            </p>
          )}
          {addPath && !suggestedCategory && pathExt && (
            <p className="text-xs text-gray-500">
              No category match for{" "}
              <code className="bg-white/5 px-1 rounded">.{pathExt}</code> — will
              be added as-is.
            </p>
          )}

          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Display name (optional — auto-filled from filename)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddPath("");
                setAddName("");
                setAddType("file");
              }}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!addPath.trim()}
              className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to Slot
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {slot.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-4xl opacity-40">{slot.icon}</span>
            <p className="text-sm text-gray-600">No items in this slot yet.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-sm text-gray-400 hover:text-white underline transition-colors"
            >
              Add your first item
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-4xl opacity-40">🔍</span>
            <p className="text-sm text-gray-400">
              No items match "{itemSearch}".
            </p>
            <button
              onClick={() => setItemSearch("")}
              className="text-sm text-gray-300 hover:text-white underline transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayItems.map((item) => (
              <FileItem
                key={item.id}
                item={item}
                selectionMode={selectionMode}
                selected={selectedItemIds.includes(item.id)}
                onToggleSelect={() => toggleItemSelection(item.id)}
                onTogglePin={
                  !selectionMode
                    ? () => handleTogglePin(item.id)
                    : undefined
                }
                onOpened={() => handleItemOpened(item.id)}
                onReturnToDesktop={
                  !selectionMode &&
                  !isDesktopOriginPath(item.path, settings.desktopPath) &&
                  restoringItemId === null &&
                  !restoringAll
                    ? () => void handleReturnToDesktop(item)
                    : undefined
                }
                onRemove={() => handleRemove(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
