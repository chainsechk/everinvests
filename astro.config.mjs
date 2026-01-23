import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://everinvests.com",
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [tailwind()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "zh", "ar", "pt"],
    routing: {
      prefixDefaultLocale: false, // /crypto not /en/crypto
    },
    fallback: {
      es: "en",
      zh: "en",
      ar: "en",
      pt: "en",
    },
  },
});
