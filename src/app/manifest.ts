import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PREP",
    short_name: "PREP",
    description: "Parents' Routine & Errands Planner",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0F14",
    theme_color: "#0A0F14",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
