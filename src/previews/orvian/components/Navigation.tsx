import Script from "next/script";
import Section from "./Section";

export default function Navigation() {
  return (
    <>
      <Section name="navigation" />
      <Script src="/preview-pages/orvian/navigation.js" strategy="afterInteractive" />
    </>
  );
}
