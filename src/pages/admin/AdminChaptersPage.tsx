import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, AlertCircle, FileText } from "lucide-react";
import { getNovel, createChapter, deleteChapter, type Novel, type Chapter } from "../../lib/api";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

export default function AdminChaptersPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const n = await getNovel(slug);
      setNovel(n);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [slug]);

  const handleDelete = async (ch: Chapter) => {
    if (!confirm(`Delete "${ch.title}"? This cannot be undone.`)) return;
    setDeleting(ch.number);
    try {
      await deleteChapter(slug, ch.number);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AdminLayout activeKey="admin-chapters">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate({ name: "admin-novels" })}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
        >
          <ArrowLeft size={18} /> Back to Novels
        </button>
        <button
          onClick={() => navigate({ name: "admin-chapter-edit", slug })}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
        >
          <Plus size={18} /> Add Chapter
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
      ) : !novel ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">
          Novel not found.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <FileText size={20} className="text-amber-500" />
            <div>
              <h2 className="font-serif text-base font-bold text-slate-900 dark:text-white">{novel.title}</h2>
              <p className="text-sm text-slate-400">{novel.chapters.length} chapters total</p>
            </div>
          </div>

          {novel.chapters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-700">
              No chapters yet. Click "Add Chapter" to create one.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                  <tr>
                    <th className="w-16 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Title</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {novel.chapters.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">{c.number}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-200">{c.title}</td>
                      <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell dark:text-slate-400">{c.publishedAt}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate({ name: "admin-chapter-edit", slug, chapter: c.number })}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-700"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            disabled={deleting === c.number}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30"
                          >
                            {deleting === c.number ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
