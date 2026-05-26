import { useState } from "react";
import { AppSettings } from "../types/settings";
import { saveSettings } from "../services/settingsService";
import {
  enableAutostart,
  disableAutostart,
  restoreAllSlotItemsToDesktop,
} from "../services/fileService";
import {
  remapSlotItemPaths,
  cleanupDuplicateSlotItems,
} from "../services/slotService";

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  onSlotsChange: () => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-white" : "bg-white/10"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${value ? "translate-x-5 bg-black" : "translate-x-0 bg-gray-500"}`}
        />
      </button>
    </div>
  );
}

export function Settings({
  settings,
  onSettingsChange,
  onSlotsChange,
}: SettingsProps) {
  const [saved, setSaved] = useState(false);
  const [restoringAll, setRestoringAll] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState("");
  const [restoreHasFailures, setRestoreHasFailures] = useState(false);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [cleanupSummary, setCleanupSummary] = useState("");

  function update(patch: Partial<AppSettings>) {
    const updated = { ...settings, ...patch };
    onSettingsChange(updated);
    saveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleStartupToggle(enabled: boolean) {
    try {
      if (enabled) await enableAutostart();
      else await disableAutostart();
    } catch (e) {
      console.error("Autostart toggle failed:", e);
    }
    update({ launchOnStartup: enabled });
  }

  async function handleRestoreAllToDesktop() {
    if (restoringAll) return;

    const confirmed = confirm(
      "Move all files from Documents\\DeskNest\\Slots back to Desktop?\n\n" +
        "This keeps slot entries and updates them to the new Desktop paths.",
    );
    if (!confirmed) return;

    setRestoringAll(true);
    setRestoreSummary("");
    setRestoreHasFailures(false);

    try {
      const result = await restoreAllSlotItemsToDesktop();
      const remappedCount = remapSlotItemPaths(result.mappings);

      if (remappedCount > 0) {
        onSlotsChange();
      }

      if (result.moved === 0 && result.failed === 0) {
        setRestoreSummary("No files were found in DeskNest slot storage.");
        return;
      }

      const messageParts = [
        `Restored ${result.moved} item${result.moved !== 1 ? "s" : ""} to Desktop.`,
      ];

      if (remappedCount > 0) {
        messageParts.push(
          `Updated ${remappedCount} slot entr${remappedCount !== 1 ? "ies" : "y"}.`,
        );
      }
      if (result.skipped > 0) {
        messageParts.push(
          `Skipped ${result.skipped} duplicate/invalid entr${result.skipped !== 1 ? "ies" : "y"}.`,
        );
      }
      if (result.failed > 0) {
        messageParts.push(
          `${result.failed} item${result.failed !== 1 ? "s" : ""} failed to move.`,
        );
      }

      const summary = messageParts.join(" ");
      setRestoreSummary(summary);
      setRestoreHasFailures(result.failed > 0);

      if (result.failed > 0) {
        alert(summary);
      }
    } catch (e) {
      console.error("Failed to restore DeskNest files to Desktop:", e);
      setRestoreHasFailures(true);
      setRestoreSummary(
        "Restore failed. Please check permissions and try again.",
      );
    } finally {
      setRestoringAll(false);
    }
  }

  function handleCleanupDuplicates() {
    if (cleaningDuplicates) return;

    const confirmed = confirm(
      "Remove duplicate items already saved inside slots?\n\n" +
        "DeskNest keeps the first item and removes repeated duplicates in each slot.",
    );
    if (!confirmed) return;

    setCleaningDuplicates(true);
    setCleanupSummary("");

    try {
      const result = cleanupDuplicateSlotItems();
      if (result.removed > 0) {
        onSlotsChange();
        setCleanupSummary(
          `Removed ${result.removed} duplicate item${result.removed !== 1 ? "s" : ""} across ${result.affectedSlots} slot${result.affectedSlots !== 1 ? "s" : ""}.`,
        );
      } else {
        setCleanupSummary("No duplicate slot items were found.");
      }
    } catch (e) {
      console.error("Failed to clean duplicate slot items:", e);
      setCleanupSummary("Cleanup failed. Please try again.");
    } finally {
      setCleaningDuplicates(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure N'Rend behaviour
          </p>
        </div>
        {saved && <span className="text-xs text-green-400">✓ Saved</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Startup section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Startup
          </h2>
          <div className="bg-white/3 rounded-xl border border-white/5 px-4">
            <ToggleRow
              label="Launch on system startup"
              description="Start DeskNest automatically when Windows boots"
              value={settings.launchOnStartup}
              onChange={handleStartupToggle}
            />
            <ToggleRow
              label="Show tray icon"
              description="Keep an icon in the system tray for quick access"
              value={settings.showTrayIcon}
              onChange={(v) => update({ showTrayIcon: v })}
            />
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Appearance
          </h2>
          <div className="bg-white/3 rounded-xl border border-white/5 px-4 py-4">
            <label className="block text-sm text-white font-medium mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {(["dark", "light", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update({ theme: t })}
                  className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors border ${
                    settings.theme === t
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Organization */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            File Organization
          </h2>
          <div className="bg-white/3 rounded-xl border border-white/5 px-4">
            <ToggleRow
              label="Auto-organize by file type"
              description="Suggest slots when adding files based on their extension"
              value={settings.autoOrganize}
              onChange={(v) => update({ autoOrganize: v })}
            />
            <ToggleRow
              label="Move files physically"
              description="Move files/folders to Documents\\DeskNest\\Slots instead of only saving references (program launchers stay as references)"
              value={settings.moveFilesPhysically}
              onChange={(v) => update({ moveFilesPhysically: v })}
            />
          </div>
          {settings.moveFilesPhysically && (
            <p className="text-xs text-yellow-500/80 mt-2 px-1">
              ⚠ Files will be physically moved. DeskNest will always ask for
              confirmation first.
            </p>
          )}
        </section>

        {/* Restore */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Desktop Restore
          </h2>
          <div className="space-y-3">
            <div className="bg-white/3 rounded-xl border border-white/5 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white font-medium">
                  Restore all moved files to Desktop
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Move everything from Documents\\DeskNest\\Slots back to
                  Desktop and keep slot paths in sync.
                </p>
              </div>
              <button
                onClick={() => void handleRestoreAllToDesktop()}
                disabled={restoringAll}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoringAll ? "Restoring..." : "Restore All"}
              </button>
            </div>

            <div className="bg-white/3 rounded-xl border border-white/5 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white font-medium">
                  Clean duplicate items inside slots
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Keep the first entry and remove repeated duplicates in each
                  slot.
                </p>
              </div>
              <button
                onClick={handleCleanupDuplicates}
                disabled={cleaningDuplicates}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cleaningDuplicates ? "Cleaning..." : "Clean Duplicates"}
              </button>
            </div>
          </div>
          {restoreSummary && (
            <p
              className={`text-xs mt-2 px-1 ${restoreHasFailures ? "text-yellow-500/90" : "text-gray-400"}`}
            >
              {restoreSummary}
            </p>
          )}
          {cleanupSummary && (
            <p className="text-xs mt-2 px-1 text-gray-400">{cleanupSummary}</p>
          )}
        </section>

        {/* Desktop path */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Desktop Path
          </h2>
          <div className="bg-white/3 rounded-xl border border-white/5 p-4">
            <label className="block text-xs text-gray-400 mb-1.5">
              Custom desktop scan path
            </label>
            <input
              type="text"
              value={settings.desktopPath}
              onChange={(e) => update({ desktopPath: e.target.value })}
              placeholder="Leave empty to use system default"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            About
          </h2>
          <div className="bg-white/3 rounded-xl border border-white/5 p-4 flex items-center gap-3">
            <img
              src="/nrend-icon.png"
              alt="N'Rend icon"
              className="w-12 h-12 rounded-2xl border border-white/15 object-cover shrink-0 shadow-lg shadow-black/30"
            />
            <div>
              <p className="text-sm font-semibold text-white">N'Rend</p>
              <p className="text-xs text-gray-500">
                Version 1.0.2 — Desktop slot organizer
              </p>
              <p className="text-xs text-cyan-300/90 mt-1">
                Done By Edin Grazhda
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
