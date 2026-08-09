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
  Files,
} from "lucide-react";
import mammoth from "mammoth";
import JSZip from "jszip";
import {
  listNovels,
  getNovelAdmin,
  createChapter,
  updateChapter,
  type Novel,
} from "../../lib/api";
import { Calendar, Zap, Clock } from "lucide-react";
import ScheduleOptions, { type ScheduleMode } from "../../components/admin/ScheduleOptions";
import { parseDocx, paragraphsToContent, paragraphsToPreviewHtml, type ParsedDocx, type ParsedParagraph } from "../../lib/docx";
import { parseTxt, type ParsedTxt } from "../../lib/txt";
import { useRouter } from "../../lib/router";
import AdminLayout from "../../components/admin/AdminLayout";

type ImportResult = { title: string; paragraphs: number; status: "ok" | "error"; message?: string };

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

function toIsoFromJakarta(localStr: string): string {
  return new Date(localStr + "+07:00").toISOString();
}

function computePublishAt(index: number, mode: ScheduleMode, startDate: string, intervalHours: number): string | null {
  if (mode === "immediate") return null;
  const hours = mode === "daily" ? 24 : intervalHours;
  const base = new Date(toIsoFromJakarta(startDate));
  const publishTime = new Date(base.getTime() + index * hours * 3600_000);
  return publishTime.toISOString();
}

type TxtPreviewItem = {
  fileName: string;
  number: number;
  title: string;
  paragraphs: ParsedParagraph[];
  duplicate: boolean;
  duplicateReason?: string;
};

type Step = "select" | "preview" | "done";

