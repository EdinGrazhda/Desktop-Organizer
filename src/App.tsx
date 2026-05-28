import { useState, useEffect, useCallback } from "react";
import { Slot } from "./types/slot";
import { AppSettings } from "./types/settings";
import {
  loadSlots,
  recoverSlotsOnStartup,
  flushSlotsBackup,
} from "./services/slotService";
import { loadSettings } from "./services/settingsService";
import { AppSidebar } from "./components/AppSidebar";
import { Dashboard } from "./pages/Dashboard";
import { SlotDetails } from "./pages/SlotDetails";
import { Settings } from "./pages/Settings";

type Page = "dashboard" | "settings";

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined" || !window.matchMedia) return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const refreshSlots = useCallback(() => {
    setSlots(loadSlots());
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      await recoverSlotsOnStartup();
      if (active) {
        refreshSlots();
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshSlots]);

  useEffect(() => {
    const flush = () => {
      void flushSlotsBackup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    const intervalId = window.setInterval(flush, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const resolvedTheme =
    settings.theme === "system" ? systemTheme : settings.theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.body.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  // Keep activeSlot in sync after edits
  useEffect(() => {
    if (activeSlot) {
      const updated = slots.find((s) => s.id === activeSlot.id);
      if (updated) setActiveSlot(updated);
    }
  }, [slots]);

  function openSlot(slot: Slot) {
    setActiveSlot(slot);
  }

  function closeSlot() {
    setActiveSlot(null);
    refreshSlots();
  }

  function handleNavigate(p: Page) {
    setPage(p);
    setActiveSlot(null);
  }

  function renderContent() {
    if (activeSlot) {
      return (
        <SlotDetails
          slot={activeSlot}
          settings={settings}
          onBack={closeSlot}
          onSlotsChange={refreshSlots}
        />
      );
    }
    if (page === "settings") {
      return (
        <Settings
          settings={settings}
          onSettingsChange={setSettings}
          onSlotsChange={refreshSlots}
        />
      );
    }
    return (
      <Dashboard
        slots={slots}
        settings={settings}
        onSlotsChange={refreshSlots}
        onOpenSlot={openSlot}
      />
    );
  }

  return (
    <div
      className={`app-shell theme-${resolvedTheme} flex h-screen overflow-hidden ${resolvedTheme === "light" ? "bg-[#f4f6fb] text-slate-900" : "bg-[#0d0d0d] text-white"}`}
    >
      <AppSidebar
        currentPage={activeSlot ? "dashboard" : page}
        onNavigate={handleNavigate}
      />
      <main className="flex-1 overflow-hidden">{renderContent()}</main>
    </div>
  );
}

// Placeholder export so JSX below doesn't conflict with original template remnants
export default App;
