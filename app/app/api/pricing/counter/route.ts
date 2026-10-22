import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pricingUser, readJson } from "@/lib/pricing/api";
import { COUNTER_PREFIX, findTool } from "@/lib/pricing/tools";

/**
 * Hands out the next invoice number for a tool — one atomic increment, so
 * two people printing at the same moment never get the same number.
 * Lightbox numbers per calendar year (INV-2026-0001), as the original did.
 */
export async function POST(req: Request) {
  const { error } = await pricingUser();
  if (error) return error;
  const tool = findTool(String((await readJson(req)).tool ?? ""));
  if (!tool) return NextResponse.json({ ok: false, error: "Unknown tool." }, { status: 400 });
  const year = new Date().getFullYear();
  const key = tool.id === "lightbox" ? `lightbox:${year}` : tool.id;
  const row = await prisma.pricingCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const n = String(row.value).padStart(4, "0");
  const label = tool.id === "lightbox" ? `${COUNTER_PREFIX.lightbox}-${year}-${n}` : `${COUNTER_PREFIX[tool.id]}-${n}`;
  return NextResponse.json({ ok: true, value: row.value, year, label });
}
