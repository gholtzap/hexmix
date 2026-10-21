import Script from "next/script";
import Section from "./Section";

export default function Faq() {
  return (
    <div id="faq" style={{ display: "contents" }}>
      <Section name="faq" />
      <Script src="/preview-pages/orvian/faq.js" strategy="afterInteractive" />
    </div>
  );
}
