import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, X, Save, Tag } from "lucide-react";
import { getGenres, createGenre, updateGenre, deleteGenre, type Genre } from "../../lib/api";
import { slugify } from "../../lib/api";
import AdminLayout from "../../components/admin/AdminLayout";

interface EditState {
  id?: string;
  name: string;
  slug: string;
}

export default function AdminGenresPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getGenres();
      setGenres(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load genres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setFormError(null);
    setEditing({ name: "", slug: "" });
  };

  const openEdit = (g: Genre) => {
    setFormError(null);
    setEditing({ id: g.id, name: g.name, slug: g.slug });
  };

  const closeForm = () => {
    setEditing(null);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const slug = editing.slug.trim();
    if (!name) { setFormError("Genre name is required"); return; }
    if (!slug) { setFormError("Slug is required"); return; }

    const duplicate = genres.find((g) => g.slug === slug && g.id !== editing.id);
    if (duplicate) { setFormError(`Slug "${slug}" is already used by "${duplicate.name}"`); return; }

    setSaving(true);
    setFormError(null);
    try {
      if (editing.id) {
        await updateGenre(editing.id, name, slug);
      } else {
        await createGenre(name, slug);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: Genre) => {
    if (!confirm(`Delete genre "${g.name}"? Novels using this genre will lose the association.`)) return;
    setDeleting(g.id);
    try {
      await deleteGenre(g.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AdminLayout activeKey="admin-genres">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-white">Genres</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage the genres available when editing novels.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
        >
          <Plus size={18} /> Add Genre
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Genre Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {genres.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-400">
                    No genres yet. Click "Add Genre" to create one.
                  </td>
                </tr>
              ) : (
                genres.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-200">
                        <Tag size={14} className="text-amber-500" />
                        {g.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">{g.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(g)}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-700"
                          title="Edit genre"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          disabled={deleting === g.id}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30"
                          title="Delete genre"
                        >
                          {deleting === g.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                {editing.id ? "Edit Genre" : "New Genre"}
              </h3>
              <button onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Genre Name *</label>
                <input
                  value={editing.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEditing((prev) => prev ? { ...prev, name, slug: prev.id ? prev.slug : slugify(name) } : prev);
                  }}
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="e.g. Fantasy"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Slug *</label>
                <input
                  value={editing.slug}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, slug: e.target.value } : prev)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="auto-generated-from-name"
                />
                <p className="mt-1 text-xs text-slate-400">URL-friendly identifier. Must be unique.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {editing.id ? "Save Changes" : "Create Genre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
