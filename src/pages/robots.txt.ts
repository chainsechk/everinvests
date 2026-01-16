// src/pages/robots.txt.ts
import type { APIContext } from "astro";
import { SITE_URL } from "../lib/site";

export async function GET(context: APIContext) {
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
