import Studio from "@/components/Studio";
import { notFound } from "next/navigation";
import {workspaceViews} from "@/lib/workspace-views";
const views=Object.keys(workspaceViews);
const palette = { text: "#ededed", background: "#0f0f0f", primary: "#ffffff", secondary: "#212121", accent: "#afafaf" };
export const metadata = { title: "Pebble dashboard · Color editor" };
export const dynamicParams = false;
export function generateStaticParams() {
  return [{ view: [] }, ...views.map(view => ({ view: [view] }))];
}
export default async function Page({ params }: { params: Promise<{ view?: string[] }> }) {
  const { view = [] } = await params;
  if (view.length > 1 || (view[0] && !views.includes(view[0]))) notFound();
  return <Studio preview={`/dashboard-previews/workspace/app?view=${view[0] || "chat"}`} defaultPalette={palette} waitForPreview />;
}
