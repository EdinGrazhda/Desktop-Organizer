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

  const customPath = typeof customDesktopPath === "string"
    ? customDesktopPath.trim()
    : "";
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
