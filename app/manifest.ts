import type { MetadataRoute } from "next";

/**
 * Web app manifest: makes the site installable from Chrome ("Add to Home screen")
 * and supplies the name/colours the Android app (native/) mirrors.
 *
 * Icons: "any" for the launcher/install dialog, "maskable" with a safe margin so
 * Android can crop it to a circle/squircle without cutting the logo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CDS untuk Guru",
    short_name: "CDS Guru",
    description: "Character Development System untuk pendampingan perkembangan siswa.",
    lang: "id",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4fbf8",
    theme_color: "#007f5f",
    categories: ["education", "productivity"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
