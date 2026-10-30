import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { can, canSeePage } from "@/lib/permissions";
import { readStore } from "@/lib/workshop/store";
import { addisToday } from "@/lib/ethiopian";

export const dynamic = "force-dynamic";

let cached: string | null = null;
async function pageHtml(): Promise<string> {
  if (cached) return cached;
  const html = await readFile(path.join(process.cwd(), "workshop-app", "index.html"), "utf8");
  if (process.env.NODE_ENV === "production") cached = html;
  return html;
}

/**
 * Serves the Workshop Schedule page (loaded in an iframe by /workshop, and by
 * a job's budget approval with ?approve=<jobId>) with the shared schedule
 * and the signed-in user embedded.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const approveId = new URL(req.url).searchParams.get("approve");
  let approve: { jobId: string; title: string; customer: string; jobNumber: string; rep: string; due: string } | null = null;
  if (approveId) {
    // Approving a budget: the approver schedules the job here, even without
    // the Workshop Schedule page.
    if (!can(user, "approveBudget")) return new NextResponse("You can't approve budgets.", { status: 403 });
    const job = await prisma.job.findUnique({
      where: { id: approveId },
      select: { id: true, title: true, clientName: true, jobNumber: true, status: true, salesRep: true, requestedDeadline: true },
    });
    if (!job) return new NextResponse("Job not found.", { status: 404 });
    if (job.status !== "WaitingForApproval") return new NextResponse("This job isn't waiting for approval.", { status: 400 });
    // Sales rep and deadline from the job pre-fill the scheduler (the
    // approver may still pick another deadline; a past one isn't offered).
    const due = job.requestedDeadline ? job.requestedDeadline.toISOString().slice(0, 10) : "";
    approve = {
      jobId: job.id,
      title: job.title,
      customer: job.clientName,
      jobNumber: job.jobNumber,
      rep: job.salesRep ?? "",
      due: due && due >= addisToday() ? due : "",
    };
  } else if (!canSeePage(user, "workshop")) {
    return new NextResponse("You don't have access to the Workshop Schedule.", { status: 403 });
  }

  const { state, version } = await readStore();
  const config = {
    user: user.name,
    canEdit: !approve && canSeePage(user, "workshop") && can(user, "editSchedule"),
    version,
    state,
    approve,
  };
  // "<" escaped so nothing in saved text can close the script tag.
  const boot = `<script>window.__WS__=${JSON.stringify(config).replace(/</g, "\\u003c")};</script>`;
  const html = (await pageHtml()).replace("<!--WORKSHOP_BOOTSTRAP-->", boot);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "SAMEORIGIN" },
  });
}
