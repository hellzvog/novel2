// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";

// src/lib/sitemap-plugin.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
var SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
var SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
async function supabaseFetch(path) {
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error("Missing Supabase env vars for sitemap");
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`
    }
  });
  if (!res.ok) throw new Error(`Supabase ${path} returned ${res.status}`);
  return res.json();
}
function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function getSiteUrl() {
  const envUrl = process.env.VITE_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "http://localhost:5173";
}
async function buildSitemap() {
  const origin = getSiteUrl();
  const urls = [];
  urls.push(
    `  <url>
    <loc>${origin}/</loc>
    <lastmod>${today()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`
  );
  urls.push(
    `  <url>
    <loc>${origin}/search</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  );
  for (const p of [
    { path: "/about", freq: "monthly", priority: "0.5" },
    { path: "/contact", freq: "monthly", priority: "0.5" },
    { path: "/privacy", freq: "yearly", priority: "0.4" },
    { path: "/terms", freq: "yearly", priority: "0.4" },
    { path: "/dmca", freq: "yearly", priority: "0.4" }
  ]) {
    urls.push(
      `  <url>
    <loc>${origin}${p.path}</loc>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    );
  }
  try {
    const genres = await supabaseFetch(`/rest/v1/genres?select=slug`);
    for (const g of genres) {
      urls.push(
        `  <url>
    <loc>${origin}/search?genre=${escapeXml(encodeURIComponent(g.slug))}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
      );
    }
  } catch {
  }
  try {
    const novels = await supabaseFetch(`/rest/v1/novels?select=id,slug,updated_at&order=created_at.asc`);
    const novelIds = novels.map((n) => n.id);
    const allChapters = [];
    if (novelIds.length > 0) {
      for (let i = 0; i < novelIds.length; i += 50) {
        const batch = novelIds.slice(i, i + 50);
        const filter = `novel_id=in.(${batch.join(",")})`;
        try {
          const ch = await supabaseFetch(
            `/rest/v1/chapters?select=novel_id,number,title,published_at&${filter}&order=number.asc`
          );
          allChapters.push(...ch);
        } catch {
        }
      }
    }
    for (const n of novels) {
      const lastmod = (n.updated_at ?? today()).split("T")[0];
      urls.push(
        `  <url>
    <loc>${origin}/novel/${escapeXml(n.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      );
      const chapters = allChapters.filter((c) => c.novel_id === n.id);
      for (const c of chapters) {
        const cdate = (c.published_at ?? lastmod).split("T")[0];
        urls.push(
          `  <url>
    <loc>${origin}/read/${escapeXml(n.slug)}/${c.number}</loc>
    <lastmod>${cdate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
        );
      }
    }
  } catch {
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}
function buildRobotsTxt() {
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
    ""
  ].join("\n");
}
function sitemapHandler(_req, res) {
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
function sitemapPlugin() {
  return {
    name: "dynamic-sitemap",
    configureServer(server) {
      server.middlewares.use("/sitemap.xml", (req, res) => {
        void sitemapHandler(req, res)();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/sitemap.xml", (req, res) => {
        void sitemapHandler(req, res)();
      });
    },
    async writeBundle(options) {
      const dir = typeof options.dir === "string" ? options.dir : options.output?.dir || "dist";
      const outDir = resolve(dir);
      mkdirSync(outDir, { recursive: true });
      try {
        const xml = await buildSitemap();
        writeFileSync(resolve(outDir, "sitemap.xml"), xml);
        console.log("[sitemap] wrote sitemap.xml");
      } catch (e) {
        console.error(`[sitemap] failed to write sitemap.xml: ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        const robots = buildRobotsTxt();
        writeFileSync(resolve(outDir, "robots.txt"), robots);
        console.log("[sitemap] wrote robots.txt");
      } catch (e) {
        console.error(`[sitemap] failed to write robots.txt: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
}

// vite.config.ts
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [
      react(),
      sitemapPlugin()
    ],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_SITE_URL": JSON.stringify(env.VITE_SITE_URL || "")
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL2xpYi9zaXRlbWFwLXBsdWdpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL3Byb2plY3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvcHJvamVjdC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IHNpdGVtYXBQbHVnaW4gfSBmcm9tICcuL3NyYy9saWIvc2l0ZW1hcC1wbHVnaW4nO1xuXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnVklURV8nKTtcbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgc2l0ZW1hcFBsdWdpbigpLFxuICAgIF0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfU1VQQUJBU0VfVVJMJzogSlNPTi5zdHJpbmdpZnkoZW52LlZJVEVfU1VQQUJBU0VfVVJMKSxcbiAgICAgICdpbXBvcnQubWV0YS5lbnYuVklURV9TVVBBQkFTRV9BTk9OX0tFWSc6IEpTT04uc3RyaW5naWZ5KGVudi5WSVRFX1NVUEFCQVNFX0FOT05fS0VZKSxcbiAgICAgICdpbXBvcnQubWV0YS5lbnYuVklURV9TSVRFX1VSTCc6IEpTT04uc3RyaW5naWZ5KGVudi5WSVRFX1NJVEVfVVJMIHx8ICcnKSxcbiAgICB9LFxuICB9O1xufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL3Byb2plY3Qvc3JjL2xpYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvcHJvamVjdC9zcmMvbGliL3NpdGVtYXAtcGx1Z2luLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvc3JjL2xpYi9zaXRlbWFwLXBsdWdpbi50c1wiO2ltcG9ydCB0eXBlIHsgUGx1Z2luLCBWaXRlRGV2U2VydmVyIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCB7IHdyaXRlRmlsZVN5bmMsIG1rZGlyU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyByZXNvbHZlLCBkaXJuYW1lIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuXG4vKipcbiAqIFZpdGUgcGx1Z2luIHRoYXQgc2VydmVzIGEgZHluYW1pYyAvc2l0ZW1hcC54bWwgYnVpbHQgZnJvbSBsaXZlIFN1cGFiYXNlIGRhdGEuXG4gKlxuICogLSBJbiBkZXYvcHJldmlldyBpdCBydW5zIGFzIG1pZGRsZXdhcmUgc28gdGhlIHNpdGVtYXAgaXMgYWx3YXlzIGZyZXNoLlxuICogLSBBdCBidWlsZCB0aW1lIGl0IGFsc28gd3JpdGVzIHNpdGVtYXAueG1sIGFuZCByb2JvdHMudHh0IGludG8gdGhlIG91dHB1dFxuICogICBkaXJlY3Rvcnkgc28gc3RhdGljIGhvc3RzIChDbG91ZGZsYXJlIFBhZ2VzLCBldGMuKSBjYW4gc2VydmUgdGhlbSBhc1xuICogICByZWFsIGZpbGVzIHdpdGhvdXQgZmFsbGluZyB0aHJvdWdoIHRvIHRoZSBTUEEgY2F0Y2gtYWxsLlxuICovXG5cbmludGVyZmFjZSBQcmV2aWV3U2VydmVyIHtcbiAgbWlkZGxld2FyZXM6IFZpdGVEZXZTZXJ2ZXJbXCJtaWRkbGV3YXJlc1wiXTtcbn1cblxuY29uc3QgU1VQQUJBU0VfVVJMID0gcHJvY2Vzcy5lbnYuVklURV9TVVBBQkFTRV9VUkwgfHwgcHJvY2Vzcy5lbnYuU1VQQUJBU0VfVVJMO1xuY29uc3QgU1VQQUJBU0VfQU5PTiA9IHByb2Nlc3MuZW52LlZJVEVfU1VQQUJBU0VfQU5PTl9LRVkgfHwgcHJvY2Vzcy5lbnYuU1VQQUJBU0VfQU5PTl9LRVk7XG5cbmludGVyZmFjZSBOb3ZlbFJvdyB7IGlkOiBzdHJpbmc7IHNsdWc6IHN0cmluZzsgdXBkYXRlZF9hdDogc3RyaW5nIHwgbnVsbCB9XG5pbnRlcmZhY2UgQ2hhcHRlclJvdyB7IG5vdmVsX2lkOiBzdHJpbmc7IG51bWJlcjogbnVtYmVyOyB0aXRsZTogc3RyaW5nOyBwdWJsaXNoZWRfYXQ6IHN0cmluZyB8IG51bGwgfVxuaW50ZXJmYWNlIEdlbnJlUm93IHsgc2x1Zzogc3RyaW5nIH1cblxuYXN5bmMgZnVuY3Rpb24gc3VwYWJhc2VGZXRjaDxUPihwYXRoOiBzdHJpbmcpOiBQcm9taXNlPFQ+IHtcbiAgaWYgKCFTVVBBQkFTRV9VUkwgfHwgIVNVUEFCQVNFX0FOT04pIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgU3VwYWJhc2UgZW52IHZhcnMgZm9yIHNpdGVtYXBcIik7XG4gIGNvbnN0IHVybCA9IGAke1NVUEFCQVNFX1VSTH0ke3BhdGh9YDtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgaGVhZGVyczoge1xuICAgICAgYXBpa2V5OiBTVVBBQkFTRV9BTk9OLFxuICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke1NVUEFCQVNFX0FOT059YCxcbiAgICB9LFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihgU3VwYWJhc2UgJHtwYXRofSByZXR1cm5lZCAke3Jlcy5zdGF0dXN9YCk7XG4gIHJldHVybiByZXMuanNvbigpIGFzIFByb21pc2U8VD47XG59XG5cbmZ1bmN0aW9uIGVzY2FwZVhtbChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9bPD4mJ1wiXS9nLCAoYykgPT4ge1xuICAgIHN3aXRjaCAoYykge1xuICAgICAgY2FzZSBcIjxcIjogcmV0dXJuIFwiJmx0O1wiO1xuICAgICAgY2FzZSBcIj5cIjogcmV0dXJuIFwiJmd0O1wiO1xuICAgICAgY2FzZSBcIiZcIjogcmV0dXJuIFwiJmFtcDtcIjtcbiAgICAgIGNhc2UgXCInXCI6IHJldHVybiBcIiZhcG9zO1wiO1xuICAgICAgY2FzZSAnXCInOiByZXR1cm4gXCImcXVvdDtcIjtcbiAgICAgIGRlZmF1bHQ6IHJldHVybiBjO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHRvZGF5KCk6IHN0cmluZyB7XG4gIHJldHVybiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoXCJUXCIpWzBdO1xufVxuXG5mdW5jdGlvbiBnZXRTaXRlVXJsKCk6IHN0cmluZyB7XG4gIGNvbnN0IGVudlVybCA9IHByb2Nlc3MuZW52LlZJVEVfU0lURV9VUkwgfHwgcHJvY2Vzcy5lbnYuU0lURV9VUkw7XG4gIGlmIChlbnZVcmwpIHJldHVybiBlbnZVcmwucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xuICByZXR1cm4gXCJodHRwOi8vbG9jYWxob3N0OjUxNzNcIjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVpbGRTaXRlbWFwKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IG9yaWdpbiA9IGdldFNpdGVVcmwoKTtcbiAgY29uc3QgdXJsczogc3RyaW5nW10gPSBbXTtcblxuICAvLyBIb21lcGFnZVxuICB1cmxzLnB1c2goXG4gICAgYCAgPHVybD5cXG4gICAgPGxvYz4ke29yaWdpbn0vPC9sb2M+XFxuICAgIDxsYXN0bW9kPiR7dG9kYXkoKX08L2xhc3Rtb2Q+XFxuICAgIDxjaGFuZ2VmcmVxPmRhaWx5PC9jaGFuZ2VmcmVxPlxcbiAgICA8cHJpb3JpdHk+MS4wPC9wcmlvcml0eT5cXG4gIDwvdXJsPmBcbiAgKTtcblxuICAvLyBTZWFyY2gvQnJvd3NlIHBhZ2VcbiAgdXJscy5wdXNoKFxuICAgIGAgIDx1cmw+XFxuICAgIDxsb2M+JHtvcmlnaW59L3NlYXJjaDwvbG9jPlxcbiAgICA8Y2hhbmdlZnJlcT53ZWVrbHk8L2NoYW5nZWZyZXE+XFxuICAgIDxwcmlvcml0eT4wLjc8L3ByaW9yaXR5PlxcbiAgPC91cmw+YFxuICApO1xuXG4gIC8vIFN0YXRpYyB0cnVzdC9jb21wbGlhbmNlIHBhZ2VzXG4gIGZvciAoY29uc3QgcCBvZiBbXG4gICAgeyBwYXRoOiBcIi9hYm91dFwiLCBmcmVxOiBcIm1vbnRobHlcIiwgcHJpb3JpdHk6IFwiMC41XCIgfSxcbiAgICB7IHBhdGg6IFwiL2NvbnRhY3RcIiwgZnJlcTogXCJtb250aGx5XCIsIHByaW9yaXR5OiBcIjAuNVwiIH0sXG4gICAgeyBwYXRoOiBcIi9wcml2YWN5XCIsIGZyZXE6IFwieWVhcmx5XCIsIHByaW9yaXR5OiBcIjAuNFwiIH0sXG4gICAgeyBwYXRoOiBcIi90ZXJtc1wiLCBmcmVxOiBcInllYXJseVwiLCBwcmlvcml0eTogXCIwLjRcIiB9LFxuICAgIHsgcGF0aDogXCIvZG1jYVwiLCBmcmVxOiBcInllYXJseVwiLCBwcmlvcml0eTogXCIwLjRcIiB9LFxuICBdKSB7XG4gICAgdXJscy5wdXNoKFxuICAgICAgYCAgPHVybD5cXG4gICAgPGxvYz4ke29yaWdpbn0ke3AucGF0aH08L2xvYz5cXG4gICAgPGNoYW5nZWZyZXE+JHtwLmZyZXF9PC9jaGFuZ2VmcmVxPlxcbiAgICA8cHJpb3JpdHk+JHtwLnByaW9yaXR5fTwvcHJpb3JpdHk+XFxuICA8L3VybD5gXG4gICAgKTtcbiAgfVxuXG4gIC8vIEdlbnJlc1xuICB0cnkge1xuICAgIGNvbnN0IGdlbnJlcyA9IGF3YWl0IHN1cGFiYXNlRmV0Y2g8R2VucmVSb3dbXT4oYC9yZXN0L3YxL2dlbnJlcz9zZWxlY3Q9c2x1Z2ApO1xuICAgIGZvciAoY29uc3QgZyBvZiBnZW5yZXMpIHtcbiAgICAgIHVybHMucHVzaChcbiAgICAgICAgYCAgPHVybD5cXG4gICAgPGxvYz4ke29yaWdpbn0vc2VhcmNoP2dlbnJlPSR7ZXNjYXBlWG1sKGVuY29kZVVSSUNvbXBvbmVudChnLnNsdWcpKX08L2xvYz5cXG4gICAgPGNoYW5nZWZyZXE+d2Vla2x5PC9jaGFuZ2VmcmVxPlxcbiAgICA8cHJpb3JpdHk+MC42PC9wcmlvcml0eT5cXG4gIDwvdXJsPmBcbiAgICAgICk7XG4gICAgfVxuICB9IGNhdGNoIHsgLyogc2tpcCBvbiBlcnJvciAqLyB9XG5cbiAgLy8gTm92ZWxzICsgY2hhcHRlcnNcbiAgdHJ5IHtcbiAgICBjb25zdCBub3ZlbHMgPSBhd2FpdCBzdXBhYmFzZUZldGNoPE5vdmVsUm93W10+KGAvcmVzdC92MS9ub3ZlbHM/c2VsZWN0PWlkLHNsdWcsdXBkYXRlZF9hdCZvcmRlcj1jcmVhdGVkX2F0LmFzY2ApO1xuICAgIGNvbnN0IG5vdmVsSWRzID0gbm92ZWxzLm1hcCgobikgPT4gbi5pZCk7XG4gICAgY29uc3QgYWxsQ2hhcHRlcnM6IENoYXB0ZXJSb3dbXSA9IFtdO1xuICAgIGlmIChub3ZlbElkcy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vdmVsSWRzLmxlbmd0aDsgaSArPSA1MCkge1xuICAgICAgICBjb25zdCBiYXRjaCA9IG5vdmVsSWRzLnNsaWNlKGksIGkgKyA1MCk7XG4gICAgICAgIGNvbnN0IGZpbHRlciA9IGBub3ZlbF9pZD1pbi4oJHtiYXRjaC5qb2luKFwiLFwiKX0pYDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjaCA9IGF3YWl0IHN1cGFiYXNlRmV0Y2g8Q2hhcHRlclJvd1tdPihcbiAgICAgICAgICAgIGAvcmVzdC92MS9jaGFwdGVycz9zZWxlY3Q9bm92ZWxfaWQsbnVtYmVyLHRpdGxlLHB1Ymxpc2hlZF9hdCYke2ZpbHRlcn0mb3JkZXI9bnVtYmVyLmFzY2BcbiAgICAgICAgICApO1xuICAgICAgICAgIGFsbENoYXB0ZXJzLnB1c2goLi4uY2gpO1xuICAgICAgICB9IGNhdGNoIHsgLyogc2tpcCBvbiBlcnJvciAqLyB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBuIG9mIG5vdmVscykge1xuICAgICAgY29uc3QgbGFzdG1vZCA9IChuLnVwZGF0ZWRfYXQgPz8gdG9kYXkoKSkuc3BsaXQoXCJUXCIpWzBdO1xuICAgICAgdXJscy5wdXNoKFxuICAgICAgICBgICA8dXJsPlxcbiAgICA8bG9jPiR7b3JpZ2lufS9ub3ZlbC8ke2VzY2FwZVhtbChuLnNsdWcpfTwvbG9jPlxcbiAgICA8bGFzdG1vZD4ke2xhc3Rtb2R9PC9sYXN0bW9kPlxcbiAgICA8Y2hhbmdlZnJlcT53ZWVrbHk8L2NoYW5nZWZyZXE+XFxuICAgIDxwcmlvcml0eT4wLjg8L3ByaW9yaXR5PlxcbiAgPC91cmw+YFxuICAgICAgKTtcblxuICAgICAgY29uc3QgY2hhcHRlcnMgPSBhbGxDaGFwdGVycy5maWx0ZXIoKGMpID0+IGMubm92ZWxfaWQgPT09IG4uaWQpO1xuICAgICAgZm9yIChjb25zdCBjIG9mIGNoYXB0ZXJzKSB7XG4gICAgICAgIGNvbnN0IGNkYXRlID0gKGMucHVibGlzaGVkX2F0ID8/IGxhc3Rtb2QpLnNwbGl0KFwiVFwiKVswXTtcbiAgICAgICAgdXJscy5wdXNoKFxuICAgICAgICAgIGAgIDx1cmw+XFxuICAgIDxsb2M+JHtvcmlnaW59L3JlYWQvJHtlc2NhcGVYbWwobi5zbHVnKX0vJHtjLm51bWJlcn08L2xvYz5cXG4gICAgPGxhc3Rtb2Q+JHtjZGF0ZX08L2xhc3Rtb2Q+XFxuICAgIDxjaGFuZ2VmcmVxPm1vbnRobHk8L2NoYW5nZWZyZXE+XFxuICAgIDxwcmlvcml0eT4wLjU8L3ByaW9yaXR5PlxcbiAgPC91cmw+YFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCB7IC8qIHNraXAgb24gZXJyb3IgXHUyMDE0IHN0YXRpYyBVUkxzIHN0aWxsIGVtaXR0ZWQgKi8gfVxuXG4gIHJldHVybiBgPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+XFxuPHVybHNldCB4bWxucz1cImh0dHA6Ly93d3cuc2l0ZW1hcHMub3JnL3NjaGVtYXMvc2l0ZW1hcC8wLjlcIj5cXG4ke3VybHMuam9pbihcIlxcblwiKX1cXG48L3VybHNldD5cXG5gO1xufVxuXG5mdW5jdGlvbiBidWlsZFJvYm90c1R4dCgpOiBzdHJpbmcge1xuICBjb25zdCBvcmlnaW4gPSBnZXRTaXRlVXJsKCk7XG4gIHJldHVybiBbXG4gICAgXCJVc2VyLWFnZW50OiAqXCIsXG4gICAgXCJBbGxvdzogL1wiLFxuICAgIFwiQWxsb3c6IC9ub3ZlbC9cIixcbiAgICBcIkFsbG93OiAvcmVhZC9cIixcbiAgICBcIkFsbG93OiAvc2VhcmNoXCIsXG4gICAgXCJBbGxvdzogL2Fib3V0XCIsXG4gICAgXCJBbGxvdzogL2NvbnRhY3RcIixcbiAgICBcIkFsbG93OiAvcHJpdmFjeVwiLFxuICAgIFwiQWxsb3c6IC90ZXJtc1wiLFxuICAgIFwiQWxsb3c6IC9kbWNhXCIsXG4gICAgXCJEaXNhbGxvdzogL2FkbWluXCIsXG4gICAgXCJEaXNhbGxvdzogL2FkbWluL1wiLFxuICAgIFwiRGlzYWxsb3c6IC9mYXZvcml0ZXNcIixcbiAgICBcIlwiLFxuICAgIGBTaXRlbWFwOiAke29yaWdpbn0vc2l0ZW1hcC54bWxgLFxuICAgIFwiXCIsXG4gIF0uam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gc2l0ZW1hcEhhbmRsZXIoX3JlcTogdW5rbm93biwgcmVzOiB7IHNldEhlYWRlcjogKGs6IHN0cmluZywgdjogc3RyaW5nKSA9PiB2b2lkOyBlbmQ6IChzOiBzdHJpbmcpID0+IHZvaWQ7IHN0YXR1c0NvZGU6IG51bWJlciB9KSB7XG4gIHJldHVybiBhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHhtbCA9IGF3YWl0IGJ1aWxkU2l0ZW1hcCgpO1xuICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL3htbDsgY2hhcnNldD11dGYtOFwiKTtcbiAgICAgIHJlcy5lbmQoeG1sKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBbc2l0ZW1hcF0gJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YCk7XG4gICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcbiAgICAgIHJlcy5lbmQoXCI8IS0tIHNpdGVtYXAgZ2VuZXJhdGlvbiBmYWlsZWQgLS0+XCIpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpdGVtYXBQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcImR5bmFtaWMtc2l0ZW1hcFwiLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoXCIvc2l0ZW1hcC54bWxcIiwgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIHZvaWQgc2l0ZW1hcEhhbmRsZXIocmVxLCByZXMpKCk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyOiBQcmV2aWV3U2VydmVyKSB7XG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL3NpdGVtYXAueG1sXCIsIChyZXEsIHJlcykgPT4ge1xuICAgICAgICB2b2lkIHNpdGVtYXBIYW5kbGVyKHJlcSwgcmVzKSgpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBhc3luYyB3cml0ZUJ1bmRsZShvcHRpb25zKSB7XG4gICAgICBjb25zdCBkaXIgPSB0eXBlb2Ygb3B0aW9ucy5kaXIgPT09IFwic3RyaW5nXCIgPyBvcHRpb25zLmRpciA6IChvcHRpb25zIGFzIHsgb3V0cHV0PzogeyBkaXI/OiBzdHJpbmcgfSB9KS5vdXRwdXQ/LmRpciB8fCBcImRpc3RcIjtcbiAgICAgIGNvbnN0IG91dERpciA9IHJlc29sdmUoZGlyKTtcbiAgICAgIG1rZGlyU3luYyhvdXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAvLyBXcml0ZSBzaXRlbWFwLnhtbCBhcyBhIHN0YXRpYyBmaWxlIGZvciBwcm9kdWN0aW9uIGhvc3RzLlxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeG1sID0gYXdhaXQgYnVpbGRTaXRlbWFwKCk7XG4gICAgICAgIHdyaXRlRmlsZVN5bmMocmVzb2x2ZShvdXREaXIsIFwic2l0ZW1hcC54bWxcIiksIHhtbCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiW3NpdGVtYXBdIHdyb3RlIHNpdGVtYXAueG1sXCIpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBbc2l0ZW1hcF0gZmFpbGVkIHRvIHdyaXRlIHNpdGVtYXAueG1sOiAke2UgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKX1gKTtcbiAgICAgIH1cblxuICAgICAgLy8gV3JpdGUgcm9ib3RzLnR4dCB3aXRoIGFic29sdXRlIHNpdGVtYXAgVVJMIGZyb20gVklURV9TSVRFX1VSTC5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJvYm90cyA9IGJ1aWxkUm9ib3RzVHh0KCk7XG4gICAgICAgIHdyaXRlRmlsZVN5bmMocmVzb2x2ZShvdXREaXIsIFwicm9ib3RzLnR4dFwiKSwgcm9ib3RzKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJbc2l0ZW1hcF0gd3JvdGUgcm9ib3RzLnR4dFwiKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgW3NpdGVtYXBdIGZhaWxlZCB0byB3cml0ZSByb2JvdHMudHh0OiAke2UgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKX1gKTtcbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLGNBQWMsZUFBZTtBQUMv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
