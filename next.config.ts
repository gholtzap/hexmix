import type { NextConfig } from "next";
import {legacyPreviewRoutes,legacyPageRoutes} from "./src/lib/previews.ts";
const config: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/preview/[site]/[[...path]]": ["./tervix/public/**/*", "./tervix/assets.json", "./tervix/route-aliases.json", "./nuvexa/public/**/*", "./nuvexa/assets.json"],
    "/render/avenlo": ["./src/previews/avenlo/content/**/*"],
    "/render/avenlo/[...view]": ["./public/source-pages/**/*"],
    "/render/avenlo/products/videocall-agent": ["./public/products/team-planning.html"],
    "/render/orvian": ["./src/previews/orvian/content/**/*"],
    "/render/orvian/[...view]": ["./src/previews/orvian/content/**/*"],
  },
  async rewrites() { return { beforeFiles: [
    { source: "/render/tervix/:path*", destination: "/api/preview/tervix/:path*" },
    { source: "/render/nuvexa/:path*", destination: "/api/preview/nuvexa/:path*" },
    { source: "/render-assets/tervix/:path*", destination: "/api/preview/tervix/:path*" },
    { source: "/render-assets/nuvexa/:path*", destination: "/api/preview/nuvexa/:path*" },
    { source: "/assets/framerusercontent.com/:path*", destination: "/api/preview/nuvexa/assets/framerusercontent.com/:path*" },
    { source: "/assets/fonts.gstatic.com/:path*", destination: "/api/preview/nuvexa/assets/fonts.gstatic.com/:path*" },
  ] }; },
  async headers() { return ["preview-contrast.js", "palette-contrast.js", "font-catalog.js", "fonts/:path*"].map(file => ({ source: `/${file}`, headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] })); },
  async redirects(){return [...legacyPageRoutes.map(route=>({...route,permanent:true})),...legacyPreviewRoutes.map(({source,destination})=>({source:`${source}/:path*`,destination:`${destination}/:path*`,permanent:true}))];},
  transpilePackages: ["@aicss/react"],
  turbopack: { root: process.cwd() },
};
export default config;
