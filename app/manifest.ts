import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Akhi - AI Personal Assistant",
    short_name: "AI Assistant",
    description: "Asisten suara pribadi pintar untuk mencatat jadwal dan membuka aplikasi",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}