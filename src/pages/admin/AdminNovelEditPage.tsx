import { useEffect, useState } from "react";
import { ArrowLeft, Save, Loader2, AlertCircle, Upload, X } from "lucide-react";
import { getNovel, getGenres, getTags, createNovel, updateNovel, type Novel, type NovelStatus, type Genre, type Tag } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

const STATUSES: NovelStatus[] = ["Ongoing", "Completed", "Hiatus"];

export default function AdminNovelEditPage({ slug }: { slug?: string }) {
  const { navigate } = useRouter();
  const isEdit = !!slug;

  const [title, setTitle] = useState("");
  const [altTitle, setAltTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<NovelStatus>("Ongoing");
  const [synopsis, setSynopsis] = useState("");
  const [coverHue, setCoverHue] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [genres, tags] = await Promise.all([getGenres(), getTags()]);
        setAllGenres(genres);
        setAllTags(tags);
        if (slug) {
          const novel = await getNovel(slug);
          if (novel) {
            setTitle(novel.title);
            setAltTitle(novel.altTitle);
            setAuthor(novel.author);
            setStatus(novel.status);
            setSynopsis(novel.synopsis);
            setCoverHue(novel.coverHue);
            setCoverUrl(novel.coverUrl);
            setSelectedGenres(novel.genres);
            setSelectedTags(novel.tags);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleUploadCover = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("novel-covers").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("novel-covers").getPublicUrl(path);
      setCoverUrl(urlData.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleGenre = (name: string) => {
    setSelectedGenres((prev) => prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]);
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !selectedTags.includes(t)) {
      setSelectedTags((prev) => [...prev, t]);
    }
    setNewTag("");
  };

  const removeTag = (t: string) => setSelectedTags((prev) => prev.filter((x) => x !== t));

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError("Title is required"); return; }
    if (!author.trim()) { setError("Author is required"); return; }
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        altTitle: altTitle.trim(),
        author: author.trim(),
        status,
        synopsis: synopsis.trim(),
        coverHue,
        coverUrl,
        genres: selectedGenres,
        tags: selectedTags,
      };
      if (isEdit && slug) {
        await updateNovel(slug, input);
      } else {
        await createNovel(input);
      }
      navigate({ name: "admin-novels" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout activeKey="admin-novel-edit">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="admin-novel-edit">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate({ name: "admin-novels" })}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
        >
          <ArrowLeft size={18} /> Back to Novels
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isEdit ? "Save Changes" : "Create Novel"}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: main fields */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">Novel Information</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Enter novel title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Alternative Title</label>
                <input
                  value={altTitle}
                  onChange={(e) => setAltTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Alternative title (optional)"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Author *</label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Author name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Synopsis</label>
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Enter novel synopsis"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <div className="flex gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        status === s ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Genres */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-serif text-base font-bold text-slate-900 dark:text-white">Genres</h2>
            <div className="flex flex-wrap gap-2">
              {allGenres.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.name)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedGenres.includes(g.name)
                      ? "bg-amber-500 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-serif text-base font-bold text-slate-900 dark:text-white">Tags</h2>
            <div className="mb-3 flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag and press Enter"
                list="existing-tags"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <datalist id="existing-tags">
                {allTags.map((t) => <option key={t.id} value={t.name} />)}
              </datalist>
              <button onClick={addTag} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 hover:text-rose-600"><X size={14} /></button>
                </span>
              ))}
              {selectedTags.length === 0 && <p className="text-sm text-slate-400">No tags added yet.</p>}
            </div>
          </div>
        </div>

        {/* Right: cover + preview */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-serif text-base font-bold text-slate-900 dark:text-white">Cover Image</h2>
            {coverUrl ? (
              <div className="relative mb-3">
                <img src={coverUrl} alt="Cover" className="aspect-[3/4] w-full rounded-lg object-cover" />
                <button
                  onClick={() => setCoverUrl(null)}
                  className="absolute right-2 top-2 rounded-lg bg-rose-500 p-1.5 text-white hover:bg-rose-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="mb-3 flex aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900">
                <span className="text-sm text-slate-400">No cover uploaded</span>
              </div>
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? "Uploading..." : "Upload Cover"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadCover(f); }}
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-serif text-base font-bold text-slate-900 dark:text-white">Cover Color (Fallback)</h2>
            <p className="mb-3 text-xs text-slate-400">Used when no cover image is uploaded. Select a color palette:</p>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCoverHue(i)}
                  className={`h-12 rounded-lg transition-all ${coverHue === i ? "ring-2 ring-amber-500 ring-offset-2" : ""}`}
                  style={{
                    background: `linear-gradient(135deg, ${[
                      "#1e3a8a", "#7c2d12", "#064e3b", "#831843",
                      "#1e1b4b", "#451a03", "#0f172a", "#3b0764"
                    ][i]}, ${[
                      "#0ea5e9", "#f97316", "#10b981", "#ec4899",
                      "#6366f1", "#a16207", "#475569", "#a855f7"
                    ][i]})`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
