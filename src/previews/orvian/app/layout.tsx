import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const exposure = localFont({ src: "../fonts/Exposure-s.p.f89f8aac.woff2", variable: "--font-exposure", weight: "400" });
const geist = localFont({ src: "../fonts/e324760ae5c6aeb3-s.p.f073c7aa.woff2", variable: "--font-geist", weight: "500" });

export const metadata: Metadata = {
  title: "Orvian · Your next business chapter",
  description: "A shared view for the work ahead.",
  icons: { icon: "/seo/media-55e27dc10635bb.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${exposure.variable} ${geist.variable} antialiased`}><body><Script src="http://127.0.0.1:3000/color-bridge.js" strategy="afterInteractive" />{children}</body></html>;
}
