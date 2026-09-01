"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAction } from "./actions";

/** Two-step destructive confirm (Section 9); the page never renders this for the current user's own row. */
export function DeleteUserControl({ userId }: { userId: string }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <button className="btn btn-sm btn-danger" type="button" onClick={() => setConfirming(true)}>
        Delete User
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        className="btn btn-sm btn-danger"
        type="button"
        onClick={async () => {
          await deleteUserAction(userId);
          router.push("/users");
        }}
      >
        Confirm Delete
      </button>
      <button className="btn btn-sm" type="button" onClick={() => setConfirming(false)}>Never Mind</button>
    </div>
  );
}
