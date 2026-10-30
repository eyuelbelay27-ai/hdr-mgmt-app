import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/pricing/api";
import { workshopUser } from "@/lib/workshop/api";
import { MAX_STATE_CHARS, isValidState, readStore, writeStore, type WsState } from "@/lib/workshop/store";

export const dynamic = "force-dynamic";

/**
 * Saves the whole schedule, based on `version`. If someone saved since, the
 * newer schedule comes back with 409 and the page re-applies its change.
 * A job scheduled at budget approval keeps the job's deadline in step.
 */
export async function POST(req: Request) {
  const { user, error } = await workshopUser(true);
  if (error) return error;
  const body = await readJson(req);
  const base = Number(body.version);
  const next = body.state as WsState;
  if (!Number.isInteger(base) || base < 0 || !isValidState(next)) {
    return NextResponse.json({ ok: false, error: "The schedule could not be read." }, { status: 400 });
  }
  if (JSON.stringify(next).length > MAX_STATE_CHARS) {
    return NextResponse.json({ ok: false, error: "The schedule is too large." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const cur = await readStore(tx);
    if (cur.version !== base) return { conflict: cur };

    // A job scheduled at budget approval stays on the schedule while that
    // approval stands (undoing the approval in Jobs takes it off).
    const kept = new Set(next.jobs.filter((j) => j.appJob).map((j) => j.appJob));
    const dropped = cur.state.jobs.filter((j) => j.appJob && !kept.has(j.appJob));
    if (dropped.length) {
      const live = await tx.job.findMany({
        where: { id: { in: dropped.map((j) => j.appJob!) }, budgetStatus: "Approved" },
        select: { title: true },
      });
      if (live.length) return { refused: `${live[0].title} was scheduled at budget approval; undo the approval in Jobs to take it off.` };
    }

    const version = await writeStore(tx, next, base, user.name);
    if (version === null) return { conflict: await readStore(tx) };

    // Deadline changed here → the job's deadline follows.
    const before = new Map(cur.state.jobs.filter((j) => j.appJob).map((j) => [j.appJob!, j.due]));
    for (const j of next.jobs) {
      if (!j.appJob || !j.due || before.get(j.appJob) === j.due) continue;
      const job = await tx.job.findUnique({ where: { id: j.appJob }, select: { id: true, deadline: true } });
      if (!job) continue;
      if (job.deadline && job.deadline.toISOString().slice(0, 10) === j.due) continue;
      await tx.job.update({ where: { id: job.id }, data: { deadline: new Date(j.due) } });
      await tx.activityEntry.create({
        data: { jobId: job.id, text: `${user.name} changed the deadline to ${j.due} in the Workshop Schedule.` },
      });
    }
    return { version };
  });

  if ("conflict" in result && result.conflict) {
    return NextResponse.json({ ok: false, conflict: true, version: result.conflict.version, state: result.conflict.state }, { status: 409 });
  }
  if ("refused" in result) return NextResponse.json({ ok: false, error: result.refused }, { status: 400 });
  return NextResponse.json({ ok: true, version: result.version });
}
