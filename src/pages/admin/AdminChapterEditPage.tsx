import { useEffect, useState } from "react";
import { ArrowLeft, Save, Loader2, AlertCircle } from "lucide-react";
import { getNovel, getChapter, createChapter, updateChapter, type Novel, type Chapter } from "../../lib/api";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

export default function AdminChapterEditPage({ slug, chapter }: { slug: string; chapter?: number }) {
  const { navigate } = useRouter();
  const isEdit = chapter !== undefined;

  const [novel, setNovel] = useState<Novel | null>(null);
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishedAt, setPublishedAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const n = await getNovel(slug);
        setNovel(n);
        if (chapter !== undefined) {
          const result = await getChapter(slug, chapter);
          if (result) {
            setTitle(result.chapter.title);
            setContent(result.chapter.content.join("\n\n"));
            setPublishedAt(result.chapter.publishedAt || new Date().toISOString().slice(0, 10));
            setStatus(result.chapter.status);
            setNumber(result.chapter.number);
          }
        } else if (n) {
          // Default to next chapter number
          const maxNum = n.chapters.reduce((max, c) => Math.max(max, c.number), 0);
          setNumber(maxNum + 1);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, chapter]);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError("Chapter title is required"); return; }
    if (number < 1) { setError("Chapter number must be at least 1"); return; }
    setSaving(true);
    try {
      const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      const input = {
        number,
        title: title.trim(),
        content: paragraphs,
        publishedAt,
        status,
      };
      if (isEdit && chapter !== undefined) {
        await updateChapter(slug, chapter, input);
      } else {
        await createChapter(slug, input);
      }
      navigate({ name: "admin-chapters", slug });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout activeKey="admin-chapters">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="admin-chapters">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate({ name: "admin-chapters", slug })}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
        >
          <ArrowLeft size={18} /> Back to Chapters
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {isEdit ? "Save Changes" : "Create Chapter"}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">
          {isEdit ? "Edit Chapter" : "New Chapter"}
          {novel && <span className="ml-2 text-sm font-normal text-slate-400">— {novel.title}</span>}
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Chapter Number</label>
              <input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Publish Date</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatus("published")}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    status === "published" ? "bg-emerald-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Published
                </button>
                <button
                  onClick={() => setStatus("draft")}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    status === "draft" ? "bg-slate-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  Draft
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Chapter Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter chapter title"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Chapter Content <span className="text-xs text-slate-400">(separate paragraphs with a blank line)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="Write or paste chapter content here. Separate paragraphs with a blank line."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-serif text-sm leading-relaxed outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
            <p className="mt-1 text-xs text-slate-400">
              {content.split(/\n\n+/).filter((p) => p.trim()).length} paragraphs
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
