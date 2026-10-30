import { NextResponse } from "next/server";
import { workshopUser } from "@/lib/workshop/api";
import { readStore } from "@/lib/workshop/store";

export const dynamic = "force-dynamic";

/** The current schedule; `?v=` returns only the version when nothing changed. */
export async function GET(req: Request) {
  const { error } = await workshopUser(false);
  if (error) return error;
  const { state, version } = await readStore();
  const known = Number(new URL(req.url).searchParams.get("v"));
  if (known === version) return NextResponse.json({ ok: true, version }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, version, state }, { headers: { "Cache-Control": "no-store" } });
}
