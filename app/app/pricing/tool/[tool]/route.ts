import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";
import { findTool } from "@/lib/pricing/tools";

export const dynamic = "force-dynamic";

const files = new Map<string, string>();

async function toolHtml(id: string): Promise<string> {
  let html = files.get(id);
  if (!html) {
    html = await readFile(path.join(process.cwd(), "pricing-tools", id, "index.html"), "utf8");
    if (process.env.NODE_ENV === "production") files.set(id, html);
  }
  return html;
}

/**
 * Serves one pricing tool (loaded in an iframe by /pricing) with the
 * current shared settings embedded, so the tool can read them synchronously
 * exactly as it used to read its browser storage.
 */
export async function GET(req: Request, { params }: { params: { tool: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const tool = findTool(params.tool);
  if (!tool) return new NextResponse("Not found", { status: 404 });
  if (!canSeePage(user, "pricing")) return new NextResponse("You don't have access to Pricing.", { status: 403 });

  const rows = await prisma.pricingStore.findMany({ where: { key: { startsWith: `${tool.id}:` } } });
  const shared: Record<string, string> = {};
  for (const r of rows) shared[r.key.slice(tool.id.length + 1)] = r.value;

  // "<" escaped so nothing in saved settings can close the script tag.
  const config = JSON.stringify({ tool: tool.id, sharedKeys: tool.sharedKeys, shared }).replace(/</g, "\\u003c");
  const bootstrap =
    `<link rel="icon" type="image/svg+xml" href="/pricing-assets/icon.svg">` +
    `<link rel="stylesheet" href="/pricing-assets/tools.css">` +
    `<script>window.__PRICING__=${config};</script>` +
    `<script src="/pricing-assets/bootstrap.js"></script>`;
  const html = (await toolHtml(tool.id)).replace("<!--PRICING_BOOTSTRAP-->", bootstrap);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
