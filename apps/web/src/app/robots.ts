import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/history", "/settings", "/meetings", "/desktop/", "/signin", "/signup", "/verify", "/forgot", "/reset"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
