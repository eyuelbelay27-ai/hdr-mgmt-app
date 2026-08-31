import { LoginForm } from "./LoginForm";

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
        <h1>Hadar Advertising</h1>
        <p className="login-subtitle">Job Management — sign in</p>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
