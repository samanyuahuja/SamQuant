import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SamQuant",
    short_name: "SamQuant",
    description: "Transparent backtesting and quantitative research software.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1efe8",
    theme_color: "#171a18",
    icons: [
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
