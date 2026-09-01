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
  // Run on pages only, not API routes — this redirect-to-/login behavior
  // is a page-navigation UX, not an API auth mechanism. Route Handlers
  // under /api/ (auth's own callback routes, and the one-time admin seed
  // trigger that must be reachable before any user exists) do their own
  // auth checks instead.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
