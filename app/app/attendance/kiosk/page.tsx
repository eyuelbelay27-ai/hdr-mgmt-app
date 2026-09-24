import { ShieldAlert } from "lucide-react";
import { getKioskStateAction } from "../actions";
import { KioskScreen } from "./KioskScreen";

/**
 * The kiosk screen — deliberately outside the app's normal auth (see
 * middleware.ts's PUBLIC_PATHS and the plan's explicit "device token
 * only, no login" decision). Whoever loads this URL sees either the
 * "not authorized" notice below or the full capture flow, gated purely
 * by whether their browser carries a valid device-token cookie.
 */
export default async function KioskPage() {
  const state = await getKioskStateAction();

  if (!state.deviceAuthorized) {
    return (
      <div className="kiosk-root kiosk-center">
        <ShieldAlert size={48} strokeWidth={1.5} />
        <h1 style={{ margin: 0 }}>Device Not Authorized</h1>
        <p style={{ maxWidth: 420 }}>
          This screen only works from the authorized office PC. Ask an admin to authorize this device from
          Attendance → Settings, signed in on this same browser.
        </p>
      </div>
    );
  }

  return <KioskScreen initialEmployees={state.employees} />;
}
