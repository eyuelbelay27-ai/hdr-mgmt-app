import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Uses the edge-safe config only (no Credentials provider / bcrypt / Prisma)
// so this middleware can run without pulling Node-only APIs into the Edge
// bundle. Route handlers and server actions use the full config in auth.ts.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  // Run on everything except static assets and the auth API routes
  // themselves (those must stay reachable to perform login).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
