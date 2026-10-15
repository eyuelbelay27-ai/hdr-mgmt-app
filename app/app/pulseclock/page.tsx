import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { can, canSeePage } from "@/lib/permissions";
import { ETHIOPIAN_MONTH_NAMES, ethiopianToday } from "@/lib/payroll/ethiopian";
import { hasAdminSession } from "@/lib/pulseclock/adminSession";
import { getPulseSettings } from "@/lib/pulseclock/settings";
import { isValidDescriptor } from "@/lib/pulseclock/faceMatch";
import {
  addisHHMM,
  addisTimeLabel,
  addisWeekday,
  addisWorkDate,
  ethiopianDateLabel,
  minutesLabel,
  WEEKDAY_NAMES,
} from "@/lib/pulseclock/time";
import {
  buildDailyLog,
  buildMonthReport,
  currentPulseMonth,
  parsePulseMonth,
  pulseMonthKey,
  pulseMonthLabel,
  shiftPulseMonth,
} from "@/lib/pulseclock/reports";
import Link from "next/link";
import { AppNav } from "../AppNav";
import { AdminGuard } from "./AdminGuard";
import { CheckInScreen } from "./CheckInScreen";
import { AdminLogin } from "./AdminLogin";
import {
  AuditPanel,
  EmployeesPanel,
  ExceptionsPanel,
  OverviewPanel,
  ReportsPanel,
  SettingsPanel,
  type RegisterRow,
} from "./AdminPanels";
import { lockAdminAction } from "./actions";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "employees", label: "Employees" },
  { key: "reports", label: "Reports" },
  { key: "schedule", label: "Leave & holidays" },
  { key: "audit", label: "Audit trail" },
  { key: "settings", label: "Settings" },
] as const;

