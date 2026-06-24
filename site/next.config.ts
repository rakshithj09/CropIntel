import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export → emits an `out/` folder of plain HTML/CSS/JS for Firebase
  // Hosting. Safe here: no API routes or server-dynamic features in this site.
  output: "export",
};

export default nextConfig;
