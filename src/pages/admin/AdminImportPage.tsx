import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Archive,
  FileUp,
  Eye,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import mammoth from "mammoth";
import JSZip from "jszip";
import {
  listNovels,
  getNovel,
  createChapter,
  type Novel,
} from "../../lib/api";
import { parseDocx, paragraphsToContent, paragraphsToPreviewHtml, type ParsedDocx } from "../../lib/docx";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

type ImportResult = { title: string; paragraphs: number; status: "ok" | "error"; message?: string };

type Step = "select" | "preview" | "done";

export default function AdminImportPage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState("");
  const [mode, setMode] = useState<"docx" | "zip">("docx");
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterStatus, setChapterStatus] = useState<"published" | "draft">("published");
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("select");
  const [parsed, setParsed] = useState<ParsedDocx | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listNovels().then((n) => setNovels(n)).catch(() => {});
  }, []);

  const selectedNovelData = novels.find((n) => n.slug === selectedNovel);

  const checkDuplicate = (num: number, novel: Novel | undefined) => {
    if (!novel) return false;
    return novel.chapters.some((c) => c.number === num);
  };

  const handleDocxFile = async (file: File) => {
    if (!selectedNovel) {
      setError("Please select a novel first");
      return;
    }
    setProcessing(true);
    setError(null);
    setSuccess(null);
    setParsed(null);
    setPreviewHtml("");
    setSelectedFile(file);
    try {
      const result = await parseDocx(file);
      if (result.paragraphs.length === 0) {
        setError("No content found in DOCX file");
        setStep("select");
        return;
      }

      setParsed(result);
      setPreviewHtml(paragraphsToPreviewHtml(result.paragraphs));

      if (result.detectedTitle) {
        setChapterTitle(result.detectedTitle);
      } else {
        setChapterTitle(file.name.replace(/\.docx$/i, ""));
      }

      let num = result.detectedNumber;
      if (num === null) {
        const novel = selectedNovelData;
        num = novel ? novel.chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1 : 1;
      }
      setChapterNumber(num);

      if (checkDuplicate(num, selectedNovelData)) {
        setDuplicateWarning(`Chapter ${num} already exists in this novel. Importing will overwrite it.`);
      } else {
        setDuplicateWarning(null);
      }

      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse DOCX");
      setStep("select");
    } finally {
      setProcessing(false);
    }
  };

  const handleNumberChange = (num: number) => {
    setChapterNumber(num);
    if (checkDuplicate(num, selectedNovelData)) {
      setDuplicateWarning(`Chapter ${num} already exists in this novel. Importing will overwrite it.`);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsed || !selectedNovel) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const novel = await getNovel(selectedNovel);
      const existing = novel?.chapters.find((c) => c.number === chapterNumber);

      const content = paragraphsToContent(parsed.paragraphs);
      const title = chapterTitle.trim() || selectedFile?.name.replace(/\.docx$/i, "") || `Chapter ${chapterNumber}`;

      if (existing) {
        const { supabase } = await import("../../lib/supabase");
        const { data: novelRow } = await supabase
          .from("novels")
          .select("id")
          .eq("slug", selectedNovel)
          .maybeSingle();
        if (!novelRow) throw new Error("Novel not found");
        const { error: upErr } = await supabase
          .from("chapters")
          .update({
            title,
            content,
            published_at: new Date().toISOString().slice(0, 10),
            status: chapterStatus,
          })
          .eq("novel_id", novelRow.id)
          .eq("number", chapterNumber);
        if (upErr) throw upErr;
      } else {
        await createChapter(selectedNovel, {
          number: chapterNumber,
          title,
          content,
          publishedAt: new Date().toISOString().slice(0, 10),
          status: chapterStatus,
        });
      }

      setSuccess(`"${title}" imported successfully as Chapter ${chapterNumber}!`);
      setResults([{ title, paragraphs: parsed.paragraphs.length, status: "ok" }]);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("select");
    setParsed(null);
    setPreviewHtml("");
    setChapterTitle("");
    setChapterNumber(1);
    setDuplicateWarning(null);
    setSelectedFile(null);
    setResults([]);
    setSuccess(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleZip = async (file: File) => {
    if (!selectedNovel) { setError("Please select a novel first"); return; }
    setProcessing(true);
    setError(null);
    setResults([]);
    try {
      const zip = await JSZip.loadAsync(file);
      const docxFiles = Object.values(zip.files).filter((f) => /\.docx$/i.test(f.name) && !f.dir);

      if (docxFiles.length === 0) {
        setError("No DOCX files found in the ZIP archive");
        return;
      }

      const novel = await getNovel(selectedNovel);
      let nextNum = novel ? novel.chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1 : 1;
      const existingNums = new Set(novel ? novel.chapters.map((c) => c.number) : []);
      const imported: ImportResult[] = [];

      for (const f of docxFiles) {
        try {
          const arrayBuffer = await f.async("arraybuffer");
          const result = await parseDocx(arrayBuffer);
          if (result.paragraphs.length === 0) continue;

          let num = result.detectedNumber;
          if (num === null) {
            const nameMatch = f.name.match(/(\d+)/);
            num = nameMatch ? parseInt(nameMatch[1], 10) : nextNum;
          }
          while (existingNums.has(num)) num++;
          existingNums.add(num);

          const title = result.detectedTitle
            || f.name.replace(/\.docx$/i, "").replace(/^[0-9]+[_\-\s]*/, "");

          await createChapter(selectedNovel, {
            number: num,
            title,
            content: paragraphsToContent(result.paragraphs),
            publishedAt: new Date().toISOString().slice(0, 10),
            status: chapterStatus,
          });
          imported.push({ title, paragraphs: result.paragraphs.length, status: "ok" });
          nextNum++;
        } catch (e) {
          imported.push({ title: f.name, paragraphs: 0, status: "error", message: e instanceof Error ? e.message : "Failed" });
        }
      }

      setResults(imported);
      setSuccess(`${imported.filter((r) => r.status === "ok").length} chapter(s) imported successfully!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ZIP import failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout activeKey="admin-import">
      <div className="mb-6">
        <button
          onClick={() => navigate({ name: "admin" })}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400"
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
      </div>

      <h1 className="mb-6 font-serif text-xl font-bold text-slate-900 dark:text-white">Import Content</h1>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Novel selector */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Select Novel</label>
        <select
          value={selectedNovel}
          onChange={(e) => { setSelectedNovel(e.target.value); handleReset(); }}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">— Choose a novel —</option>
          {novels.map((n) => (
            <option key={n.id} value={n.slug}>{n.title} ({n.chapters.length} chapters)</option>
          ))}
        </select>
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => { setMode("docx"); handleReset(); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "docx" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <FileUp size={18} /> Single DOCX
        </button>
        <button
          onClick={() => { setMode("zip"); handleReset(); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "zip" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Archive size={18} /> ZIP (Multiple DOCX)
        </button>
      </div>

      {/* DOCX mode */}
      {mode === "docx" && (
        <>
          {step === "select" && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">Import Single Chapter from DOCX</h2>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Upload a .docx file to import as a chapter. After upload, you'll preview the content and confirm before saving.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-slate-600 dark:hover:border-amber-500 dark:hover:bg-slate-700">
                {processing ? <Loader2 size={32} className="animate-spin text-amber-500" /> : <Upload size={32} className="text-slate-400" />}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {processing ? "Processing..." : "Click to select a .docx file"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Supports paragraphs, bold, italic, headings, and line breaks</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocxFile(f); }}
                />
              </label>
            </div>
          )}

          {step === "preview" && parsed && (
            <div className="space-y-6">
              {/* Metadata editor */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center gap-2">
                  <Eye size={18} className="text-amber-500" />
                  <h2 className="font-serif text-base font-bold text-slate-900 dark:text-white">Review & Confirm Import</h2>
                </div>

                {duplicateWarning && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    <AlertCircle size={16} /> {duplicateWarning}
                  </div>
                )}

                <div className="mb-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Chapter Title</label>
                    <input
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Chapter Number</label>
                    <input
                      type="number"
                      min={1}
                      value={chapterNumber}
                      onChange={(e) => handleNumberChange(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                    <select
                      value={chapterStatus}
                      onChange={(e) => setChapterStatus(e.target.value as "published" | "draft")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <FileText size={14} /> {parsed.paragraphs.length} paragraphs detected
                  </span>
                  {parsed.detectedTitle && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Title auto-detected
                    </span>
                  )}
                  {parsed.detectedNumber !== null && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Chapter number auto-detected
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
                  >
                    {importing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Confirm Import
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={importing}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <RefreshCw size={18} /> Choose Different File
                  </button>
                </div>
              </div>

              {/* Content preview */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="mb-3 font-serif text-base font-bold text-slate-900 dark:text-white">Content Preview</h3>
                <div
                  className="max-h-[500px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-5 font-serif text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-900/30">
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
                <h2 className="mb-1 font-serif text-lg font-bold text-slate-900 dark:text-white">Import Successful!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  The chapter has been added to the novel and is now visible on the frontend.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate({ name: "admin-chapters", slug: selectedNovel })}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400"
                >
                  <FileText size={18} /> View Chapter List
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <RefreshCw size={18} /> Import Another
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ZIP mode */}
      {mode === "zip" && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">Import Multiple Chapters from ZIP</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Upload a ZIP archive containing multiple .docx files. Each DOCX becomes a separate chapter. Chapter numbers are auto-detected from filenames or document headings; duplicates are automatically skipped.
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Default Status</label>
            <select
              value={chapterStatus}
              onChange={(e) => setChapterStatus(e.target.value as "published" | "draft")}
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-slate-600 dark:hover:border-amber-500 dark:hover:bg-slate-700">
            {processing ? <Loader2 size={32} className="animate-spin text-amber-500" /> : <Archive size={32} className="text-slate-400" />}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {processing ? "Processing..." : "Click to select a .zip file"}
              </p>
              <p className="mt-1 text-xs text-slate-400">Each .docx inside the ZIP becomes a chapter</p>
            </div>
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleZip(f); }}
            />
          </label>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && mode === "zip" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 font-serif text-base font-bold text-slate-900 dark:text-white">Import Results</h2>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                {r.status === "ok" ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-rose-500" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{r.title}</p>
                  <p className="text-xs text-slate-400">{r.paragraphs} paragraphs {r.message && `· ${r.message}`}</p>
                </div>
                <FileText size={16} className="text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
