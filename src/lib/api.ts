import { supabase } from "./supabase";

export type NovelStatus = "Ongoing" | "Completed" | "Hiatus";

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string[];
  publishedAt: string;
  status: "published" | "draft";
  published: boolean;
  publishAt: string | null;
}

export interface Novel {
  id: string;
  slug: string;
  title: string;
  altTitle: string;
  author: string;
  status: NovelStatus;
  genres: string[];
  tags: string[];
  rating: number;
  views: number;
  synopsis: string;
  coverHue: number;
  coverUrl: string | null;
  chapters: Chapter[];
  chapterCount: number;
  latestChapterNumber: number | null;
  latestChapterAt: string | null;
  featured: boolean;
  featuredAt: string | null;
  popular: boolean;
  popularAt: string | null;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface NovelInput {
  title: string;
  altTitle?: string;
  author: string;
  status: NovelStatus;
  synopsis: string;
  coverHue: number;
  coverUrl?: string | null;
  genres: string[];
  tags: string[];
  featured?: boolean;
  popular?: boolean;
}

export interface ChapterInput {
  number: number;
  title: string;
  content: string[];
  publishedAt: string;
  status: "published" | "draft";
  published?: boolean;
  publishAt?: string | null;
}

function nowIso(): string { return new Date().toISOString(); }

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201C",
  rdquo: "\u201D",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  nbsp: "\u00A0",
};

export function decodeEntities(text: string): string {
  if (!text) return "";
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (isNaN(code)) return match;
      return String.fromCodePoint(code);
    }
    return ENTITY_MAP[body] ?? match;
  });
}

interface NovelRow {
  id: string;
  slug: string;
  title: string;
  alt_title: string | null;
  author: string;
  status: string;
  rating: number;
  views: number;
  synopsis: string;
  cover_hue: number;
  cover_url: string | null;
  featured: boolean;
  featured_at: string | null;
  popular: boolean;
  popular_at: string | null;
  novel_genres: { genre: { name: string } }[];
  novel_tags: { tag: { name: string } }[];
}

interface ChapterRow {
  id: string;
  number: number;
  title: string;
  content: string[] | string;
  published_at: string;
  status: string;
  published: boolean;
  publish_at: string | null;
}

interface NovelStats {
  chapterCount: number;
  latestChapterNumber: number | null;
  latestChapterAt: string | null;
}

function mapNovel(row: NovelRow, chapters: Chapter[] = [], stats?: NovelStats): Novel {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    altTitle: row.alt_title ?? "",
    author: row.author,
    status: row.status as NovelStatus,
    genres: row.novel_genres?.map((ng) => ng.genre.name) ?? [],
    tags: row.novel_tags?.map((nt) => nt.tag.name) ?? [],
    rating: Number(row.rating),
    views: Number(row.views),
    synopsis: row.synopsis,
    coverHue: row.cover_hue,
    coverUrl: row.cover_url ?? null,
    chapters,
    chapterCount: stats?.chapterCount ?? chapters.length,
    latestChapterNumber: stats?.latestChapterNumber ?? (chapters.length > 0 ? chapters[chapters.length - 1].number : null),
    latestChapterAt: stats?.latestChapterAt ?? (chapters.length > 0 ? chapters[chapters.length - 1].publishedAt : null),
    featured: row.featured ?? false,
    featuredAt: row.featured_at ?? null,
    popular: row.popular ?? false,
    popularAt: row.popular_at ?? null,
  };
}

function mapChapter(row: ChapterRow): Chapter {
  let content: string[] = [];
  if (Array.isArray(row.content)) {
    content = row.content;
  } else if (typeof row.content === "string") {
    content = row.content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    content,
    publishedAt: row.published_at ?? "",
    status: (row.status as "published" | "draft") ?? "published",
    published: row.published ?? true,
    publishAt: row.publish_at ?? null,
  };
}

const NOVEL_SELECT = `
  id, slug, title, alt_title, author, status, rating, views, synopsis, cover_hue, cover_url,
  featured, featured_at, popular, popular_at,
  novel_genres ( genre:genres ( name ) ),
  novel_tags ( tag:tags ( name ) )
`;

// ---------- Genres ----------

export async function getGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from("genres").select("id, name, slug").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getGenreSlugs(): Promise<string[]> {
  const genres = await getGenres();
  return genres.map((g) => g.name);
}

function getAdminToken(): string {
  const token = localStorage.getItem("addnovel_admin_token");
  if (!token) throw new Error("Not authorized");
  return token;
}

function sanitizeError(e: unknown): Error {
  if (e instanceof Error && (e.message === "Not authorized" || e.message === "Invalid email or password." || e.message === "Too many failed attempts. Please try again later.")) {
    return e;
  }
  return new Error("An unexpected error occurred. Please try again.");
}

