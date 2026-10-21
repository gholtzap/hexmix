import { readFile } from "node:fs/promises";
import { join } from "node:path";

type RouteContext = { params: Promise<{ view: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const path = (await params).view.join("/");
  const catalog = JSON.parse(await readFile(join(process.cwd(), "public/source-pages/catalog.json"), "utf8")) as Record<string, { file: string }>;
  const page = catalog[path];
  if (!page && path !== "products/team-planning") return new Response("Not found", { status: 404 });
  const html = await readFile(page
    ? join(process.cwd(), "public/source-pages", page.file)
    : join(process.cwd(), "public/products/team-planning.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
