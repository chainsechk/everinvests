// src/pages/og/blog/[slug].svg.ts
// Dynamic OG image for blog posts
import type { APIRoute } from "astro";
import { generateOGImage } from "../../../lib/og";

const categoryColors: Record<string, string> = {
  crypto: "#f7931a",
  forex: "#3b82f6",
  stocks: "#22c55e",
  general: "#6b7280",
};

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug } = params;

  let title = "EverInvests Blog";
  let category = "general";
  let badge: string | undefined;

  try {
    const db = locals.runtime?.env?.DB;
    if (db && slug) {
      const post = await db
        .prepare(
          `SELECT title, category FROM blog_posts WHERE slug = ? LIMIT 1`
        )
        .bind(slug)
        .first<{ title: string; category: string }>();

      if (post) {
        title = post.title;
        category = post.category || "general";
        badge = category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
  } catch {
    // DB not available, use defaults
  }

  try {
    const svg = await generateOGImage({
      title,
      subtitle: "EverInvests Weekly Analysis",
      badge,
      badgeColor: categoryColors[category] || categoryColors.general,
      accentColor: "#00d9ff",
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("OG image generation failed:", error);
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#0a0a0f"/>
      <text x="600" y="300" text-anchor="middle" font-family="system-ui" font-size="48" font-weight="bold" fill="#ffffff">${title.slice(0, 50)}</text>
    </svg>`;
    return new Response(fallback, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
};
