import Section from "../components/Section";
import Scenes from "../components/Scenes";
import Navigation from "../components/Navigation";
import Faq from "../components/Faq";
import DemoDialog from "../components/DemoDialog";

export default function Page() {
  return <div className="min-h-screen bg-stone-900 bg-[url('/noise.png')] bg-[length:120px_120px] bg-repeat" data-app-ready>
    <Navigation />
    <main>
      <Section name="hero" />
      <Section name="logos" />
      <div className="divide-y divide-gray-200">
        {['company-brain', 'features', 'problem', 'how-it-works', 'security', 'testimonials-heading', 'testimonials', 'world-model'].map(name => <Section name={name} key={name} />)}
        <Faq />
        <Section name="cta" />
      </div>
    </main>
    <Section name="footer" />
    <Scenes />
    <DemoDialog />
  </div>;
}
