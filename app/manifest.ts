import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shelf Pick",
    short_name: "Shelf Pick",
    description:
      "Photograph a bookshelf and rank what's actually in front of you, using your Goodreads taste.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3E6D0",
    theme_color: "#7A2E2E",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
