import type { Plugin, ViteDevServer } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * Vite plugin that serves a dynamic /sitemap.xml built from live Supabase data.
 *
 * - In dev/preview it runs as middleware so the sitemap is always fresh.
 * - At build time it also writes sitemap.xml and robots.txt into the output
 *   directory so static hosts (Cloudflare Pages, etc.) can serve them as
 *   real files without falling through to the SPA catch-all.
 */

interface PreviewServer {
  middlewares: ViteDevServer["middlewares"];
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

interface NovelRow { id: string; slug: string; updated_at: string | null }
interface ChapterRow { novel_id: string; number: number; title: string; published_at: string | null }
interface GenreRow { slug: string }

async function supabaseFetch<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error("Missing Supabase env vars for sitemap");
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

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

function getSiteUrl(): string {
  const envUrl = process.env.VITE_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "http://localhost:5173";
}

async function buildSitemap(): Promise<string> {
  const origin = getSiteUrl();
  const urls: string[] = [];

  // Homepage
  urls.push(
    `  <url>\n    <loc>${origin}/</loc>\n    <lastmod>${today()}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
  );

  // Search/Browse page
  urls.push(
    `  <url>\n    <loc>${origin}/search</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`
  );

  // Latest updates page
  urls.push(
    `  <url>\n    <loc>${origin}/latest</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.9</priority>\n  </url>`
  );

  // Static trust/compliance pages
  for (const p of [
    { path: "/about", freq: "monthly", priority: "0.5" },
    { path: "/contact", freq: "monthly", priority: "0.5" },
    { path: "/privacy", freq: "yearly", priority: "0.4" },
    { path: "/terms", freq: "yearly", priority: "0.4" },
    { path: "/dmca", freq: "yearly", priority: "0.4" },
  ]) {
    urls.push(
      `  <url>\n    <loc>${origin}${p.path}</loc>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    );
  }

  // Genres
  try {
    const genres = await supabaseFetch<GenreRow[]>(`/rest/v1/genres?select=slug`);
    for (const g of genres) {
      urls.push(
        `  <url>\n    <loc>${origin}/genre/${escapeXml(g.slug)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`
      );
    }
  } catch { /* skip on error */ }

  // Novels + chapters
  try {
    const novels = await supabaseFetch<NovelRow[]>(`/rest/v1/novels?select=id,slug,updated_at&order=created_at.asc`);
    const novelIds = novels.map((n) => n.id);
    const allChapters: ChapterRow[] = [];
    if (novelIds.length > 0) {
      for (let i = 0; i < novelIds.length; i += 50) {
        const batch = novelIds.slice(i, i + 50);
        const filter = `novel_id=in.(${batch.join(",")})`;
        try {
          const ch = await supabaseFetch<ChapterRow[]>(
            `/rest/v1/chapters?select=novel_id,number,title,published_at&${filter}&published=eq.true&order=number.asc`
          );
          allChapters.push(...ch);
        } catch { /* skip on error */ }
      }
    }

    for (const n of novels) {
      const lastmod = (n.updated_at ?? today()).split("T")[0];
      urls.push(
        `  <url>\n    <loc>${origin}/novel/${escapeXml(n.slug)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );

      const chapters = allChapters.filter((c) => c.novel_id === n.id);
      for (const c of chapters) {
        const cdate = (c.published_at ?? lastmod).split("T")[0];
        urls.push(
          `  <url>\n    <loc>${origin}/read/${escapeXml(n.slug)}/${c.number}</loc>\n    <lastmod>${cdate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`
        );
      }
    }
  } catch { /* skip on error — static URLs still emitted */ }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function buildRobotsTxt(): string {
  const origin = getSiteUrl();
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /novel/",
    "Allow: /read/",
    "Allow: /search",
    "Allow: /about",
    "Allow: /contact",
    "Allow: /privacy",
    "Allow: /terms",
    "Allow: /dmca",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /favorites",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

function sitemapHandler(_req: unknown, res: { setHeader: (k: string, v: string) => void; end: (s: string) => void; statusCode: number }) {
  return async () => {
    try {
      const xml = await buildSitemap();
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.end(xml);
    } catch (e) {
      console.error(`[sitemap] ${e instanceof Error ? e.message : String(e)}`);
      res.statusCode = 500;
      res.end("<!-- sitemap generation failed -->");
    }
  };
}

export function sitemapPlugin(): Plugin {
  return {
    name: "dynamic-sitemap",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/sitemap.xml", (req, res) => {
        void sitemapHandler(req, res)();
      });
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use("/sitemap.xml", (req, res) => {
        void sitemapHandler(req, res)();
      });
    },
    async writeBundle(options) {
      const dir = typeof options.dir === "string" ? options.dir : (options as { output?: { dir?: string } }).output?.dir || "dist";
      const outDir = resolve(dir);
      mkdirSync(outDir, { recursive: true });

      // sitemap.xml is now served dynamically by the Cloudflare Pages Function
      // at /functions/sitemap.xml.ts — do NOT write a static file here, otherwise
      // it would shadow the dynamic route and go stale until the next deploy.

      // Write robots.txt with absolute sitemap URL from VITE_SITE_URL.
      try {
        const robots = buildRobotsTxt();
        writeFileSync(resolve(outDir, "robots.txt"), robots);
        console.log("[sitemap] wrote robots.txt");
      } catch (e) {
        console.error(`[sitemap] failed to write robots.txt: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  };
}
