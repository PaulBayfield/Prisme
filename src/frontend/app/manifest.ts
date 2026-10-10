import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest (and linked from <head> automatically) -
// this is what makes Prisme installable as a PWA. Deliberately no service
// worker alongside it: browsers no longer need one to offer installation,
// and caching pages for offline use would mean leaving financial data on
// the device outside the session's control.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prisme",
    short_name: "Prisme",
    description: "Personal finance dashboard",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops maskable icons to its own shape (circle, squircle...),
      // so this one has an opaque background and the logo kept inside the
      // central safe zone instead of running edge to edge.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
