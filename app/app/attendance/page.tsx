import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { can, canSeePage } from "@/lib/permissions";
import { AppNav } from "../AppNav";
import { AttendanceWorkspace } from "./AttendanceWorkspace";
import { getAttendanceDashboardAction } from "./actions";
import { thisWeekRange } from "./dashboardData";
import { getAttendanceSchedule } from "@/lib/attendance/settings";
import { listAuthorizedDevices } from "@/lib/attendance/device";

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = can(user, "manageAttendance");
  if (!canSeePage(user, "attendance") || !isAdmin) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="attendance" />
        <main className="app-main">
          <h1 style={{ marginTop: 0 }}>Attendance</h1>
          <p className="label">You don&apos;t have access to Attendance.</p>
        </main>
      </div>
    );
  }

  const { start, end } = thisWeekRange();
  const [rows, schedule, devices] = await Promise.all([
    getAttendanceDashboardAction(start, end),
    getAttendanceSchedule(),
    listAuthorizedDevices(),
  ]);

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="attendance" />
      <main className="app-main">
        <h1 style={{ marginTop: 0, marginBottom: 4 }}>Attendance</h1>
        <p className="label" style={{ marginBottom: 12 }}>
          Face-recognition check-in/check-out from the office kiosk. Review who showed up, and set the expected
          times used for late/early flags.
        </p>

        <AttendanceWorkspace initialRows={rows} schedule={schedule} devices={devices} />
      </main>
    </div>
  );
}
