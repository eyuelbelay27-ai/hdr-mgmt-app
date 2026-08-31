"use client";

import { useFormStatus } from "react-dom";

/**
 * React 18 (Next.js 14) has no useActionState — pending state for a form
 * action comes from useFormStatus, which must run in a component nested
 * inside the <form>, not the component that renders the form itself.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className = "btn btn-primary",
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
