import { Plus, LogOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { logout } from "../auth";

interface TopbarProps {
  onNewEntry: () => void;
}

export function Topbar({ onNewEntry }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onNewEntry} title="New entry">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={logout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
