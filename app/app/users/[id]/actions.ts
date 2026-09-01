"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import {
  requireAction,
  requirePage,
  PermissionError,
  buildPermSet,
  ACTION_KEYS,
  PAGE_KEYS,
  TAB_KEYS,
} from "@/lib/permissions";

export interface ActionState {
  error: string | null;
}

async function assertManageUsers() {
  const user = await requireCurrentUser();
  requirePage(user, "users");
  requireAction(user, "manageUsers", "edit");
  return user;
}

/** Role dropdown resets permissions to that role's defaults (Section 8.8). */
export async function resetRoleAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await assertManageUsers();
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const role = String(formData.get("role") ?? "") as Role;
  if (!Object.values(Role).includes(role)) return { error: "Invalid role." };

  const { actions, actionViews, pages, tabs } = buildPermSet(role);
  await prisma.user.update({ where: { id: userId }, data: { role, actions, actionViews, pages, tabs } });
  revalidatePath(`/users/${userId}`);
  return { error: null };
}

/**
 * Saves the full Pages/Tabs/Actions grid (Section 5/8.8). Checking Edit
 * auto-grants View, matching the house rule from Section 5.1.
 */
export async function savePermissionsAction(userId: string, formData: FormData): Promise<void> {
  await assertManageUsers();

  const actions: Record<string, boolean> = {};
  const actionViews: Record<string, boolean> = {};
  for (const { key } of ACTION_KEYS) {
    const edit = formData.get(`action_edit_${key}`) === "on";
    const view = formData.get(`action_view_${key}`) === "on";
    actions[key] = edit;
    actionViews[key] = edit || view;
  }

  const pages: Record<string, boolean> = {};
  for (const { key } of PAGE_KEYS) pages[key] = formData.get(`page_${key}`) === "on";

  const tabs: Record<string, boolean> = {};
  for (const { key } of TAB_KEYS) tabs[key] = formData.get(`tab_${key}`) === "on";

  await prisma.user.update({ where: { id: userId }, data: { actions, actionViews, pages, tabs } });
  revalidatePath(`/users/${userId}`);
}

export async function resetPasswordAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await assertManageUsers();
  } catch (err) {
    if (err instanceof PermissionError) return { error: err.message };
    throw err;
  }

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { error: null };
}

export async function deleteUserAction(userId: string): Promise<void> {
  const currentUser = await assertManageUsers();
  if (userId === currentUser.id) throw new PermissionError("You can't delete your own account.");
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/users");
}
