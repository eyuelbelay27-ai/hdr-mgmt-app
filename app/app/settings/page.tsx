import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { AppNav } from "../AppNav";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "settings")) {
    return (
      <div className="app-shell">
        <AppNav user={user} activePage="settings" />
        <main className="app-main">
          <p className="label">You don&apos;t have access to Settings.</p>
        </main>
      </div>
    );
  }

  const settings = await getSettings();

  return (
    <div className="app-shell">
      <AppNav user={user} activePage="settings" />
      <main className="app-main">
        <h1 style={{ marginTop: 0 }}>Settings</h1>
        <SettingsForm ratePercent={settings.withholdingRatePercent} threshold={settings.withholdingThreshold} />
      </main>
    </div>
  );
}
