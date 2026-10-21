import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Hexmix", template: "%s | Hexmix" },
  applicationName: "Hexmix",
  icons: { icon: "/hexmix-logo.png" },
  description: "Choose colors and fonts, then see them on real designs.",
  openGraph: {
    siteName: "Hexmix",
    title: "Hexmix",
    description: "Choose colors and fonts, then see them on real designs.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/fonts/fonts.css" /></head>
      <body>{children}</body>
    </html>
  );
}
