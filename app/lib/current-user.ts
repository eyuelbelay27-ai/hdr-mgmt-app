import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Loads the calling user's full row — including live actions/actionViews/
 * pages/tabs — directly from the database on every call. Permission checks
 * must never rely on a cached/JWT copy: an Admin's edit to another user's
 * permissions has to take effect on that user's very next request, not
 * their next login (Section 4.5).
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) return null;
  return user;
}

/** Same as getCurrentUser, but throws if there's no authenticated, active user. */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
