import Script from "next/script";
import "@/previews/avenlo/app/globals.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><Script src="/color-bridge.js" strategy="afterInteractive" />{children}</>;
}
