type Page = "dashboard" | "settings";

interface AppSidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; icon: string; label: string }[] = [
  { page: "dashboard", icon: "⊞", label: "Dashboard" },
  { page: "settings",  icon: "⚙",  label: "Settings"  },
];

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 bg-[#111] border-r border-white/5 shrink-0">
      {/* Logo */}
      <div className="mb-6 text-xl" title="DeskNest">🪺</div>

      <nav className="flex flex-col gap-1 flex-1 w-full px-2">
        {navItems.map(({ page, icon, label }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            title={label}
            className={`w-full aspect-square flex items-center justify-center rounded-xl text-lg transition-colors ${
              currentPage === page
                ? "bg-white/10 text-white"
                : "text-gray-600 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            {icon}
          </button>
        ))}
      </nav>

      {/* Bottom version indicator */}
      <div className="text-[10px] text-gray-700 mt-auto">v1.0</div>
    </aside>
  );
}
