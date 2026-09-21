import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CDS untuk Guru",
    short_name: "CDS Guru",
    description: "Character Development System untuk pendampingan perkembangan siswa.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4fbf8",
    theme_color: "#007f5f",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
