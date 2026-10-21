import Script from "next/script";
import Navigation from "../components/Navigation";
import Faq from "../components/Faq";
import Section from "../components/Section";

export default function Page() {
  return <>
    <div className="page" data-astro-cid-ju4pidww="" data-app-ready>
      <Navigation />
      <main className="home" data-astro-cid-lcdefpme="">
        {['hero', 'jobs', 'videocall', 'knowledge', 'interfaces', 'crm', 'security', 'testimonials'].map(name => <Section key={name} name={name} />)}
        <Faq />
      </main>
      <Section name="footer" />
    </div>
    <Section name="cookies" />
    <Section name="demo" />
    <Script src="/navigation.js" strategy="afterInteractive" />
    <Script src="/faq.js" strategy="afterInteractive" />
    <Script src="/visuals.js" strategy="afterInteractive" type="module" />
    <Script src="/interactions.js" strategy="afterInteractive" />
  </>;
}
