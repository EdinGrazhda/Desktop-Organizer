import {
  Bird,
  LayoutGrid,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

type Page = "dashboard" | "settings";

interface AppSidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; icon: LucideIcon; label: string }[] = [
  { page: "dashboard", icon: LayoutGrid, label: "Dashboard" },
  { page: "settings", icon: SlidersHorizontal, label: "Settings" },
];

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 bg-[#111] border-r border-white/5 shrink-0">
      {/* Logo */}
      <div
        className="mb-6 w-10 h-10 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/25 to-blue-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/10"
        title="N'Rend"
      >
        <Bird className="w-5 h-5 text-cyan-200" strokeWidth={2} />
      </div>

      <nav className="flex flex-col gap-1 flex-1 w-full px-2">
        {navItems.map(({ page, icon: Icon, label }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            title={label}
            className={`w-full aspect-square flex items-center justify-center rounded-xl transition-colors ${
              currentPage === page
                ? "bg-white/10 text-white"
                : "text-gray-600 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        ))}
      </nav>

      {/* Bottom version indicator */}
      <div className="text-[10px] text-gray-700 mt-auto">v1.0</div>
    </aside>
  );
}
