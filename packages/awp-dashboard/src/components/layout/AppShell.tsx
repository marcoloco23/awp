import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent)] focus:text-[var(--text-inverse)] focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <Sidebar />
      <Header />
      <main
        id="main-content"
        className="pt-[var(--header-height)] min-h-screen"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <div className="p-6 page-enter">{children}</div>
      </main>
    </div>
  );
}
