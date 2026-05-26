import { AppSettings } from "../types/settings";

const SETTINGS_KEY = "desknest_settings";

const defaults: AppSettings = {
  launchOnStartup: false,
  autoOrganize: false,
  desktopPath: "",
  theme: "dark",
  moveFilesPhysically: false,
  showTrayIcon: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) } as AppSettings;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
