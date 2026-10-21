import { GET as sourcePage } from "@/previews/avenlo/app/[...view]/route";

export async function GET(request: Request, context: { params: Promise<{ view: string[] }> }) {
  const response = await sourcePage(request, context);
  if (!response.ok) return response;
  const html = (await response.text()).replaceAll("http://127.0.0.1:3000", new URL(request.url).origin);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
