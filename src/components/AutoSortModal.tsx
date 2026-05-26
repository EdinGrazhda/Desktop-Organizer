import { useState, useEffect } from "react";
import {
  AppWindow,
  Archive,
  Braces,
  Clapperboard,
  FileText,
  FolderTree,
  ImageIcon,
  Music2,
  type LucideIcon,
} from "lucide-react";
import { Slot } from "../types/slot";
import { getSlotColors, getSlotIconLabel } from "../utils/icons";
import {
  findBestMatchingSlot,
  detectItemType,
  getFileExtension,
} from "../utils/fileTypes";
import { normalizePathKey, shouldMoveItemToSlot } from "../utils/path";
import { addItemToSlot } from "../services/slotService";
import { moveItemToSlot } from "../services/fileService";

export interface SortCandidate {
  path: string;
  name: string;
  isDir: boolean;
}

interface RowState {
  candidate: SortCandidate;
  targetSlotId: string;
  /** Whether this row is checked for sorting */
  included: boolean;
}

type CandidateTone = "slate" | "blue" | "rose" | "violet" | "amber" | "cyan";

interface CandidateVisual {
  Icon: LucideIcon;
  tone: CandidateTone;
}

const CANDIDATE_TONE_STYLES: Record<
  CandidateTone,
  { shell: string; inner: string; icon: string }
> = {
  slate: {
    shell:
      "border-slate-300/20 bg-gradient-to-br from-slate-200/30 via-slate-500/20 to-zinc-700/20",
    inner: "bg-slate-950/55",
    icon: "text-slate-100",
  },
  blue: {
    shell:
      "border-blue-300/25 bg-gradient-to-br from-cyan-200/35 via-blue-500/25 to-indigo-700/20",
    inner: "bg-blue-950/55",
    icon: "text-blue-100",
  },
  rose: {
    shell:
      "border-rose-300/25 bg-gradient-to-br from-pink-200/35 via-rose-500/25 to-fuchsia-700/20",
    inner: "bg-rose-950/55",
    icon: "text-rose-100",
  },
  violet: {
    shell:
      "border-violet-300/25 bg-gradient-to-br from-violet-200/35 via-purple-500/25 to-fuchsia-700/20",
    inner: "bg-violet-950/55",
    icon: "text-violet-100",
  },
  amber: {
    shell:
      "border-amber-300/25 bg-gradient-to-br from-amber-200/35 via-orange-500/25 to-yellow-700/20",
    inner: "bg-amber-950/55",
    icon: "text-amber-100",
  },
  cyan: {
    shell:
      "border-cyan-300/25 bg-gradient-to-br from-cyan-200/35 via-sky-500/25 to-blue-700/20",
    inner: "bg-cyan-950/55",
    icon: "text-cyan-100",
  },
};

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

interface AutoSortModalProps {
  isOpen: boolean;
  candidates: SortCandidate[];
  slots: Slot[];
  moveFilesPhysically: boolean;
  desktopPath: string;
  onClose: () => void;
  onDone: () => void;
}

