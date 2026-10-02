import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppShellProps {
  children: ReactNode;
}

function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
