import { LoginForm } from "./LoginForm";
import { HadarMark } from "../Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  return (
    <div className="login-page">
      <div className="login-card card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <HadarMark size={56} />
        </div>
        <h1 style={{ textAlign: "center" }}>Hadar Advertising</h1>
        <p className="login-subtitle" style={{ textAlign: "center" }}>Job Management — sign in</p>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
