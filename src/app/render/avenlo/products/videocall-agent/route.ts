import { GET as sourcePage } from "@/previews/avenlo/app/products/videocall-agent/route";

export async function GET(request: Request) {
  const response = await sourcePage();
  const html = (await response.text()).replaceAll("http://127.0.0.1:3000", new URL(request.url).origin).replace(/\/_astro\/(?:bg|caller-(?:one|two|three))\.[^"'\s]+?\.avif/g, "/preview-media.svg");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
