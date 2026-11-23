import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alfarizi — AI Personal Assistant",
    short_name: "Alfarizi AI",
    description: "AI Pribadi • Istiqomah di Atas Manhaj Salaf",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}