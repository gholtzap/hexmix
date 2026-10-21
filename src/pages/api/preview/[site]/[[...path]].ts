import type { NextApiRequest, NextApiResponse } from "next";
import { handleRequest as tervix } from "../../../../../tervix/scripts/server.mts";
import { handleRequest as nuvexa } from "../../../../../nuvexa/scripts/server.mts";

export const config = { api: { bodyParser: false } };

export default function preview(req: NextApiRequest, res: NextApiResponse) {
  const site = req.query.site;
  const path = req.query.path;
  if (site !== "tervix" && site !== "nuvexa") return res.status(404).end();
  const query = new URL(req.url ?? "/", "http://localhost").search;
  req.url = `/${Array.isArray(path) ? path.join("/") : path ?? ""}${query}`;
  return (site === "tervix" ? tervix : nuvexa)(req, res);
}
