import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mikke Mus",
    short_name: "Mikke Mus",
    description: "Dartsapp for Mikke Mus",
    start_url: "/",
    display: "standalone",
    background_color: "#11160f",
    theme_color: "#11160f",
    icons: [
      { src: "/pwa-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
