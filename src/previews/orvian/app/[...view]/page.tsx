import { notFound } from "next/navigation";
import Navigation from "../../components/Navigation";
import Section from "../../components/Section";
import DemoDialog from "../../components/DemoDialog";
import "./subpages.css";

const notes = [
  ["A clearer view of how teams move forward", "See how one shared view can help a team choose its next step."],
  ["What changes as teams grow", "Keep plans useful when more people and more decisions enter the work."],
  ["How to keep work moving", "Use a simple process to turn a signal into a useful action."],
  ["The value of shared context", "Give each person the information they need at the right time."],
  ["A practical way to plan", "Start with the work in front of you and make the next step clear."],
  ["Make room for new ideas", "Build a steady way to review what works and what needs to change."],
  ["Find the right starting point", "Choose one task, test the result, and learn from the outcome."],
  ["A better handoff", "Keep the reason for a decision close to the work that follows."],
  ["Work from one clear record", "Help teams see progress without another status meeting."],
  ["When plans need to change", "Make updates visible so people can act with confidence."],
  ["Give every team a clear path", "Connect day-to-day work to the larger goal."],
  ["Keep important details close", "Make key information easy to find and easy to use."],
  ["See progress in context", "Review the work, the decision, and the result together."],
  ["Turn ideas into action", "Bring a useful idea from a first test into regular work."],
  ["Set a useful pace", "Give people enough structure to move without extra process."],
  ["Build a shared direction", "Help teams agree on what matters before work begins."],
  ["Stay ready for change", "Use current information to adjust plans when needs change."],
  ["Learn from each step", "Review the result and use what you learn for the next decision."],
  ["A simple way to connect work", "Keep people, plans, and follow-up in one calm view."],
  ["Focus on the useful signal", "Find the facts that help your team decide what to do next."],
  ["Make the next step clear", "Give each task an owner, a reason, and a clear outcome."],
  ["Plan with more confidence", "Use a shared view to prepare for the work ahead."],
] as const;

const legalPages = {
  terms: { title: "Terms and conditions", sections: [
    ["Using the service", "A final agreement would describe the service and the work it supports."],
    ["Accounts and access", "This part would explain how people get access and how an account is managed."],
    ["Working together", "This part would set out how a team shares work and handles requests."],
    ["Changes to the service", "This part would explain how changes are described to the people who use the service."],
    ["Questions and support", "This part would give people a clear way to ask for help."],
    ["Other information", "A final agreement would include the details needed for the service and its users."],
  ] },
  privacy: { title: "Privacy", sections: [
    ["Information you share", "A final notice would list the information people choose to share."],
    ["How information is used", "This part would explain why the service needs each kind of information."],
    ["Your choices", "This part would show what people can review, change, or remove."],
    ["Keeping information safe", "This part would describe the measures used to protect information."],
    ["Changes to this page", "A final notice would explain how people learn about changes."],
    ["Contact", "This part would give people a way to ask a question about their information."],
  ] },
  dpa: { title: "Data handling", sections: [
    ["Overview", "A final data agreement would name the work and the information it covers."],
    ["Roles and requests", "This part would state who gives instructions and who carries them out."],
    ["Working with information", "This part would describe the steps used to handle information for the service."],
    ["Security measures", "This part would list the measures that apply to the covered information."],
    ["Service partners", "This part would identify any other service involved in the work."],
    ["Changes and contact", "This part would explain how to review changes and ask questions."],
  ] },
} as const;

function frame(children: React.ReactNode, extra = "") {
  return <section className="orvian-frame"><div className={`orvian-frame-inner ${extra}`}>{children}</div></section>;
}

function cover(index: number) {
  return <div className="orvian-cover" style={{ "--cover-turn": `${index * 29}deg`, "--cover-x": `${20 + index % 4 * 18}%`, "--cover-y": `${70 - index % 3 * 20}%` } as React.CSSProperties} />;
}

function Blog() {
  return <>
    {frame(<h1>Ideas for the work ahead</h1>, "orvian-blog-hero")}
    {frame(<div className="orvian-grid">{notes.map(([title, description], index) => <a className="orvian-card" key={title} href={`/blog/${index + 1}`}>
      {cover(index)}<div className="orvian-card-body"><h2>{title}</h2><p>{description}</p></div>
    </a>)}</div>, "orvian-grid-wrap")}
  </>;
}

function Article({ index }: { index: number }) {
  const [title, description] = notes[index];
  const sections = [
    ["Start with what matters", "Name the result you need before you add more tasks. A clear result helps people decide which facts matter.", "Ask each person what they know now and what they still need to learn. Put those answers in one place."],
    ["Bring the work together", "Keep the plan, the people, and the open decisions close to each other. This gives each person the same starting point.", "Assign an owner to each next step. Record changes where the team can see them."],
    ["Review the result", "Compare the result with the goal you set at the start. Note what helped and what made the work harder.", "Use the review to change the plan. Keep the parts that worked and remove steps that added little value."],
    ["Choose the next step", "Select one useful action that the team can take now. Make its owner and expected result clear.", "Set a time to review that action. A small check keeps the plan current as needs change."],
    ["Questions to discuss", "Which decision needs more context? Which person needs an update before work moves on?", "Use the answers to make a simple plan that everyone can follow."],
  ] as const;
  return <>
    {frame(<h1>{title}</h1>, "orvian-article-hero")}
    {frame(<article className="orvian-document"><p className="orvian-intro">{description} This note gives a simple way to review the work, share what you learn, and decide what comes next.</p>{sections.map(([heading, first, second], n) => <section key={heading}><h2>{heading}</h2><p>{first}</p><p>{second}</p>{n === 2 && <blockquote>Make the next step clear, then learn from the result.</blockquote>}</section>)}<a href="/blog" className="orvian-back">Read more notes →</a></article>, "orvian-paper")}
  </>;
}

function Document({ page }: { page: keyof typeof legalPages }) {
  const { title, sections } = legalPages[page];
  return <>
    {frame(<h1>{title}</h1>, "orvian-document-hero")}
    {frame(<article className="orvian-document"><p className="orvian-intro">This page contains sample content. It does not create terms or state a data practice.</p>{sections.map(([heading, copy], n) => <section key={heading}><h2>{n + 1}. {heading}</h2><p>{copy}</p></section>)}</article>, "orvian-paper")}
  </>;
}

export default async function Page({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  const [first, second] = view;
  let body: React.ReactNode;
  if (first === "blog" && view.length === 1) body = <Blog />;
  else if (first === "blog" && view.length === 2 && /^\d+$/.test(second) && Number(second) >= 1 && Number(second) <= notes.length) body = <Article index={Number(second) - 1} />;
  else if (view.length === 1 && Object.hasOwn(legalPages, first)) body = <Document page={first as keyof typeof legalPages} />;
  else notFound();
  return <div className="orvian-subpage" data-app-ready><Navigation /><main>{body}</main><Section name="footer" /><DemoDialog /></div>;
}