export function AutoSortModal({
  isOpen,
  candidates,
  slots,
  moveFilesPhysically,
  desktopPath,
  onClose,
  onDone,
}: AutoSortModalProps) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [sorting, setSorting] = useState(false);

  // Re-build rows every time the modal opens with new candidates
  useEffect(() => {
    if (isOpen && candidates.length > 0) {
      setRows(buildRows(candidates, slots));
    }
  }, [isOpen, candidates, slots]);

  if (!isOpen) return null;

  function handleSlotChange(idx: number, slotId: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, targetSlotId: slotId } : r)),
    );
  }

  function handleToggle(idx: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, included: !r.included } : r)),
    );
  }

  function handleSelectAll(checked: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, included: checked })));
  }

  async function handleSortAll() {
    if (sorting) return;

    const moveCount = rows.filter((r) => {
      if (!r.included || !r.targetSlotId) return false;
      const itemType = detectItemType(r.candidate.path, r.candidate.isDir);
      return shouldMoveItemToSlot({
        path: r.candidate.path,
        itemType,
        moveFilesPhysically,
        customDesktopPath: desktopPath,
      });
    }).length;

    if (moveCount > 0) {
      const confirmed = confirm(
        `Move ${moveCount} selected item${moveCount !== 1 ? "s" : ""} into Documents\\DeskNest\\Slots?\n\n` +
          "Only files/folders are moved. Program launchers stay in place and are saved as references.",
      );
      if (!confirmed) return;
    }

    setSorting(true);
    let moveFailures = 0;
    let duplicateSkips = 0;

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

    for (const row of rows) {
      if (!row.included || !row.targetSlotId) continue;
      const { candidate } = row;

      const candidatePathKey = normalizePathKey(candidate.path);
      const candidateNameKey = normalizeNameKey(candidate.name);
      if (
        !candidatePathKey ||
        assignedPathKeys.has(candidatePathKey) ||
        (candidateNameKey.length > 0 && assignedNameKeys.has(candidateNameKey))
      ) {
        duplicateSkips += 1;
        continue;
      }

      const targetSlot = slots.find((s) => s.id === row.targetSlotId) ?? null;
      let finalPath = candidate.path;
      const itemType = detectItemType(candidate.path, candidate.isDir);
      const shouldMove =
        Boolean(targetSlot) &&
        shouldMoveItemToSlot({
          path: candidate.path,
          itemType,
          moveFilesPhysically,
          customDesktopPath: desktopPath,
        });

      if (shouldMove && targetSlot) {
        try {
          finalPath = await moveItemToSlot(candidate.path, targetSlot.name);
        } catch (e) {
          moveFailures += 1;
          console.error(
            "Failed to move item before sorting:",
            candidate.path,
            e,
          );
          continue;
        }
      }

      const finalName = finalPath.split(/[\\/]/).pop() ?? candidate.name;
      const finalIsDir = candidate.isDir || !finalName.includes(".");

      const added = addItemToSlot(row.targetSlotId, {
        name: finalName,
        path: finalPath,
        type: detectItemType(finalPath, finalIsDir),
        extension: finalIsDir ? undefined : getFileExtension(finalName),
      });

      if (added) {
        const finalKey = normalizePathKey(finalPath);
        if (finalKey) assignedPathKeys.add(finalKey);
        const finalNameKey = normalizeNameKey(finalName);
        if (finalNameKey) assignedNameKeys.add(finalNameKey);
      } else {
        duplicateSkips += 1;
      }
    }

    setSorting(false);
    if (moveFailures > 0 || duplicateSkips > 0) {
      const notices: string[] = [];
      if (moveFailures > 0) {
        notices.push(
          `${moveFailures} item${moveFailures !== 1 ? "s" : ""} could not be moved and were skipped.`,
        );
      }
      if (duplicateSkips > 0) {
        notices.push(
          `${duplicateSkips} item${duplicateSkips !== 1 ? "s" : ""} were already in slots and were skipped.`,
        );
      }
      alert(notices.join(" "));
    }
    onDone();
  }

  // Files that will actually be sorted (have a target slot and are checked)
  const sortableCount = rows.filter((r) => r.included && r.targetSlotId).length;
  // Files with no slot assigned yet
  const unmatchedCount = rows.filter(
    (r) => r.included && !r.targetSlotId,
  ).length;
  const allChecked = rows.length > 0 && rows.every((r) => r.included);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">
              Auto Sort Files
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {candidates.length} file{candidates.length !== 1 ? "s" : ""}{" "}
              detected — review and confirm
            </p>
            {moveFilesPhysically && (
              <p className="text-[11px] text-cyan-500/90 mt-1">
                Files will be moved out of Desktop into
                Documents/DeskNest/Slots.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Select-all toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="accent-white"
            />
            Select all
          </label>
          <span className="text-xs text-gray-600">
            {sortableCount} will be sorted
            {unmatchedCount > 0 && (
              <span className="text-yellow-600/80 ml-2">
                · {unmatchedCount} need a slot
              </span>
            )}
          </span>
        </div>

        {/* File list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">
              No files to display.
            </p>
          ) : (
            rows.map((row, idx) => {
              const colors = row.targetSlotId
                ? getSlotColors(
                    slots.find((s) => s.id === row.targetSlotId)?.color ??
                      "gray",
                  )
                : getSlotColors("gray");

              const visual = getCandidateVisual(
                row.candidate.name,
                row.candidate.isDir,
              );
              const VisualIcon = visual.Icon;
              const styles = CANDIDATE_TONE_STYLES[visual.tone];

              return (
                <div
                  key={row.candidate.path}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    row.included
                      ? "border-white/10 bg-white/3"
                      : "border-white/5 bg-white/1 opacity-40"
                  }`}
                >
                  {/* Toggle */}
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={() => handleToggle(idx)}
                    className="shrink-0 accent-white"
                  />

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate flex items-center gap-2">
                      <span
                        className={`relative w-6 h-6 rounded-lg border ${styles.shell} flex items-center justify-center shrink-0 overflow-hidden`}
                      >
                        <span
                          className={`absolute inset-[1px] rounded-[7px] border border-white/15 ${styles.inner}`}
                        />
                        <VisualIcon
                          className={`relative w-3.5 h-3.5 ${styles.icon}`}
                          strokeWidth={2.1}
                        />
                      </span>
                      {row.candidate.name}
                    </p>
                    <p className="text-[10px] text-gray-600 truncate">
                      {row.candidate.path}
                    </p>
                  </div>

                  {/* Slot selector */}
                  <select
                    value={row.targetSlotId}
                    onChange={(e) => handleSlotChange(idx, e.target.value)}
                    disabled={!row.included}
                    className={`shrink-0 text-xs px-2 py-1 rounded-lg border ${colors.border} ${colors.bg} ${colors.text} focus:outline-none bg-[#1a1a1a]`}
                  >
                    <option value="">— choose slot —</option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {getSlotIconLabel(s.icon)} · {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSortAll}
            disabled={sortableCount === 0 || sorting}
            className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sorting
              ? "Sorting..."
              : sortableCount > 0
                ? `Sort ${sortableCount} file${sortableCount !== 1 ? "s" : ""}`
                : "Sort"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build row state from candidates.
 * Every file is included by default. A best-match slot is pre-selected when
 * the filename's extension matches a slot category — but files without a match
 * are still included (user just needs to pick a slot).
 */
function buildRows(candidates: SortCandidate[], slots: Slot[]): RowState[] {
  const assignedPathKeys = new Set(
    slots
      .flatMap((slot) => slot.items.map((item) => normalizePathKey(item.path)))
      .filter((key) => key.length > 0),
  );
  const assignedNameKeys = new Set(
    slots
      .flatMap((slot) => slot.items.map((item) => normalizeNameKey(item.name)))
      .filter((key) => key.length > 0),
  );
  const seenCandidateKeys = new Set<string>();
  const seenCandidateNames = new Set<string>();

  const rows: RowState[] = [];

  for (const c of candidates) {
    const pathKey = normalizePathKey(c.path);
    const nameKey = normalizeNameKey(c.name);
    if (
      !pathKey ||
      seenCandidateKeys.has(pathKey) ||
      assignedPathKeys.has(pathKey) ||
      (nameKey.length > 0 &&
        (seenCandidateNames.has(nameKey) || assignedNameKeys.has(nameKey)))
    ) {
      continue;
    }

    seenCandidateKeys.add(pathKey);
    if (nameKey) seenCandidateNames.add(nameKey);
    const best = findBestMatchingSlot(slots, c.name, c.path);
    rows.push({ candidate: c, targetSlotId: best?.id ?? "", included: true });
  }

  return rows;
}

function getFileKind(ext: string): string {
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "flac", "aac"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "txt", "xlsx"].includes(ext)) return "document";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["exe", "msi", "bat", "cmd", "com"].includes(ext)) return "program";
  if (["js", "ts", "py", "rs", "go", "php", "html", "css"].includes(ext))
    return "code";
  return "file";
}

function getCandidateVisual(name: string, isDir: boolean): CandidateVisual {
  if (isDir) {
    return { Icon: FolderTree, tone: "amber" };
  }

  const ext = getFileExtension(name);
  const kind = getFileKind(ext);

  if (kind === "image") return { Icon: ImageIcon, tone: "rose" };
  if (kind === "video") return { Icon: Clapperboard, tone: "rose" };
  if (kind === "audio") return { Icon: Music2, tone: "violet" };
  if (kind === "document") return { Icon: FileText, tone: "blue" };
  if (kind === "archive") return { Icon: Archive, tone: "amber" };
  if (kind === "program") return { Icon: AppWindow, tone: "cyan" };
  if (kind === "code") return { Icon: Braces, tone: "blue" };

  return { Icon: FileText, tone: "slate" };
}
