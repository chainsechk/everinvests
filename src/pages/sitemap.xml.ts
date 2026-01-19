// src/pages/sitemap.xml.ts
import type { APIContext } from "astro";
import { SITE_URL } from "../lib/site";

interface BlogPost {
  slug: string;
  published_at: string;
}

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "hourly" },
  { url: "/crypto", priority: "0.9", changefreq: "hourly" },
  { url: "/forex", priority: "0.9", changefreq: "hourly" },
  { url: "/stocks", priority: "0.9", changefreq: "hourly" },
  { url: "/crypto/history", priority: "0.7", changefreq: "daily" },
  { url: "/forex/history", priority: "0.7", changefreq: "daily" },
  { url: "/stocks/history", priority: "0.7", changefreq: "daily" },
  { url: "/blog", priority: "0.8", changefreq: "daily" },
  { url: "/about", priority: "0.5", changefreq: "monthly" },
];

export async function GET(context: APIContext) {
  const today = new Date().toISOString().split("T")[0];
  const db = context.locals.runtime.env.DB;

  // Fetch all blog posts for dynamic URLs
  let blogPosts: BlogPost[] = [];
  try {
    const result = await db.prepare(
      "SELECT slug, published_at FROM blog_posts ORDER BY published_at DESC LIMIT 100"
    ).all<BlogPost>();
    blogPosts = result.results || [];
  } catch (e) {
    // Blog table may not exist yet
  }

  const staticUrls = staticPages.map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  );

  const blogUrls = blogPosts.map(
    (post) => `  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${post.published_at.split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...blogUrls].join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
