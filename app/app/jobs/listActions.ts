"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canSeePage } from "@/lib/permissions";
import { fetchJobsPage, type JobListFilter, type JobListItem } from "./listData";

export async function loadMoreJobsAction(
  filter: JobListFilter,
  skip: number
): Promise<{ jobs: JobListItem[]; hasMore: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSeePage(user, "jobs")) return { jobs: [], hasMore: false };
  return fetchJobsPage(user, filter, skip);
}
