import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PREP",
    short_name: "PREP",
    description: "Parents' Routine & Errands Planner",
    start_url: "/",
    display: "standalone",
    background_color: BRAND.lightBg,
    theme_color: BRAND.indigo,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
