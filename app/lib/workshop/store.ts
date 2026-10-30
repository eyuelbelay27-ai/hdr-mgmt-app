import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Workshop Schedule — the owner's week planner (app/workshop-app/index.html).
 *
 * The whole schedule is one JSON document, saved for everyone in
 * WorkshopStore. Every save names the version it was based on; a save based
 * on an older version is refused, and the page re-applies its change on top
 * of the newer schedule, so two people planning at once never overwrite
 * each other.
 *
 * Jobs scheduled from a budget approval carry `appJob` (the Job id) and
 * their deadline is kept equal to that job's deadline.
 */
export type Shift = "day" | "ot";
export type Stage = "prod" | "inst";

export interface WsJob {
  id: string;
  name: string;
  customer: string;
  rep: string;
  due: string; // YYYY-MM-DD (Gregorian; shown in the Ethiopian calendar)
  notes: string;
  color: number;
  noInst: boolean;
  appJob?: string;
  appNo?: string;
}
export interface WsEntry {
  id: string;
  job: string;
  stage: Stage;
  date: string;
  shift: Shift;
}
export interface WsLog {
  t: number;
  m: string;
  d: string[];
  by?: string;
}
export interface WsState {
  v: 5;
  updated: number;
  settings: { days: number[]; closed: string[] };
  jobs: WsJob[];
  entries: WsEntry[];
  log: WsLog[];
}

const ID = "main";
const NCOL = 7;
export const MAX_STATE_CHARS = 5 * 1024 * 1024;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyState(): WsState {
  return { v: 5, updated: Date.now(), settings: { days: [1, 2, 3, 4, 5, 6], closed: [] }, jobs: [], entries: [], log: [] };
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function readStore(db: Db = prisma): Promise<{ state: WsState; version: number }> {
  const row = await db.workshopStore.findUnique({ where: { id: ID } });
  if (!row) return { state: emptyState(), version: 0 };
  try {
    return { state: JSON.parse(row.data) as WsState, version: row.version };
  } catch {
    return { state: emptyState(), version: row.version };
  }
}

/**
 * Saves `state` if the stored schedule is still at `baseVersion`.
 * Returns the new version, or null when someone else saved first.
 */
export async function writeStore(db: Db, state: WsState, baseVersion: number, by: string): Promise<number | null> {
  const data = JSON.stringify(state);
  if (baseVersion === 0) {
    const exists = await db.workshopStore.findUnique({ where: { id: ID }, select: { version: true } });
    if (!exists) {
      try {
        await db.workshopStore.create({ data: { id: ID, data, version: 1, updatedBy: by } });
        return 1;
      } catch {
        return null; // created by someone else at the same moment
      }
    }
    if (exists.version !== 0) return null;
  }
  const res = await db.workshopStore.updateMany({
    where: { id: ID, version: baseVersion },
    data: { data, version: baseVersion + 1, updatedBy: by },
  });
  return res.count ? baseVersion + 1 : null;
}

/**
 * Applies `fn` to the latest schedule and saves it, retrying if someone
 * saves in between. `fn` returning false means nothing changed.
 */
export async function mutateStore(db: Db, by: string, fn: (s: WsState) => boolean | void): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const { state, version } = await readStore(db);
    if (fn(state) === false) return;
    state.updated = Date.now();
    if ((await writeStore(db, state, version, by)) !== null) return;
  }
  throw new Error("The schedule is busy; try again.");
}

/** Basic shape check for a schedule sent by the page. */
export function isValidState(s: unknown): s is WsState {
  if (!s || typeof s !== "object") return false;
  const x = s as WsState;
  return (
    x.v === 5 &&
    !!x.settings &&
    Array.isArray(x.settings.days) &&
    Array.isArray(x.settings.closed) &&
    Array.isArray(x.jobs) &&
    Array.isArray(x.entries) &&
    Array.isArray(x.log) &&
    x.jobs.every((j) => j && typeof j.id === "string" && typeof j.name === "string" && (!j.due || DATE_RE.test(j.due))) &&
    x.entries.every(
      (e) => e && typeof e.id === "string" && typeof e.job === "string" && (e.stage === "prod" || e.stage === "inst") && (e.shift === "day" || e.shift === "ot") && DATE_RE.test(e.date)
    )
  );
}

// ---- jobs scheduled from a budget approval ----

export interface ApprovalPlan {
  due: string;
  rep: string;
  customer: string;
  notes: string;
  noInst: boolean;
  prod: string[]; // "YYYY-MM-DD|day" / "YYYY-MM-DD|ot"
  inst: string[];
}

