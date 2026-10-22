import { NextResponse } from "next/server";
import { clearPricingSession } from "@/lib/pricing/pinSession";

/** Locks Pricing Settings for the caller (sent when a tool page loads). */
export async function POST() {
  clearPricingSession();
  return new NextResponse(null, { status: 204 });
}
