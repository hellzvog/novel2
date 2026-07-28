import type { Novel, Chapter } from "./api";

export interface ReadingHistoryEntry {
  novelId: string;
  novelSlug: string;
  novelTitle: string;
  novelCoverHue: number;
  chapterNumber: number;
  chapterTitle: string;
  lastReadAt: number;
}

export interface FavoriteEntry {
  novelId: string;
  novelSlug: string;
  novelTitle: string;
  novelCoverHue: number;
  author: string;
  status: string;
  addedAt: number;
}

export interface ReaderSettings {
  fontSize: number;
  width: "narrow" | "normal" | "wide";
  fontFamily: "serif" | "sans" | "mono";
  lineHeight: number;
  autoScrollSpeed: number;
}

const HISTORY_KEY = "lumen-reading-history";
const FAVORITES_KEY = "lumen-favorites";
const PROGRESS_KEY = "lumen-reading-progress";
const SETTINGS_KEY = "lumen-reader-settings";

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  width: "normal",
  fontFamily: "serif",
  lineHeight: 1.8,
  autoScrollSpeed: 50,
};

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ─── Reading History ───

export function getReadingHistory(): ReadingHistoryEntry[] {
  return safeParse<ReadingHistoryEntry[]>(HISTORY_KEY, []);
}

export function saveReadingHistory(novel: Novel, chapter: Chapter): void {
  const history = getReadingHistory();
  const filtered = history.filter((h) => h.novelId !== novel.id);
  filtered.unshift({
    novelId: novel.id,
    novelSlug: novel.slug,
    novelTitle: novel.title,
    novelCoverHue: novel.coverHue,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    lastReadAt: Date.now(),
  });
  safeWrite(HISTORY_KEY, filtered.slice(0, 20));
}

export function getLastReadChapter(novelId: string): ReadingHistoryEntry | null {
  const history = getReadingHistory();
  return history.find((h) => h.novelId === novelId) ?? null;
}

export function clearReadingHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// ─── Favorites ───

export function getFavorites(): FavoriteEntry[] {
  return safeParse<FavoriteEntry[]>(FAVORITES_KEY, []);
}

export function isFavorite(novelId: string): boolean {
  return getFavorites().some((f) => f.novelId === novelId);
}

export function toggleFavorite(novel: Novel): boolean {
  const favorites = getFavorites();
  const idx = favorites.findIndex((f) => f.novelId === novel.id);
  if (idx >= 0) {
    favorites.splice(idx, 1);
    safeWrite(FAVORITES_KEY, favorites);
    return false;
  }
  favorites.unshift({
    novelId: novel.id,
    novelSlug: novel.slug,
    novelTitle: novel.title,
    novelCoverHue: novel.coverHue,
    author: novel.author,
    status: novel.status,
    addedAt: Date.now(),
  });
  safeWrite(FAVORITES_KEY, favorites);
  return true;
}

export function removeFavorite(novelId: string): void {
  const favorites = getFavorites().filter((f) => f.novelId !== novelId);
  safeWrite(FAVORITES_KEY, favorites);
}

// ─── Reading Progress ───

export function getReadingProgress(novelId: string, chapterNumber: number): number {
  const all = safeParse<Record<string, number>>(PROGRESS_KEY, {});
  return all[`${novelId}-${chapterNumber}`] ?? 0;
}

export function saveReadingProgress(novelId: string, chapterNumber: number, scrollY: number): void {
  const all = safeParse<Record<string, number>>(PROGRESS_KEY, {});
  all[`${novelId}-${chapterNumber}`] = scrollY;
  safeWrite(PROGRESS_KEY, all);
}

export function clearReadingProgress(novelId: string, chapterNumber: number): void {
  const all = safeParse<Record<string, number>>(PROGRESS_KEY, {});
  delete all[`${novelId}-${chapterNumber}`];
  safeWrite(PROGRESS_KEY, all);
}

// ─── Reader Settings ───

export function getReaderSettings(): ReaderSettings {
  return { ...DEFAULT_SETTINGS, ...safeParse<Partial<ReaderSettings>>(SETTINGS_KEY, {}) };
}

export function saveReaderSettings(settings: ReaderSettings): void {
  safeWrite(SETTINGS_KEY, settings);
}

export function updateReaderSetting<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]): ReaderSettings {
  const settings = { ...getReaderSettings(), [key]: value };
  saveReaderSettings(settings);
  return settings;
}
