import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <Header />
      <main
        className="pt-[var(--header-height)] min-h-screen"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <div className="p-6 page-enter">{children}</div>
      </main>
    </div>
  );
}
