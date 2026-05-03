import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient, queryClient } from "./trpc";
import { Layout } from "./layout/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { EntriesPage } from "./pages/EntriesPage";
import { DraftsPage } from "./pages/DraftsPage";
import { GeneratorsPage } from "./pages/GeneratorsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { EditorPage } from "./pages/EditorPage";

export function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Editor has no sidebar layout */}
            <Route path="/editor/:uuid" element={<EditorPage />} />

            {/* Admin pages with sidebar + topbar */}
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="entries" element={<EntriesPage />} />
              <Route path="drafts" element={<DraftsPage />} />
              <Route path="generators" element={<GeneratorsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="diagnostics" element={<DiagnosticsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
