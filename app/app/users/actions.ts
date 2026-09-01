"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { requireAction, requirePage, buildPermSet, PermissionError } from "@/lib/permissions";

export interface CreateUserState {
  error: string | null;
}

const ROLE_VALUES = Object.values(Role);

/**
 * Create a user (Section 8.8). Enforced server-side via requireAction —
 * a request from anyone without `manageUsers` is rejected here regardless
 * of what the client sent, per Section 2/10's "not just hidden in the UI"
 * requirement. New users get actions/actionViews/pages/tabs seeded from
 * role defaults (Section 5.5); every value is independently editable by an
 * Admin from that point on (full permissions-editor grid is out of scope
 * for this foundation pass — see README).
 */
export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const currentUser = await requireCurrentUser();

  try {
    requirePage(currentUser, "users");
    requireAction(currentUser, "manageUsers", "edit");
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!username) return { error: "Username is required." };
  if (!name) return { error: "Name is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!ROLE_VALUES.includes(role)) return { error: "Invalid role." };

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: "That username is already taken." };

  const passwordHash = await bcrypt.hash(password, 12);
  const { actions, actionViews, pages, tabs } = buildPermSet(role);

  await prisma.user.create({
    data: { username, name, role, passwordHash, actions, actionViews, pages, tabs },
  });

  revalidatePath("/users");
  return { error: null };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<void> {
  const currentUser = await requireCurrentUser();
  requirePage(currentUser, "users");
  requireAction(currentUser, "manageUsers", "edit");

  if (userId === currentUser.id) {
    throw new PermissionError("You cannot deactivate your own account.");
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/users");
}