export default function AdminImportPage() {
  const { navigate } = useRouter();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState("");
  const [mode, setMode] = useState<"docx" | "zip" | "txt" | "multi-txt">("docx");
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
  const [txtParsed, setTxtParsed] = useState<ParsedTxt | null>(null);
  const [txtPreviewList, setTxtPreviewList] = useState<TxtPreviewItem[]>([]);
  const [txtImporting, setTxtImporting] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("immediate");
  const [scheduleStart, setScheduleStart] = useState(jakartaNow());
  const [intervalHours, setIntervalHours] = useState(24);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiTxtInputRef = useRef<HTMLInputElement>(null);

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
      const novel = await getNovelAdmin(selectedNovel);
      const existing = novel?.chapters.find((c) => c.number === chapterNumber);

      const content = paragraphsToContent(parsed.paragraphs);
      const title = chapterTitle.trim() || selectedFile?.name.replace(/\.docx$/i, "") || `Chapter ${chapterNumber}`;
      const isPublished = chapterStatus === "draft" ? false : scheduleMode === "immediate";
      const publishAt = chapterStatus === "draft" ? null : scheduleMode !== "immediate" ? toIsoFromJakarta(scheduleStart) : null;

      if (existing) {
        await updateChapter(selectedNovel, chapterNumber, {
          title,
          content,
          publishedAt: new Date().toISOString().slice(0, 10),
          status: chapterStatus,
          published: isPublished,
          publishAt,
        });
      } else {
        await createChapter(selectedNovel, {
          number: chapterNumber,
          title,
          content,
          publishedAt: new Date().toISOString().slice(0, 10),
          status: chapterStatus,
          published: isPublished,
          publishAt,
        });
      }

      setSuccess(`"${title}" imported successfully as Chapter ${chapterNumber}!`);
      setResults([{ title, paragraphs: parsed.paragraphs.length, status: "ok" }]);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Please try again.");
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
    setTxtParsed(null);
    setTxtPreviewList([]);
    setResults([]);
    setSuccess(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (multiTxtInputRef.current) multiTxtInputRef.current.value = "";
  };

  const handleTxtFile = async (file: File) => {
    if (!selectedNovel) {
      setError("Please select a novel first");
      return;
    }
    setProcessing(true);
    setError(null);
    setSuccess(null);
    setTxtParsed(null);
    setSelectedFile(file);
    try {
      const result = await parseTxt(file);
      if (result.paragraphs.length === 0) {
        setError("No content found in TXT file");
        setStep("select");
        return;
      }

      setTxtParsed(result);
      setPreviewHtml(paragraphsToPreviewHtml(result.paragraphs));

      if (result.detectedTitle) {
        setChapterTitle(result.detectedTitle);
      } else {
        setChapterTitle(file.name.replace(/\.txt$/i, ""));
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
      setError(e instanceof Error ? e.message : "Failed to parse TXT");
      setStep("select");
    } finally {
      setProcessing(false);
    }
  };

  const handleTxtConfirmImport = async () => {
    if (!txtParsed || !selectedNovel) return;
    setTxtImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const novel = await getNovelAdmin(selectedNovel);
      const existing = novel?.chapters.find((c) => c.number === chapterNumber);

      const content = paragraphsToContent(txtParsed.paragraphs);
      const title = chapterTitle.trim() || selectedFile?.name.replace(/\.txt$/i, "") || `Chapter ${chapterNumber}`;
      const isPublished = chapterStatus === "draft" ? false : scheduleMode === "immediate";
      const publishAt = chapterStatus === "draft" ? null : scheduleMode !== "immediate" ? toIsoFromJakarta(scheduleStart) : null;

      if (existing) {
        await updateChapter(selectedNovel, chapterNumber, {
          title,
          content,
          publishedAt: new Date().toISOString().slice(0, 10),
          status: chapterStatus,
          published: isPublished,
          publishAt,
        });
      } else {
        await createChapter(selectedNovel, {
          number: chapterNumber,
          title,
          content,
          publishedAt: new Date().toISOString().slice(0, 10),
          status: chapterStatus,
          published: isPublished,
          publishAt,
        });
      }

      setSuccess(`"${title}" imported successfully as Chapter ${chapterNumber}!`);
      setResults([{ title, paragraphs: txtParsed.paragraphs.length, status: "ok" }]);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Please try again.");
    } finally {
      setTxtImporting(false);
    }
  };

  const handleMultiTxtFiles = async (files: FileList) => {
    if (!selectedNovel) {
      setError("Please select a novel first");
      return;
    }
    setProcessing(true);
    setError(null);
    setSuccess(null);
    setTxtPreviewList([]);
    try {
      const novel = await getNovelAdmin(selectedNovel);
      const existingNums = new Set(novel ? novel.chapters.map((c) => c.number) : []);
      const seenNums = new Set<number>();
      const items: TxtPreviewItem[] = [];

      for (const file of Array.from(files)) {
        try {
          const result = await parseTxt(file);
          if (result.paragraphs.length === 0) {
            items.push({
              fileName: file.name,
              number: result.detectedNumber ?? 0,
              title: result.detectedTitle ?? file.name,
              paragraphs: [],
              duplicate: true,
              duplicateReason: "No content found",
            });
            continue;
          }

          let num = result.detectedNumber;
          if (num === null) {
            const nameMatch = file.name.match(/(\d+)/);
            num = nameMatch ? parseInt(nameMatch[1], 10) : 0;
          }

          let duplicate = false;
          let duplicateReason: string | undefined;
          if (existingNums.has(num)) {
            duplicate = true;
            duplicateReason = `Chapter ${num} already exists in this novel`;
          } else if (seenNums.has(num)) {
            duplicate = true;
            duplicateReason = `Chapter ${num} duplicated within upload`;
          }
          seenNums.add(num);

          items.push({
            fileName: file.name,
            number: num,
            title: result.detectedTitle ?? file.name.replace(/\.txt$/i, "").replace(/^[0-9]+[_\-\s]*/, ""),
            paragraphs: result.paragraphs,
            duplicate,
            duplicateReason,
          });
        } catch (e) {
          items.push({
            fileName: file.name,
            number: 0,
            title: file.name,
            paragraphs: [],
            duplicate: true,
            duplicateReason: e instanceof Error ? e.message : "Failed to parse",
          });
        }
      }

      // Natural sort by detected chapter number when possible
      items.sort((a, b) => {
        if (a.number === 0 && b.number === 0) return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
        if (a.number === 0) return 1;
        if (b.number === 0) return -1;
        return a.number - b.number;
      });

      setTxtPreviewList(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process TXT files");
    } finally {
      setProcessing(false);
    }
  };

  const handleMultiTxtConfirmImport = async () => {
    if (!selectedNovel || txtPreviewList.length === 0) return;
    setTxtImporting(true);
    setError(null);
    setSuccess(null);
    setResults([]);
    try {
      const valid = txtPreviewList.filter((item) => !item.duplicate && item.paragraphs.length > 0);
      if (valid.length === 0) {
        setError("No valid chapters to import (all are duplicates or empty)");
        setTxtImporting(false);
        return;
      }

      const imported: ImportResult[] = [];
      for (let idx = 0; idx < valid.length; idx++) {
        const item = valid[idx];
        try {
          const isPublished = chapterStatus === "draft" ? false : scheduleMode === "immediate";
          const publishAt = chapterStatus === "draft" ? null : computePublishAt(idx, scheduleMode, scheduleStart, intervalHours);
          await createChapter(selectedNovel, {
            number: item.number,
            title: item.title || `Chapter ${item.number}`,
            content: paragraphsToContent(item.paragraphs),
            publishedAt: new Date().toISOString().slice(0, 10),
            status: chapterStatus,
            published: isPublished,
            publishAt,
          });
          imported.push({ title: item.title, paragraphs: item.paragraphs.length, status: "ok" });
        } catch (e) {
          imported.push({ title: item.title, paragraphs: 0, status: "error", message: e instanceof Error ? e.message : "Failed" });
        }
      }

      setResults(imported);
      setSuccess(`${imported.filter((r) => r.status === "ok").length} chapter(s) imported successfully!`);
      setTxtPreviewList([]);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setTxtImporting(false);
    }
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

      const novel = await getNovelAdmin(selectedNovel);
      let nextNum = novel ? novel.chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1 : 1;
      const existingNums = new Set(novel ? novel.chapters.map((c) => c.number) : []);
      const imported: ImportResult[] = [];

      let chapterIdx = 0;
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

          const isPublished = chapterStatus === "draft" ? false : scheduleMode === "immediate";
          const publishAt = chapterStatus === "draft" ? null : computePublishAt(chapterIdx, scheduleMode, scheduleStart, intervalHours);
          await createChapter(selectedNovel, {
            number: num,
            title,
            content: paragraphsToContent(result.paragraphs),
            publishedAt: new Date().toISOString().slice(0, 10),
            status: chapterStatus,
            published: isPublished,
            publishAt,
          });
          chapterIdx++;
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
        <button
          onClick={() => { setMode("txt"); handleReset(); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "txt" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <FileText size={18} /> Single TXT
        </button>
        <button
          onClick={() => { setMode("multi-txt"); handleReset(); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "multi-txt" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Files size={18} /> Multiple TXT
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

                <ScheduleOptions
                  scheduleMode={scheduleMode}
                  setScheduleMode={setScheduleMode}
                  scheduleStart={scheduleStart}
                  setScheduleStart={setScheduleStart}
                  intervalHours={intervalHours}
                  setIntervalHours={setIntervalHours}
                />

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
          <div className="mb-4">
            <ScheduleOptions
              scheduleMode={scheduleMode}
              setScheduleMode={setScheduleMode}
              scheduleStart={scheduleStart}
              setScheduleStart={setScheduleStart}
              intervalHours={intervalHours}
              setIntervalHours={setIntervalHours}
            />
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
      {results.length > 0 && (mode === "zip" || mode === "multi-txt") && (
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

      {/* Single TXT mode */}
      {mode === "txt" && (
        <>
          {step === "select" && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">Import Single Chapter from TXT</h2>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Upload a .txt file to import as a chapter. The first non-empty line is treated as the chapter heading. Supports both "Chapter 1 Title" and "第1章 标题" formats. UTF-8 encoding is fully supported including Chinese characters.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-slate-600 dark:hover:border-amber-500 dark:hover:bg-slate-700">
                {processing ? <Loader2 size={32} className="animate-spin text-amber-500" /> : <FileText size={32} className="text-slate-400" />}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {processing ? "Processing..." : "Click to select a .txt file"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">UTF-8 text · Supports English and Chinese chapter headings</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTxtFile(f); }}
                />
              </label>
            </div>
          )}

          {step === "preview" && txtParsed && (
            <div className="space-y-6">
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
                    <FileText size={14} /> {txtParsed.paragraphs.length} paragraphs detected
                  </span>
                  {txtParsed.detectedTitle && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Title auto-detected
                    </span>
                  )}
                  {txtParsed.detectedNumber !== null && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Chapter number auto-detected
                    </span>
                  )}
                </div>

                <ScheduleOptions
                  scheduleMode={scheduleMode}
                  setScheduleMode={setScheduleMode}
                  scheduleStart={scheduleStart}
                  setScheduleStart={setScheduleStart}
                  intervalHours={intervalHours}
                  setIntervalHours={setIntervalHours}
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleTxtConfirmImport}
                    disabled={txtImporting}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
                  >
                    {txtImporting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Confirm Import
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={txtImporting}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <RefreshCw size={18} /> Choose Different File
                  </button>
                </div>
              </div>

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

      {/* Multiple TXT mode */}
      {mode === "multi-txt" && (
        <>
          {txtPreviewList.length === 0 && step !== "done" && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 font-serif text-base font-bold text-slate-900 dark:text-white">Import Multiple Chapters from TXT Files</h2>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Upload multiple .txt files at once. Each file becomes a separate chapter. Chapter numbers are auto-detected from the first line heading or filename. Files are sorted naturally by chapter number. Supports both "Chapter 1 Title" and "第1章 标题" formats.
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
                {processing ? <Loader2 size={32} className="animate-spin text-amber-500" /> : <Files size={32} className="text-slate-400" />}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {processing ? "Processing..." : "Click to select multiple .txt files"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Each .txt file becomes one chapter · UTF-8 supported</p>
                </div>
                <input
                  ref={multiTxtInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleMultiTxtFiles(e.target.files); }}
                />
              </label>
            </div>
          )}

          {txtPreviewList.length > 0 && step !== "done" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-4 flex items-center gap-2">
                  <Eye size={18} className="text-amber-500" />
                  <h2 className="font-serif text-base font-bold text-slate-900 dark:text-white">Preview {txtPreviewList.length} Chapters</h2>
                </div>

                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        <th className="pb-2 pr-4 font-medium">#</th>
                        <th className="pb-2 pr-4 font-medium">File</th>
                        <th className="pb-2 pr-4 font-medium">Ch. Number</th>
                        <th className="pb-2 pr-4 font-medium">Title</th>
                        <th className="pb-2 pr-4 font-medium">Paragraphs</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txtPreviewList.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                          <td className="py-2 pr-4 text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{item.fileName}</td>
                          <td className="py-2 pr-4 font-medium text-slate-900 dark:text-white">{item.number || "—"}</td>
                          <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{item.title || "—"}</td>
                          <td className="py-2 pr-4 text-slate-400">{item.paragraphs.length}</td>
                          <td className="py-2">
                            {item.duplicate ? (
                              <span className="flex items-center gap-1 text-xs text-rose-500">
                                <AlertCircle size={14} /> {item.duplicateReason || "Duplicate"}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-emerald-500">
                                <CheckCircle size={14} /> OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{txtPreviewList.filter((i) => !i.duplicate).length} valid</span>
                  <span className="text-rose-500">{txtPreviewList.filter((i) => i.duplicate).length} duplicates/errors</span>
                </div>

                <ScheduleOptions
                  scheduleMode={scheduleMode}
                  setScheduleMode={setScheduleMode}
                  scheduleStart={scheduleStart}
                  setScheduleStart={setScheduleStart}
                  intervalHours={intervalHours}
                  setIntervalHours={setIntervalHours}
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleMultiTxtConfirmImport}
                    disabled={txtImporting || txtPreviewList.every((i) => i.duplicate)}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-60"
                  >
                    {txtImporting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Confirm Import ({txtPreviewList.filter((i) => !i.duplicate).length})
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={txtImporting}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <RefreshCw size={18} /> Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-900/30">
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
                <h2 className="mb-1 font-serif text-lg font-bold text-slate-900 dark:text-white">Import Successful!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {results.filter((r) => r.status === "ok").length} chapter(s) have been added to the novel and are now visible on the frontend.
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
                  <RefreshCw size={18} /> Import More
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </AdminLayout>
  );
}