const DAY_MS = 86400000;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function PulseClockPage({
  searchParams,
}: {
  searchParams: { view?: string; tab?: string; month?: string; date?: string; log?: string; emp?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canSeePage(user, "pulseclock")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="pulseclock" />
        <main className="app-main">
          <h1 style={{ marginTop: 0 }}>PulseClock</h1>
          <p className="label">You don&apos;t have access to PulseClock.</p>
        </main>
      </div>
    );
  }

  const view = searchParams.view === "admin" ? "admin" : "checkin";
  const settings = await getPulseSettings();
  const rules = {
    shiftStartMin: settings.shiftStartMin,
    shiftEndMin: settings.shiftEndMin,
    graceMin: settings.graceMin,
    workDays: settings.workDays,
  };
  const today = addisWorkDate();
  const isAdmin = view === "admin" && hasAdminSession(user.id);

  const top = (
    <div className="pc-top">
      <div className="pc-brand">
        <span className="pc-mark" aria-hidden>◷</span>
        <span>
          <b>PulseClock</b>
          <small>Attendance</small>
        </span>
      </div>
      <nav className="pc-switch" aria-label="PulseClock view">
        <a href="/pulseclock" className={view === "checkin" ? "active" : ""}>Check-in</a>
        <a href="/pulseclock?view=admin" className={view === "admin" ? "active" : ""}>Admin</a>
      </nav>
    </div>
  );

  let body: React.ReactNode;

  if (view === "checkin") {
    const [employees, todays, onLeave, holiday] = await Promise.all([
      prisma.pulseEmployee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.pulseAttendance.findMany({ where: { workDate: today } }),
      prisma.pulseLeave.count({ where: { date: today } }),
      prisma.pulseHoliday.findUnique({ where: { date: today } }),
    ]);
    const workDay = rules.workDays.includes(addisWeekday());
    body = (
      <CheckInScreen
        employees={employees.map((e) => {
          const r = todays.find((t) => t.employeeId === e.id);
          return {
            id: e.id,
            name: e.name,
            role: e.role,
            enrolled: isValidDescriptor(e.descriptor),
            checkedIn: r?.checkInAt ? addisTimeLabel(r.checkInAt) : null,
            checkedOut: r?.checkOutAt ? addisTimeLabel(r.checkOutAt) : null,
          };
        })}
        stats={{
          present: todays.filter((t) => t.checkInAt).length,
          late: todays.filter((t) => t.late).length,
          onLeave,
          total: employees.length,
        }}
        dayNote={holiday ? `Today is a holiday: ${holiday.reason}` : workDay ? null : "Today isn't a working day."}
        shiftLabel={`${minutesLabel(rules.shiftStartMin)} – ${minutesLabel(rules.shiftEndMin)}`}
        lateAfter={minutesLabel(rules.shiftStartMin + rules.graceMin)}
      />
    );
  } else if (!isAdmin) {
    body = <AdminLogin pinSet={settings.pinSet} isAppAdmin={can(user, "manageUsers")} />;
  } else {
    const tab = TABS.find((t) => t.key === searchParams.tab)?.key ?? "overview";
    let panel: React.ReactNode;

    if (tab === "overview") {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? new Date(`${searchParams.date}T00:00:00Z`) : null;
      const day = parsed && !Number.isNaN(parsed.getTime()) && parsed <= today ? parsed : today;
      const [employees, records, leave, holiday] = await Promise.all([
        prisma.pulseEmployee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
        prisma.pulseAttendance.findMany({ where: { workDate: day } }),
        prisma.pulseLeave.findMany({ where: { date: day } }),
        prisma.pulseHoliday.findUnique({ where: { date: day } }),
      ]);
      const isWorkDay = rules.workDays.includes(day.getUTCDay()) && !holiday;
      const rows: RegisterRow[] = employees
        .filter((e) => e.active || records.some((r) => r.employeeId === e.id))
        .map((e) => {
          const r = records.find((x) => x.employeeId === e.id);
          const l = leave.find((x) => x.employeeId === e.id);
          let status: RegisterRow["status"] = "absent";
          if (r?.checkInAt) status = r.late ? "late" : "present";
          else if (l) status = "leave";
          else if (!isWorkDay) status = "off";
          else if (day.getTime() === today.getTime()) status = "pending";
          return {
            employeeId: e.id,
            name: e.name,
            role: e.role,
            initials: initials(e.name),
            photo: e.referencePhotoUrl,
            checkIn: addisTimeLabel(r?.checkInAt),
            checkOut: addisTimeLabel(r?.checkOutAt),
            checkInHHMM: addisHHMM(r?.checkInAt),
            checkOutHHMM: addisHHMM(r?.checkOutAt),
            early: !!r?.early,
            corrected: r?.source === "admin-correction",
            status,
            note: l?.reason ?? null,
          };
        });
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      panel = (
        <OverviewPanel
          dayIso={iso(day)}
          dayLabel={`${WEEKDAY_NAMES[day.getUTCDay()]}, ${ethiopianDateLabel(day)}`}
          prevIso={iso(new Date(day.getTime() - DAY_MS))}
          nextIso={day < today ? iso(new Date(day.getTime() + DAY_MS)) : null}
          isToday={day.getTime() === today.getTime()}
          dayNote={holiday ? `Holiday: ${holiday.reason}` : isWorkDay ? null : "Not a working day"}
          rows={rows}
        />
      );
    } else if (tab === "employees") {
      const employees = await prisma.pulseEmployee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
      panel = (
        <EmployeesPanel
          employees={employees.map((e) => ({
            id: e.id,
            name: e.name,
            role: e.role,
            active: e.active,
            initials: initials(e.name),
            photo: e.referencePhotoUrl,
            enrolledAt: e.enrolledAt ? ethiopianDateLabel(addisWorkDate(e.enrolledAt)) : null,
          }))}
        />
      );
    } else if (tab === "reports") {
      const month = parsePulseMonth(searchParams.month) ?? currentPulseMonth();
      const logMonths = Math.min(Math.max(Number(searchParams.log) || 3, 1), 240);
      const empId = searchParams.emp || null;
      const [report, log, staff] = await Promise.all([
        buildMonthReport(month, rules),
        buildDailyLog(rules, logMonths, empId),
        prisma.pulseEmployee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
      ]);
      panel = (
        <ReportsPanel
          log={log}
          logMonths={logMonths}
          empId={empId}
          staff={staff}
          monthKey={pulseMonthKey(month)}
          monthLabel={pulseMonthLabel(month)}
          prevKey={pulseMonthKey(shiftPulseMonth(month, -1))}
          nextKey={pulseMonthKey(shiftPulseMonth(month, 1))}
          report={report}
        />
      );
    } else if (tab === "schedule") {
      const since = new Date(today.getTime() - 60 * DAY_MS);
      const [employees, leave, holidays] = await Promise.all([
        prisma.pulseEmployee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
        prisma.pulseLeave.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" }, include: { employee: true } }),
        prisma.pulseHoliday.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" } }),
      ]);
      const items = [
        ...leave.map((l) => ({ type: "leave" as const, id: l.id, date: l.date, title: l.employee.name, reason: l.reason, by: l.createdBy })),
        ...holidays.map((h) => ({ type: "holiday" as const, id: h.id, date: h.date, title: "Company holiday", reason: h.reason, by: h.createdBy })),
      ]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((x) => ({ ...x, date: ethiopianDateLabel(x.date), upcoming: x.date >= today }));
      panel = (
        <ExceptionsPanel
          employees={employees.map((e) => ({ id: e.id, name: e.name }))}
          items={items}
          today={ethiopianToday()}
          monthNames={ETHIOPIAN_MONTH_NAMES}
        />
      );
    } else if (tab === "audit") {
      const entries = await prisma.pulseAudit.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
      panel = (
        <AuditPanel
          entries={entries.map((a) => ({
            id: a.id,
            actor: a.actor,
            action: a.action,
            detail: a.detail,
            when: `${ethiopianDateLabel(addisWorkDate(a.createdAt))} · ${addisTimeLabel(a.createdAt)}`,
          }))}
        />
      );
    } else {
      panel = (
        <SettingsPanel
          shiftStart={`${String(Math.floor(rules.shiftStartMin / 60)).padStart(2, "0")}:${String(rules.shiftStartMin % 60).padStart(2, "0")}`}
          shiftEnd={`${String(Math.floor(rules.shiftEndMin / 60)).padStart(2, "0")}:${String(rules.shiftEndMin % 60).padStart(2, "0")}`}
          grace={rules.graceMin}
          workDays={rules.workDays}
        />
      );
    }

    body = (
      <AdminGuard>
      <div className="pc-admin">
        <aside className="pc-side">
          <h3>Admin</h3>
          <nav>
            {TABS.map((t) => (
              <Link key={t.key} href={`/pulseclock?view=admin&tab=${t.key}`} className={t.key === tab ? "active" : ""}>
                {t.label}
              </Link>
            ))}
          </nav>
          <form action={lockAdminAction} className="pc-sidefoot">
            <button type="submit" className="pc-button pc-ghost">Lock admin</button>
          </form>
        </aside>
        <section className="pc-content">{panel}</section>
      </div>
      </AdminGuard>
    );
  }

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="pulseclock" />
      <main className="app-main">
        <div className="pc">
          {top}
          {body}
        </div>
      </main>
    </div>
  );
}
