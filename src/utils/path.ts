import type { SlotItem } from "../types/slot";

const WINDOWS_PROTECTED_FOLDER_PATTERNS: RegExp[] = [
  /^[a-z]:$/,
  /^[a-z]:\/users$/,
  /^[a-z]:\/users\/[^/]+$/,
  /^[a-z]:\/windows(?:\/|$)/,
  /^[a-z]:\/program files(?: \(x86\))?(?:\/|$)/,
  /^[a-z]:\/programdata(?:\/|$)/,
  /^[a-z]:\/\$recycle\.bin(?:\/|$)/,
  /^[a-z]:\/system volume information(?:\/|$)/,
  /^[a-z]:\/recovery(?:\/|$)/,
];

const WINDOWS_SHELL_ITEM_PATTERNS: RegExp[] = [
  /^shell:mycomputerfolder$/,
  /^shell:recyclebinfolder$/,
  /^::\{20d04fe0-3aea-1069-a2d8-08002b30309d\}$/,
  /^::\{645ff040-5081-101b-9f08-00aa002f954e\}$/,
];

export function normalizePathKey(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function isDesktopPath(path: string): boolean {
  const key = normalizePathKey(path);
  if (!key) return false;
  return /\/desktop(\/|$)/.test(key);
}

export function isDesktopOriginPath(
  path: string,
  customDesktopPath?: string,
): boolean {
  if (isDesktopPath(path)) return true;

  const customPath =
    typeof customDesktopPath === "string" ? customDesktopPath.trim() : "";
  if (!customPath) return false;

  return isPathInside(customPath, path);
}

export function isPathInside(parentPath: string, targetPath: string): boolean {
  const parentKey = normalizePathKey(parentPath);
  const targetKey = normalizePathKey(targetPath);
  if (!parentKey || !targetKey) return false;
  if (parentKey === targetKey) return true;
  return targetKey.startsWith(`${parentKey}/`);
}

export function isProtectedFolderPath(
  path: string,
  customDesktopPath?: string,
): boolean {
  const key = normalizePathKey(path);
  if (!key) return false;

  if (WINDOWS_PROTECTED_FOLDER_PATTERNS.some((pattern) => pattern.test(key))) {
    return true;
  }

  // Avoid moving a full Desktop root folder by mistake.
  if (/(^|\/)desktop$/.test(key)) {
    return true;
  }

  const customDesktopKey = normalizePathKey(customDesktopPath ?? "");
  if (customDesktopKey && key === customDesktopKey) {
    return true;
  }

  return false;
}

export function isWindowsShellVirtualPath(path: string): boolean {
  const key = normalizePathKey(path);
  if (!key) return false;

  if (WINDOWS_SHELL_ITEM_PATTERNS.some((pattern) => pattern.test(key))) {
    return true;
  }

  // Accept friendly aliases users may type manually.
  return (
    key === "this pc" ||
    key === "thispc" ||
    key === "my computer" ||
    key === "computer" ||
    key === "recycle bin" ||
    key === "recyclebin"
  );
}

interface ShouldMoveItemToSlotArgs {
  path: string;
  itemType: SlotItem["type"];
  moveFilesPhysically: boolean;
  customDesktopPath?: string;
}

export function shouldMoveItemToSlot({
  path,
  itemType,
  moveFilesPhysically,
  customDesktopPath,
}: ShouldMoveItemToSlotArgs): boolean {
  if (isWindowsShellVirtualPath(path)) {
    return false;
  }

  // Program launchers should stay in place; moving them can break app installs.
  if (itemType === "program" || itemType === "shortcut") {
    return false;
  }

  // Prevent accidental moves of system/home/root folders.
  if (itemType === "folder" && isProtectedFolderPath(path, customDesktopPath)) {
    return false;
  }

  return moveFilesPhysically || isDesktopOriginPath(path, customDesktopPath);
}
