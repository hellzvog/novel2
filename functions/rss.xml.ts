interface Env {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
}

interface NovelRow {
  id: string;
  slug: string;
  title: string;
}

interface ChapterRow {
  novel_id: string;
  number: number;
  title: string;
  published_at: string | null;
  publish_at: string | null;
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

function toRfc822(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

function rssResponse(status: number, body: string): Response {
  const headers = new Headers({
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
    "Strict-Transport-Security":
      "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  return new Response(body, { status, headers });
}

async function supabaseFetch<T>(
  baseUrl: string,
  anonKey: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  return res.json() as Promise<T>;
}

function emptyFeed(): string {
  const buildDate = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AddNovel - Latest Updates</title>
    <link>${ORIGIN}</link>
    <description>Latest published novel chapters on AddNovel.</description>
    <language>en</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
  </channel>
</rss>
`;
}

async function buildFeed(baseUrl: string, anonKey: string): Promise<string> {
  const novels = await supabaseFetch<NovelRow[]>(
    baseUrl,
    anonKey,
    `/rest/v1/novels?select=id,slug,title`,
  );
  if (!novels || novels.length === 0) return emptyFeed();

  const novelMap = new Map(novels.map((n) => [n.id, n]));

  const chapters = await supabaseFetch<ChapterRow[]>(
    baseUrl,
    anonKey,
    `/rest/v1/chapters?select=novel_id,number,title,published_at,publish_at&published=eq.true&order=published_at.desc&limit=50`,
  );
  if (!chapters || chapters.length === 0) return emptyFeed();

  // Secondary sort: within the same published_at date, newer publish_at first.
  // Legacy rows with null publish_at sort last within their date group.
  const sorted = [...chapters].sort((a, b) => {
    if (a.published_at !== b.published_at) return 0;
    const pa = a.publish_at ? new Date(a.publish_at).getTime() : 0;
    const pb = b.publish_at ? new Date(b.publish_at).getTime() : 0;
    return pb - pa;
  });

  const items: string[] = [];
  for (const ch of sorted) {
    const novel = novelMap.get(ch.novel_id);
    if (!novel) continue;

    const dateStr = ch.publish_at ?? ch.published_at;
    if (!dateStr) continue;

    const itemTitle = `${novel.title} - Chapter ${ch.number}: ${ch.title}`;
    const itemLink = `${ORIGIN}/read/${encodeURIComponent(novel.slug)}/${ch.number}`;
    const itemDesc = `Read ${novel.title} Chapter ${ch.number} on AddNovel.`;
    const pubDate = toRfc822(dateStr);

    items.push(
      `    <item>
      <title>${escapeXml(itemTitle)}</title>
      <link>${escapeXml(itemLink)}</link>
      <guid isPermaLink="true">${escapeXml(itemLink)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(itemDesc)}</description>
    </item>`,
    );
  }

  const buildDate = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AddNovel - Latest Updates</title>
    <link>${ORIGIN}</link>
    <description>Latest published novel chapters on AddNovel.</description>
    <language>en</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>
`;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

  if (!baseUrl || !anonKey) {
    return rssResponse(200, emptyFeed());
  }

  try {
    const xml = await buildFeed(baseUrl, anonKey);
    return rssResponse(200, xml);
  } catch {
    return rssResponse(200, emptyFeed());
  }
};
