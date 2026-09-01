"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * The tab strip scrolls horizontally on narrow screens (more tabs than fit
 * at once) but has no scrollbar affordance, so landing directly on a tab
 * past the fold left it selected with zero visible indication — the active
 * tab was simply off-screen to the right. Nudges it into view on every tab
 * change (`?tab=` param) since these are plain links, not client
 * navigations that would remount this component.
 */
export function ActiveTabAutoScroll() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  useEffect(() => {
    document.querySelector(".tab.active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);

  return null;
}
