import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The production database (AletCloud "Solo" plan) allows only 10 connections,
// a few of them reserved for superusers. Prisma's default pool is sized from
// the host's CPU count, which easily exceeds that and fails every query with
// "too many connections". A small explicit cap makes concurrent queries queue
// instead. An explicit value already in DATABASE_URL still wins. Plain string
// appending on purpose: `new URL()` throws on some valid Postgres passwords,
// which would take the whole app down at startup.
function withConnectionLimit(url: string | undefined): string | undefined {
  if (!url || url.includes("connection_limit=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=3&pool_timeout=20`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: withConnectionLimit(process.env.DATABASE_URL) } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
