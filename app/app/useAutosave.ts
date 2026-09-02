"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface MaybeErrorResult {
  error?: string | null;
}

/**
 * Debounced autosave for forms that used to require a manual "Save"
 * button. `save` is the server action (already bound to its ids), called
 * with a FormData built fresh at fire time so it always reflects the
 * latest edit even if several changes were made while a previous save
 * was still in flight.
 */
export function useAutosave(
  save: (formData: FormData) => Promise<void | MaybeErrorResult>,
  delay = 700
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const queuedRef = useRef<(() => FormData) | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSave = useCallback(
    async (buildFormData: () => FormData) => {
      if (savingRef.current) {
        queuedRef.current = buildFormData;
        return;
      }
      savingRef.current = true;
      setStatus("saving");
      try {
        const result = await save(buildFormData());
        if (result && typeof result === "object" && result.error) {
          setStatus("error");
          setError(result.error);
        } else {
          setStatus("saved");
          setError(null);
          if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
          savedTimeoutRef.current = setTimeout(() => {
            setStatus((s) => (s === "saved" ? "idle" : s));
          }, 2000);
        }
      } catch {
        setStatus("error");
        setError("Couldn't save. Check your connection.");
      } finally {
        savingRef.current = false;
        const next = queuedRef.current;
        queuedRef.current = null;
        if (next) runSave(next);
      }
    },
    [save]
  );

  const schedule = useCallback(
    (buildFormData: () => FormData) => {
      setStatus("pending");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runSave(buildFormData), delay);
    },
    [delay, runSave]
  );

  const saveNow = useCallback(
    (buildFormData: () => FormData) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      runSave(buildFormData);
    },
    [runSave]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    },
    []
  );

  return { status, error, schedule, saveNow };
}
