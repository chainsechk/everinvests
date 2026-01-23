// src/pages/og/blog/[slug].png.ts
// Dynamic OG image for blog posts (PNG for Twitter/Facebook)
import type { APIRoute } from "astro";
import { generateOGImagePNG } from "../../../lib/og";

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
    const png = await generateOGImagePNG({
      title,
      subtitle: "EverInvests Weekly Analysis",
      badge,
      badgeColor: categoryColors[category] || categoryColors.general,
      accentColor: "#00d9ff",
    });

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("OG PNG generation failed:", error);
    // Redirect to SVG fallback
    return Response.redirect(`/og/blog/${slug}.svg`, 302);
  }
};
