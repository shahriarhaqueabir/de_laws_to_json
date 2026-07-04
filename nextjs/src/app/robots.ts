import type { MetadataRoute } from "next";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/chat", "/guidance", "/laws/"],
        disallow: [
          "/api/",
          "/auth/",
          "/oauth/",
          "/settings/",
          "/bookmarks/",
          "/api-docs/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
