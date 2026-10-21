import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function Section({ name }: { name: string }) {
  const markup = await readFile(path.join(process.cwd(), "src/previews/orvian/content", `${name}.html`), "utf8");
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />;
}