export async function createGenre(name: string, slug?: string): Promise<Genre> {
  const finalSlug = (slug ?? slugify(name)).trim();
  if (!finalSlug) throw new Error("Slug is required");
  try {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc("admin_create_genre", {
      p_token: token,
      p_name: name.trim(),
      p_slug: finalSlug,
    });
    if (error) throw error;
    if (!data) throw new Error("Failed to create genre");
    return { id: data.id, name: data.name, slug: data.slug };
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function updateGenre(id: string, name: string, slug: string): Promise<Genre> {
  const finalSlug = slug.trim();
  if (!finalSlug) throw new Error("Slug is required");
  try {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc("admin_update_genre", {
      p_token: token,
      p_id: id,
      p_name: name.trim(),
      p_slug: finalSlug,
    });
    if (error) throw error;
    if (!data) throw new Error("Failed to update genre");
    return { id: data.id, name: data.name, slug: data.slug };
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function deleteGenre(id: string): Promise<void> {
  try {
    const token = getAdminToken();
    const { error } = await supabase.rpc("admin_delete_genre", {
      p_token: token,
      p_id: id,
    });
    if (error) throw error;
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("id, name, slug").order("name");
  if (error) throw sanitizeError(error);
  return data ?? [];
}

// ---------- Novels ----------

export async function autoPublishChapters(): Promise<void> {
  try {
    await supabase.rpc("auto_publish_chapters");
  } catch {
    // Best-effort: don't block page load if RPC fails
  }
}

async function fetchPublishedStats(novelIds: string[]): Promise<Map<string, NovelStats>> {
  const stats = new Map<string, NovelStats>();
  if (novelIds.length === 0) return stats;
  const { data, error } = await supabase
    .from("chapters")
    .select("novel_id, number, published_at")
    .eq("published", true)
    .in("novel_id", novelIds)
    .order("number", { ascending: true });
  if (error) throw error;
  for (const row of data ?? []) {
    const id = row.novel_id as string;
    const existing = stats.get(id);
    if (existing) {
      existing.chapterCount++;
      if ((row.number as number) > (existing.latestChapterNumber ?? 0)) {
        existing.latestChapterNumber = row.number as number;
        existing.latestChapterAt = row.published_at ?? null;
      }
    } else {
      stats.set(id, { chapterCount: 1, latestChapterNumber: row.number as number, latestChapterAt: row.published_at ?? null });
    }
  }
  return stats;
}

async function fetchAllStats(novelIds: string[]): Promise<Map<string, NovelStats>> {
  const stats = new Map<string, NovelStats>();
  if (novelIds.length === 0) return stats;
  const { data, error } = await supabase
    .from("chapters")
    .select("novel_id, number, published_at")
    .in("novel_id", novelIds)
    .order("number", { ascending: true });
  if (error) throw error;
  for (const row of data ?? []) {
    const id = row.novel_id as string;
    const existing = stats.get(id);
    if (existing) {
      existing.chapterCount++;
      if ((row.number as number) > (existing.latestChapterNumber ?? 0)) {
        existing.latestChapterNumber = row.number as number;
        existing.latestChapterAt = row.published_at ?? null;
      }
    } else {
      stats.set(id, { chapterCount: 1, latestChapterNumber: row.number as number, latestChapterAt: row.published_at ?? null });
    }
  }
  return stats;
}

export async function listNovels(): Promise<Novel[]> {
  await autoPublishChapters();
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const stats = await fetchPublishedStats(rows.map((n) => n.id));
  return rows.map((n) => mapNovel(n as unknown as NovelRow, [], stats.get(n.id)));
}

export async function listFeaturedNovels(limit = 6): Promise<Novel[]> {
  await autoPublishChapters();
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("featured", true)
    .order("featured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const stats = await fetchPublishedStats(rows.map((n) => n.id));
  return rows.map((n) => mapNovel(n as unknown as NovelRow, [], stats.get(n.id)));
}

export async function listPopularNovels(limit = 12): Promise<Novel[]> {
  await autoPublishChapters();
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("popular", true)
    .order("popular_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const stats = await fetchPublishedStats(rows.map((n) => n.id));
  return rows.map((n) => mapNovel(n as unknown as NovelRow, [], stats.get(n.id)));
}

export async function getNovel(slug: string): Promise<Novel | null> {
  await autoPublishChapters();
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const chapters = await listChapters(slug);
  const stats = await fetchPublishedStats([data.id]);
  return mapNovel(data as unknown as NovelRow, chapters, stats.get(data.id));
}

export async function getNovelAdmin(slug: string): Promise<Novel | null> {
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const chapters = await listChaptersAdmin(slug);
  const stats = await fetchAllStats([data.id]);
  return mapNovel(data as unknown as NovelRow, chapters, stats.get(data.id));
}

export async function getNovelById(id: string): Promise<Novel | null> {
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const chapters = await listChaptersAdmin(data.slug);
  const stats = await fetchAllStats([data.id]);
  return mapNovel(data as unknown as NovelRow, chapters, stats.get(data.id));
}

export interface NovelFilters {
  query?: string;
  genre?: string;
  status?: NovelStatus | "All";
  sort?: "popular" | "rating" | "latest";
  limit?: number;
  offset?: number;
}

export async function searchNovels(filters: NovelFilters): Promise<{ novels: Novel[]; total: number }> {
  let query = supabase.from("novels").select(NOVEL_SELECT, { count: "exact" });

  if (filters.status && filters.status !== "All") {
    query = query.eq("status", filters.status);
  }

  if (filters.query && filters.query.trim()) {
    const q = filters.query.trim();
    query = query.or(`title.ilike.%${q}%,alt_title.ilike.%${q}%,author.ilike.%${q}%`);
  }

  // Genre filter at the DB level: resolve matching novel IDs first so
  // pagination and count are correct.
  if (filters.genre && filters.genre !== "All") {
    const { data: genreRows } = await supabase
      .from("genres")
      .select("id")
      .eq("name", filters.genre);
    if (genreRows && genreRows.length > 0) {
      const genreId = genreRows[0].id;
      const { data: linkRows } = await supabase
        .from("novel_genres")
        .select("novel_id")
        .eq("genre_id", genreId);
      const novelIds = (linkRows ?? []).map((r) => r.novel_id as string);
      if (novelIds.length === 0) {
        return { novels: [], total: 0 };
      }
      query = query.in("id", novelIds);
    } else {
      return { novels: [], total: 0 };
    }
  }

  const sort = filters.sort ?? "popular";
  if (sort === "popular") query = query.order("views", { ascending: false });
  else if (sort === "rating") query = query.order("rating", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 12) - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const stats = await fetchPublishedStats(rows.map((n) => n.id));
  const novels = rows.map((n) => mapNovel(n as unknown as NovelRow, [], stats.get(n.id)));

  return { novels, total: count ?? novels.length };
}

export async function createNovel(input: NovelInput): Promise<Novel> {
  try {
    const token = getAdminToken();
    const { data, error } = await supabase.rpc("admin_create_novel", {
      p_token: token,
      p_data: {
        title: input.title,
        alt_title: input.altTitle ?? "",
        author: input.author,
        status: input.status,
        synopsis: input.synopsis,
        cover_hue: input.coverHue,
        cover_url: input.coverUrl ?? "",
        genres: input.genres,
        tags: input.tags,
        featured: input.featured ?? false,
        popular: input.popular ?? false,
      } as unknown as Record<string, unknown>,
    });
    if (error) throw error;
    const novel = await getNovel(data.slug);
    if (!novel) throw new Error("Failed to create novel");
    return novel;
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function updateNovel(slug: string, updates: Partial<NovelInput>): Promise<Novel> {
  try {
    const token = getAdminToken();
    const pData: Record<string, unknown> = {};
    if (updates.title !== undefined) pData.title = updates.title;
    if (updates.altTitle !== undefined) pData.alt_title = updates.altTitle || "";
    if (updates.author !== undefined) pData.author = updates.author;
    if (updates.status !== undefined) pData.status = updates.status;
    if (updates.synopsis !== undefined) pData.synopsis = updates.synopsis;
    if (updates.coverHue !== undefined) pData.cover_hue = updates.coverHue;
    if (updates.coverUrl !== undefined) pData.cover_url = updates.coverUrl ?? "";
    if (updates.featured !== undefined) pData.featured = updates.featured;
    if (updates.popular !== undefined) pData.popular = updates.popular;
    if (updates.genres !== undefined) pData.genres = updates.genres;
    if (updates.tags !== undefined) pData.tags = updates.tags;

    const { error } = await supabase.rpc("admin_update_novel", {
      p_token: token,
      p_slug: slug,
      p_data: pData as unknown as Record<string, unknown>,
    });
    if (error) throw error;
    return getNovel(slug) as Promise<Novel>;
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function deleteNovel(slug: string): Promise<void> {
  try {
    const token = getAdminToken();
    const { error } = await supabase.rpc("admin_delete_novel", {
      p_token: token,
      p_slug: slug,
    });
    if (error) throw error;
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function incrementViews(slug: string): Promise<void> {
  try {
    await supabase.rpc("admin_increment_views", { p_slug: slug });
  } catch {
    // Views increment is best-effort; never expose errors to readers
  }
}

// ---------- Chapters ----------

const CHAPTER_SELECT = "id, number, title, content, published_at, status, published, publish_at";

export async function listChapters(novelSlug: string): Promise<Chapter[]> {
  const { data: novel } = await supabase.from("novels").select("id").eq("slug", novelSlug).maybeSingle();
  if (!novel) return [];
  const { data, error } = await supabase
    .from("chapters")
    .select(CHAPTER_SELECT)
    .eq("novel_id", novel.id)
    .eq("published", true)
    .order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapChapter);
}

export async function listChaptersAdmin(novelSlug: string): Promise<Chapter[]> {
  const { data: novel } = await supabase.from("novels").select("id").eq("slug", novelSlug).maybeSingle();
  if (!novel) return [];
  const { data, error } = await supabase
    .from("chapters")
    .select(CHAPTER_SELECT)
    .eq("novel_id", novel.id)
    .order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapChapter);
}

export async function getChapter(novelSlug: string, chapterNumber: number): Promise<{ novel: Novel; chapter: Chapter } | null> {
  const novel = await getNovel(novelSlug);
  if (!novel) return null;
  const chapter = novel.chapters.find((c) => c.number === chapterNumber);
  if (!chapter) return null;
  return { novel, chapter };
}

export async function getChapterAdmin(novelSlug: string, chapterNumber: number): Promise<{ novel: Novel; chapter: Chapter } | null> {
  const novel = await getNovelAdmin(novelSlug);
  if (!novel) return null;
  const chapter = novel.chapters.find((c) => c.number === chapterNumber);
  if (!chapter) return null;
  return { novel, chapter };
}

export async function createChapter(novelSlug: string, input: ChapterInput): Promise<Chapter> {
  try {
    const token = getAdminToken();
    const { error } = await supabase.rpc("admin_create_chapter", {
      p_token: token,
      p_novel_slug: novelSlug,
      p_data: {
        number: input.number,
        title: input.title,
        content: input.content,
        published_at: input.publishedAt,
        status: input.status,
        published: input.published ?? false,
        publish_at: input.publishAt ?? "",
      } as unknown as Record<string, unknown>,
    });
    if (error) throw error;
    const result = await getChapterAdmin(novelSlug, input.number);
    if (!result) throw new Error("Failed to create chapter");
    return result.chapter;
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function updateChapter(novelSlug: string, chapterNumber: number, updates: Partial<ChapterInput>): Promise<Chapter> {
  try {
    const token = getAdminToken();
    const pData: Record<string, unknown> = {};
    if (updates.title !== undefined) pData.title = updates.title;
    if (updates.content !== undefined) pData.content = updates.content;
    if (updates.publishedAt !== undefined) pData.published_at = updates.publishedAt;
    if (updates.number !== undefined) pData.number = updates.number;
    if (updates.status !== undefined) pData.status = updates.status;
    if (updates.published !== undefined) pData.published = updates.published;
    if (updates.publishAt !== undefined) pData.publish_at = updates.publishAt ?? "";

    const { error } = await supabase.rpc("admin_update_chapter", {
      p_token: token,
      p_novel_slug: novelSlug,
      p_chapter_number: chapterNumber,
      p_data: pData as unknown as Record<string, unknown>,
    });
    if (error) throw error;
    const result = await getChapterAdmin(novelSlug, updates.number ?? chapterNumber);
    if (!result) throw new Error("Failed to update chapter");
    return result.chapter;
  } catch (e) {
    throw sanitizeError(e);
  }
}

export async function deleteChapter(novelSlug: string, chapterNumber: number): Promise<void> {
  try {
    const token = getAdminToken();
    const { error } = await supabase.rpc("admin_delete_chapter", {
      p_token: token,
      p_novel_slug: novelSlug,
      p_chapter_number: chapterNumber,
    });
    if (error) throw error;
  } catch (e) {
    throw sanitizeError(e);
  }
}

// ---------- Helpers ----------

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

export function latestUpdateLabel(novel: Novel): string {
  return novel.latestChapterNumber != null ? `Ch. ${novel.latestChapterNumber}` : "—";
}

export function latestUpdateTime(novel: Novel): string {
  return novel.latestChapterAt ?? "—";
}

export async function listNovelsAdmin(): Promise<Novel[]> {
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const stats = await fetchAllStats(rows.map((n) => n.id));
  return rows.map((n) => mapNovel(n as unknown as NovelRow, [], stats.get(n.id)));
}

export async function relatedNovels(novel: Novel, limit = 6): Promise<Novel[]> {
  const all = await listNovels();
  return all
    .filter((n) => n.id !== novel.id && n.genres.some((g) => novel.genres.includes(g)))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
