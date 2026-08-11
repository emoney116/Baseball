import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "./lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d0f",
    theme_color: "#a70e1a",
    icons: [
      {
        src: "/brand/clubhouse9-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/clubhouse9-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