const SLOT_RE = /^\d{4}-\d{2}-\d{2}\|(day|ot)$/;

/** Checks the plan the approver made in the scheduler; returns an error message or null. */
export function planError(p: ApprovalPlan | null): string | null {
  if (!p || typeof p !== "object") return "Schedule the job before approving.";
  if (!DATE_RE.test(p.due ?? "")) return "Pick the deadline in the schedule.";
  if (!Array.isArray(p.prod) || !p.prod.length || !p.prod.every((k) => SLOT_RE.test(k))) return "Pick at least one production day.";
  if (!Array.isArray(p.inst) || !p.inst.every((k) => SLOT_RE.test(k))) return "The installation days are not valid.";
  if (!p.noInst && !p.inst.length) return "Pick at least one installation day, or tick No installation.";
  return null;
}

const uid = () => Math.random().toString(36).slice(2, 9);

// Same Ethiopian-calendar wording the schedule page uses, for its audit trail.
const EM = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"];
const EMS = ["Mes", "Tik", "Hid", "Tah", "Tir", "Yek", "Meg", "Miy", "Gin", "Sen", "Ham", "Neh", "Pag"];
function toEth(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const j = Math.floor(Date.UTC(y, m - 1, d) / 864e5) + 2440588;
  const r = (((j - 1723856) % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return { m: Math.floor(n / 30) + 1, d: (n % 30) + 1 };
}
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
/** "Fri 4 Hidar" */
export function ethFull(iso: string): string {
  const e = toEth(iso);
  return `${weekday(iso)} ${e.d} ${EM[e.m - 1]}`;
}
/** "Fri 4 Hid", "Sat 21 Tik OT" — for lists of days. */
export function ethSlot(k: string): string {
  const [iso, shift] = k.split("|");
  const e = toEth(iso);
  return `${weekday(iso)} ${e.d} ${EMS[e.m - 1]}${shift === "ot" ? " OT" : ""}`;
}
export const appJobKey = (jobId: string) => `app_${jobId}`;

/** Puts (or replaces) an approved job and its days on the schedule. */
export function placeApprovedJob(
  s: WsState,
  job: { id: string; title: string; jobNumber: string },
  p: ApprovalPlan,
  by: string,
  details: string[]
): void {
  const id = appJobKey(job.id);
  const existing = s.jobs.find((j) => j.id === id);
  const used = s.jobs.map((j) => j.color % NCOL);
  let color = 0;
  let min = Infinity;
  for (let c = 0; c < NCOL; c++) {
    const k = used.filter((u) => u === c).length;
    if (k < min) {
      min = k;
      color = c;
    }
  }
  const data: WsJob = {
    id,
    name: job.title,
    customer: (p.customer ?? "").trim(),
    rep: (p.rep ?? "").trim(),
    due: p.due,
    notes: (p.notes ?? "").trim(),
    color: existing ? existing.color : color,
    noInst: !!p.noInst,
    appJob: job.id,
    appNo: job.jobNumber,
  };
  s.jobs = s.jobs.filter((j) => j.id !== id).concat(data);
  s.entries = s.entries.filter((e) => e.job !== id);
  const add = (k: string, stage: Stage) => {
    const [date, shift] = k.split("|") as [string, Shift];
    s.entries.push({ id: uid(), job: id, stage, date, shift });
  };
  Array.from(new Set(p.prod)).forEach((k) => add(k, "prod"));
  if (!p.noInst) Array.from(new Set(p.inst)).forEach((k) => add(k, "inst"));
  logIt(s, `Scheduled ${job.title} at budget approval`, details, by);
}

/** Takes an app job (and all its days) off the schedule. */
export function removeAppJob(s: WsState, jobId: string, why: string, by: string): boolean {
  const id = appJobKey(jobId);
  const j = s.jobs.find((x) => x.id === id);
  if (!j) return false;
  const n = s.entries.filter((e) => e.job === id).length;
  s.jobs = s.jobs.filter((x) => x.id !== id);
  s.entries = s.entries.filter((e) => e.job !== id);
  logIt(s, `Removed ${j.name}`, [why, `${n} ${n === 1 ? "card" : "cards"} removed`], by);
  return true;
}

export function logIt(s: WsState, m: string, d: string[], by: string): void {
  s.log.unshift({ t: Date.now(), m, d, by });
  s.log = s.log.slice(0, 500);
}
