import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, Loader2, AlertCircle, Calendar, Zap, Clock } from "lucide-react";
import { getNovelAdmin, getChapterAdmin, createChapter, updateChapter, type Novel, type Chapter } from "../../lib/api";
import { sanitizeHtml, contentArrayToEditorHtml, editorHtmlToContentArray } from "../../lib/html-sanitize";
import RichTextEditor from "../../components/RichTextEditor";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

type PublishMode = "now" | "schedule";

function jakartaDateTimeParts(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function jakartaNow(): string {
  return jakartaDateTimeParts(new Date());
}

function jakartaToday(): string {
  return jakartaNow().slice(0, 10);
}

function toIsoFromJakarta(localStr: string): string {
  return new Date(localStr + "+07:00").toISOString();
}

function formatJakartaFromIso(isoStr: string | null): string {
  if (!isoStr) return "";
  try {
    return jakartaDateTimeParts(new Date(isoStr));
  } catch {
    return "";
  }
}

export default function AdminChapterEditPage({ slug, chapter }: { slug: string; chapter?: number }) {
  const { navigate } = useRouter();
  const isEdit = chapter !== undefined;

  const [novel, setNovel] = useState<Novel | null>(null);
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [publishedAt, setPublishedAt] = useState(jakartaToday());
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [scheduleDate, setScheduleDate] = useState(jakartaNow());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalPublishAt, setOriginalPublishAt] = useState<string | null>(null);
  const [originalPublished, setOriginalPublished] = useState(false);

  const wordCount = useMemo(() => {
    if (!content) return 0;
    const text = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, " ");
    const trimmed = text.replace(/\s+/g, " ").trim();
    return trimmed ? trimmed.split(" ").length : 0;
  }, [content]);

  useEffect(() => {
    (async () => {
      try {
        const n = await getNovelAdmin(slug);
        setNovel(n);
        if (chapter !== undefined) {
          const result = await getChapterAdmin(slug, chapter);
          if (result) {
            setTitle(result.chapter.title);
            setContent(contentArrayToEditorHtml(result.chapter.content));
            setPublishedAt(result.chapter.publishedAt || jakartaToday());
            setStatus(result.chapter.status);
            setNumber(result.chapter.number);
            setOriginalPublishAt(result.chapter.publishAt);
            setOriginalPublished(result.chapter.published);
            if (result.chapter.published) {
              setPublishMode("now");
            } else if (result.chapter.publishAt) {
              setPublishMode("schedule");
              setScheduleDate(formatJakartaFromIso(result.chapter.publishAt));
            } else {
              setPublishMode("now");
            }
          }
        } else if (n) {
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
    if (publishMode === "schedule" && !scheduleDate) { setError("Schedule date is required"); return; }
    setSaving(true);
    try {
      const sanitized = sanitizeHtml(content);
      const contentArray = editorHtmlToContentArray(sanitized);

      let publishAt: string | null;
      if (status === "draft") {
        publishAt = null;
      } else if (publishMode === "schedule") {
        publishAt = toIsoFromJakarta(scheduleDate);
      } else {
        // Publish Now
        if (originalPublished && originalPublishAt) {
          // Already-published chapter with exact timestamp: preserve it.
          publishAt = originalPublishAt;
        } else if (originalPublished && !originalPublishAt) {
          // Legacy published chapter with null publish_at: keep null.
          publishAt = null;
        } else {
          // New or previously unpublished chapter: stamp exact Publish Now moment.
          publishAt = new Date().toISOString();
        }
      }

      const input = {
        number,
        title: title.trim(),
        content: contentArray,
        publishedAt,
        status,
        published: status === "draft" ? false : publishMode === "now",
        publishAt,
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

          {/* Publishing schedule */}
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Publishing</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPublishMode("now")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  publishMode === "now" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <Zap size={16} /> Publish Now
              </button>
              <button
                onClick={() => setPublishMode("schedule")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  publishMode === "schedule" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <Calendar size={16} /> Schedule Publish
              </button>
            </div>
            {publishMode === "schedule" && (
              <div className="mt-3 space-y-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Date & Time (Asia/Jakarta)</label>
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                      <Clock size={14} /> Timezone: WIB (UTC+7)
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  The chapter will be hidden from readers until the scheduled time, then automatically published.
                </p>
              </div>
            )}
            {publishMode === "now" && (
              <p className="mt-2 text-xs text-slate-400">
                The chapter will be visible to readers immediately upon saving.
              </p>
            )}
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
              Chapter Content
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write or paste chapter content here..."
              minHeight={400}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Word Count: {wordCount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
