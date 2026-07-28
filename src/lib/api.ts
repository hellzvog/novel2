import { supabase } from "./supabase";

export type NovelStatus = "Ongoing" | "Completed" | "Hiatus";

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string[];
  publishedAt: string;
  status: "published" | "draft";
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
}

export interface ChapterInput {
  number: number;
  title: string;
  content: string[];
  publishedAt: string;
  status: "published" | "draft";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
}

function mapNovel(row: NovelRow, chapters: Chapter[] = []): Novel {
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
  };
}

const NOVEL_SELECT = `
  id, slug, title, alt_title, author, status, rating, views, synopsis, cover_hue, cover_url,
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

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("id, name, slug").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function ensureTags(names: string[]): Promise<void> {
  for (const name of names) {
    const slug = slugify(name);
    await supabase.from("tags").upsert({ name, slug }, { onConflict: "slug" });
  }
}

// ---------- Novels ----------

export async function listNovels(): Promise<Novel[]> {
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n) => mapNovel(n as unknown as NovelRow));
}

export async function getNovel(slug: string): Promise<Novel | null> {
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const chapters = await listChapters(slug);
  return mapNovel(data as unknown as NovelRow, chapters);
}

export async function getNovelById(id: string): Promise<Novel | null> {
  const { data, error } = await supabase
    .from("novels")
    .select(NOVEL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const chapters = await listChapters(data.slug);
  return mapNovel(data as unknown as NovelRow, chapters);
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

  const novels = (data ?? []).map((n) => mapNovel(n as unknown as NovelRow));

  return { novels, total: count ?? novels.length };
}

export async function createNovel(input: NovelInput): Promise<Novel> {
  const slug = slugify(input.title) + "-" + Math.random().toString(36).slice(2, 6);
  const { data, error } = await supabase
    .from("novels")
    .insert({
      slug,
      title: input.title,
      alt_title: input.altTitle ?? null,
      author: input.author,
      status: input.status,
      synopsis: input.synopsis,
      cover_hue: input.coverHue,
      cover_url: input.coverUrl ?? null,
    })
    .select(NOVEL_SELECT)
    .single();
  if (error) throw error;

  // Link genres
  if (input.genres.length > 0) {
    const { data: genreRows } = await supabase.from("genres").select("id").in("name", input.genres);
    if (genreRows && genreRows.length > 0) {
      const links = genreRows.map((g) => ({ novel_id: data.id, genre_id: g.id }));
      await supabase.from("novel_genres").insert(links);
    }
  }

  // Link tags
  if (input.tags.length > 0) {
    await ensureTags(input.tags);
    const { data: tagRows } = await supabase.from("tags").select("id").in("name", input.tags);
    if (tagRows && tagRows.length > 0) {
      const links = tagRows.map((t) => ({ novel_id: data.id, tag_id: t.id }));
      await supabase.from("novel_tags").insert(links);
    }
  }

  return mapNovel(data as unknown as NovelRow);
}

export async function updateNovel(slug: string, updates: Partial<NovelInput>): Promise<Novel> {
  const existing = await getNovel(slug);
  if (!existing) throw new Error("Novel not found");

  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.altTitle !== undefined) updateData.alt_title = updates.altTitle || null;
  if (updates.author !== undefined) updateData.author = updates.author;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.synopsis !== undefined) updateData.synopsis = updates.synopsis;
  if (updates.coverHue !== undefined) updateData.cover_hue = updates.coverHue;
  if (updates.coverUrl !== undefined) updateData.cover_url = updates.coverUrl;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase.from("novels").update(updateData).eq("slug", slug);
    if (error) throw error;
  }

  if (updates.genres !== undefined) {
    await supabase.from("novel_genres").delete().eq("novel_id", existing.id);
    if (updates.genres.length > 0) {
      const { data: genreRows } = await supabase.from("genres").select("id").in("name", updates.genres);
      if (genreRows && genreRows.length > 0) {
        const links = genreRows.map((g) => ({ novel_id: existing.id, genre_id: g.id }));
        await supabase.from("novel_genres").insert(links);
      }
    }
  }

  if (updates.tags !== undefined) {
    await supabase.from("novel_tags").delete().eq("novel_id", existing.id);
    if (updates.tags.length > 0) {
      await ensureTags(updates.tags);
      const { data: tagRows } = await supabase.from("tags").select("id").in("name", updates.tags);
      if (tagRows && tagRows.length > 0) {
        const links = tagRows.map((t) => ({ novel_id: existing.id, tag_id: t.id }));
        await supabase.from("novel_tags").insert(links);
      }
    }
  }

  return getNovel(slug) as Promise<Novel>;
}

export async function deleteNovel(slug: string): Promise<void> {
  const { error } = await supabase.from("novels").delete().eq("slug", slug);
  if (error) throw error;
}

export async function incrementViews(slug: string): Promise<void> {
  const { data } = await supabase.from("novels").select("views").eq("slug", slug).maybeSingle();
  if (data) {
    await supabase.from("novels").update({ views: data.views + 1 }).eq("slug", slug);
  }
}

// ---------- Chapters ----------

export async function listChapters(novelSlug: string): Promise<Chapter[]> {
  const { data: novel } = await supabase.from("novels").select("id").eq("slug", novelSlug).maybeSingle();
  if (!novel) return [];
  const { data, error } = await supabase
    .from("chapters")
    .select("id, number, title, content, published_at, status")
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

export async function createChapter(novelSlug: string, input: ChapterInput): Promise<Chapter> {
  const { data: novel } = await supabase.from("novels").select("id").eq("slug", novelSlug).maybeSingle();
  if (!novel) throw new Error("Novel not found");
  const { data, error } = await supabase
    .from("chapters")
    .insert({
      novel_id: novel.id,
      number: input.number,
      title: input.title,
      content: input.content,
      published_at: input.publishedAt,
      status: input.status,
    })
    .select("id, number, title, content, published_at, status")
    .single();
  if (error) throw error;
  return mapChapter(data as ChapterRow);
}

export async function updateChapter(novelSlug: string, chapterNumber: number, updates: Partial<ChapterInput>): Promise<Chapter> {
  const { data: novel } = await supabase.from("novels").select("id").eq("slug", novelSlug).maybeSingle();
  if (!novel) throw new Error("Novel not found");
  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt;
  if (updates.number !== undefined) updateData.number = updates.number;
  if (updates.status !== undefined) updateData.status = updates.status;
  const { data, error } = await supabase
    .from("chapters")
    .update(updateData)
    .eq("novel_id", novel.id)
    .eq("number", chapterNumber)
    .select("id, number, title, content, published_at, status")
    .single();
  if (error) throw error;
  return mapChapter(data as ChapterRow);
}

export async function deleteChapter(novelSlug: string, chapterNumber: number): Promise<void> {
  const { data: novel } = await supabase.from("novels").select("id").eq("slug", novelSlug).maybeSingle();
  if (!novel) throw new Error("Novel not found");
  const { error } = await supabase.from("chapters").delete().eq("novel_id", novel.id).eq("number", chapterNumber);
  if (error) throw error;
}

// ---------- Helpers ----------

export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

export function latestUpdateLabel(novel: Novel): string {
  const last = novel.chapters[novel.chapters.length - 1];
  return last ? `Ch. ${last.number}` : "—";
}

export async function relatedNovels(novel: Novel, limit = 6): Promise<Novel[]> {
  const all = await listNovels();
  return all
    .filter((n) => n.id !== novel.id && n.genres.some((g) => novel.genres.includes(g)))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
