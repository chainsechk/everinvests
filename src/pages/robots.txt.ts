// src/pages/robots.txt.ts
import type { APIContext } from "astro";

const siteUrl = "https://everinvests.pages.dev";

export async function GET(context: APIContext) {
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
