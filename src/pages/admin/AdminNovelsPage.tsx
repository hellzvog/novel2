import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Loader2, AlertCircle, FileText } from "lucide-react";
import { listNovels, deleteNovel, formatViews, type Novel } from "../../lib/api";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

export default function AdminNovelsPage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [filtered, setFiltered] = useState<Novel[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await listNovels();
      setNovels(data);
      setFiltered(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load novels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(novels.filter((n) => n.title.toLowerCase().includes(q) || n.author.toLowerCase().includes(q)));
  }, [search, novels]);

  const handleDelete = async (novel: Novel) => {
    if (!confirm(`Delete "${novel.title}" and all its chapters? This cannot be undone.`)) return;
    setDeleting(novel.slug);
    try {
      await deleteNovel(novel.slug);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AdminLayout activeKey="admin-novels">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search novels..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <button
          onClick={() => navigate({ name: "admin-novel-edit" })}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
        >
          <Plus size={18} /> Add Novel
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">
          No novels found. Click "Add Novel" to create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Title</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell dark:text-slate-400">Author</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell dark:text-slate-400">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell dark:text-slate-400">Chapters</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell dark:text-slate-400">Views</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map((n) => (
                <tr key={n.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{n.title}</p>
                    {n.altTitle && <p className="text-xs text-slate-400">{n.altTitle}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell dark:text-slate-300">{n.author}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      n.status === "Ongoing" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                      n.status === "Completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}>{n.status}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-600 sm:table-cell dark:text-slate-300">{n.chapters.length}</td>
                  <td className="hidden px-4 py-3 text-sm text-slate-600 lg:table-cell dark:text-slate-300">{formatViews(n.views)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate({ name: "admin-chapters", slug: n.slug })}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                        title="Manage chapters"
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        onClick={() => navigate({ name: "admin-novel-edit", slug: n.slug })}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-700"
                        title="Edit novel"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(n)}
                        disabled={deleting === n.slug}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30"
                        title="Delete novel"
                      >
                        {deleting === n.slug ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
