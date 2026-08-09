interface Env {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

interface NovelRow {
  id: string;
  slug: string;
  updated_at: string | null;
}

interface ChapterRow {
  novel_id: string;
  number: number;
  title: string;
  published_at: string | null;
}

interface GenreRow {
  slug: string;
}

const ORIGIN = "https://addnovel.com";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function xmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

async function supabaseFetch<T>(baseUrl: string, anonKey: string, path: string): Promise<T> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function buildSitemap(baseUrl: string, anonKey: string): Promise<string> {
  const urls: string[] = [];

  urls.push(
    `  <url>\n    <loc>${ORIGIN}/</loc>\n    <lastmod>${today()}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
  );
  urls.push(
    `  <url>\n    <loc>${ORIGIN}/search</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
  );

  for (const p of [
    { path: "/about", freq: "monthly", priority: "0.5" },
    { path: "/contact", freq: "monthly", priority: "0.5" },
    { path: "/privacy", freq: "yearly", priority: "0.4" },
    { path: "/terms", freq: "yearly", priority: "0.4" },
    { path: "/dmca", freq: "yearly", priority: "0.4" },
  ]) {
    urls.push(
      `  <url>\n    <loc>${ORIGIN}${p.path}</loc>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    );
  }

  try {
    const genres = await supabaseFetch<GenreRow[]>(baseUrl, anonKey, `/rest/v1/genres?select=slug`);
    for (const g of genres) {
      urls.push(
        `  <url>\n    <loc>${ORIGIN}/search?genre=${escapeXml(encodeURIComponent(g.slug))}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`
      );
    }
  } catch { /* skip on error */ }

  try {
    const novels = await supabaseFetch<NovelRow[]>(
      baseUrl, anonKey,
      `/rest/v1/novels?select=id,slug,updated_at&order=created_at.asc`
    );
    const novelIds = novels.map((n) => n.id);
    const allChapters: ChapterRow[] = [];
    if (novelIds.length > 0) {
      for (let i = 0; i < novelIds.length; i += 50) {
        const batch = novelIds.slice(i, i + 50);
        const filter = `novel_id=in.(${batch.join(",")})`;
        try {
          const ch = await supabaseFetch<ChapterRow[]>(
            baseUrl, anonKey,
            `/rest/v1/chapters?select=novel_id,number,title,published_at&${filter}&published=eq.true&order=number.asc`
          );
          allChapters.push(...ch);
        } catch { /* skip on error */ }
      }
    }

    for (const n of novels) {
      const lastmod = (n.updated_at ?? today()).split("T")[0];
      urls.push(
        `  <url>\n    <loc>${ORIGIN}/novel/${escapeXml(n.slug)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
      const chapters = allChapters.filter((c) => c.novel_id === n.id);
      for (const c of chapters) {
        const cdate = (c.published_at ?? lastmod).split("T")[0];
        urls.push(
          `  <url>\n    <loc>${ORIGIN}/read/${escapeXml(n.slug)}/${c.number}</loc>\n    <lastmod>${cdate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`
        );
      }
    }
  } catch { /* skip on error — static URLs still emitted */ }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

  if (!baseUrl || !anonKey) {
    return xmlResponse(500, "<!-- sitemap generation failed: missing env -->");
  }

  try {
    const xml = await buildSitemap(baseUrl, anonKey);
    return xmlResponse(200, xml);
  } catch {
    return xmlResponse(500, "<!-- sitemap generation failed -->");
  }
};
