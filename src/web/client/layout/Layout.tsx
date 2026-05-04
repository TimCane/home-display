import { useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CreateEntryModal } from "../components/CreateEntryModal";

interface LayoutContext {
  openCreateModal: () => void;
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}

export function Layout() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onNewEntry={() => setModalOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ openCreateModal: () => setModalOpen(true) }} />
        </main>
      </div>
      <CreateEntryModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
