import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Image,
  FileEdit,
  Cog,
  Activity,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/entries", label: "Entries", icon: Image },
  { to: "/drafts", label: "Drafts", icon: FileEdit },
  { to: "/generators", label: "Generators", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Cog },
  { to: "/diagnostics", label: "Diagnostics", icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r bg-sidebar-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold text-sidebar-foreground">
          Home Display
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
