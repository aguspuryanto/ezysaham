import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EzySaham",
    short_name: "EzySaham",
    description: "Screener, chart, dan portofolio saham Indonesia untuk pemula.",
    start_url: "/",
    display: "standalone",
    background_color: "#14161c",
    theme_color: "#16a34a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
