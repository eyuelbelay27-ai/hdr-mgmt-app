import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the Auth.js config, used by middleware.ts. Must not
 * pull in anything that needs Node APIs (bcrypt, Prisma) — those live in
 * auth.ts's Credentials provider, which only route handlers and server
 * actions import. Middleware only needs to decode the session cookie.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
} satisfies NextAuthConfig;
