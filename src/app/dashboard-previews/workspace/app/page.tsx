import WorkspaceComponents from "@/components/dashboards/WorkspaceComponents";
export const metadata = { title: "Pebble · Local preview" };
export default function Page() {
  return <>
    {["style", "chat", "space", "scheduled", "plugins", "libraries"].map(file => <link key={file} rel="stylesheet" href={`/dashboard-previews/workspace/${file}.css`} />)}
    <WorkspaceComponents />
  </>;
}
