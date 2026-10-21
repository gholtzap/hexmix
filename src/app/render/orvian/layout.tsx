import Script from "next/script";
import localFont from "next/font/local";
import "@/previews/orvian/app/globals.css";

const exposure = localFont({ src: "../../../previews/orvian/fonts/Exposure-s.p.f89f8aac.woff2", variable: "--font-exposure", weight: "400" });
const geist = localFont({ src: "../../../previews/orvian/fonts/e324760ae5c6aeb3-s.p.f073c7aa.woff2", variable: "--font-geist", weight: "500" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${exposure.variable} ${geist.variable}`}><Script src="/color-bridge.js" strategy="afterInteractive" />{children}</div>;
}
