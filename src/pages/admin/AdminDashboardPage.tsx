import { useEffect, useState } from "react";
import { BookOpen, FileText, Users, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { listNovels, formatViews, type Novel } from "../../lib/api";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

interface Stats {
  novelCount: number;
  chapterCount: number;
  userCount: number;
}

export default function AdminDashboardPage() {
  const { navigate } = useRouter();
  const [stats, setStats] = useState<Stats>({ novelCount: 0, chapterCount: 0, userCount: 0 });
  const [recentNovels, setRecentNovels] = useState<Novel[]>([]);
  const [recentChapters, setRecentChapters] = useState<{ title: string; novelTitle: string; number: number; status: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [novels, { count: chapterCount }, { count: userCount }] = await Promise.all([
          listNovels(),
          supabase.from("chapters").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
        ]);
        if (!active) return;
        setStats({ novelCount: novels.length, chapterCount: chapterCount ?? 0, userCount: userCount ?? 0 });
        setRecentNovels([...novels].sort((a, b) => b.views - a.views).slice(0, 5));

        const { data: ch } = await supabase
          .from("chapters")
          .select("title, number, status, created_at, novels!inner(title)")
          .order("created_at", { ascending: false })
          .limit(5);
        if (active && ch) {
          setRecentChapters(ch.map((c: any) => ({
            title: c.title,
            novelTitle: c.novels?.title ?? "—",
            number: c.number,
            status: c.status,
            createdAt: c.created_at,
          })));
        }
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <AdminLayout activeKey="admin">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout activeKey="admin">
        <div className="flex h-64 items-center justify-center text-rose-500">
          <AlertCircle size={20} className="mr-2" /> {error}
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: "Total Novels", value: stats.novelCount, icon: <BookOpen size={20} />, color: "bg-blue-500" },
    { label: "Total Chapters", value: stats.chapterCount, icon: <FileText size={20} />, color: "bg-emerald-500" },
    { label: "Total Users", value: stats.userCount, icon: <Users size={20} />, color: "bg-amber-500" },
    { label: "Total Views", value: formatViews(recentNovels.reduce((s, n) => s + n.views, 0)), icon: <TrendingUp size={20} />, color: "bg-rose-500" },
  ];

  return (
    <AdminLayout activeKey="admin">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${s.color}`}>{s.icon}</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent novels */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-base font-bold text-slate-900 dark:text-white">Recent Novels</h2>
            <button onClick={() => navigate({ name: "admin-novels" })} className="text-sm text-amber-600 hover:underline dark:text-amber-400">View all</button>
          </div>
          <div className="space-y-2">
            {recentNovels.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate({ name: "admin-novel-edit", slug: n.slug })}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-200">{n.title}</p>
                  <p className="text-xs text-slate-400">{n.author} · {n.chapters.length} chapters</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatViews(n.views)} views</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent chapters */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">Recent Chapters</h2>
          <div className="space-y-2">
            {recentChapters.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-200">{c.title}</p>
                  <p className="text-xs text-slate-400">{c.novelTitle} · Ch. {c.number}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  c.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
