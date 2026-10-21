import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avenlo · A fresh approach to business",
  description: "Bring your people, plans, and ideas together. Take a clear next step with your team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<Script src="http://127.0.0.1:3000/color-bridge.js" strategy="afterInteractive" /></body></html>;
}
