import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Upload,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "../../lib/router";
import { useAdminAuth } from "../../lib/admin-auth";

interface NavItem {
  label: string;
  icon: ReactNode;
  route: Parameters<ReturnType<typeof useRouter>["navigate"]>[0];
  match: string[];
}

const NAV: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={18} />, route: { name: "admin" }, match: ["admin"] },
  { label: "Novels", icon: <BookOpen size={18} />, route: { name: "admin-novels" }, match: ["admin-novels", "admin-novel-edit"] },
  { label: "Import", icon: <Upload size={18} />, route: { name: "admin-import" }, match: ["admin-import"] },
];

export default function AdminLayout({ children, activeKey }: { children: ReactNode; activeKey: string }) {
  const { navigate, route } = useRouter();
  const { user, signOut } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: NavItem) => item.match.includes(activeKey);

  const handleSignOut = async () => {
    await signOut();
    navigate({ name: "admin-login" });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 font-serif text-lg font-black text-white">L</div>
        <span className="font-serif text-lg font-bold text-white">LumenAdmin</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <button
            key={item.label}
            onClick={() => { navigate(item.route); setMobileOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item)
                ? "bg-amber-500 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={() => navigate({ name: "home" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          <ExternalLink size={18} /> View Site
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-900/30"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-60 bg-slate-800 lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-slate-800">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
              {NAV.find((n) => isActive(n))?.label ?? "Admin"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">{user?.email}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
              {user?.email?.[0]?.toUpperCase() ?? "A"}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
