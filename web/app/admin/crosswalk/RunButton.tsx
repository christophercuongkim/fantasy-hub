"use client";

import { useFormStatus } from "react-dom";

// Submit button that shows the job running (the parent <form> action is the
// server action that POSTs to the api and revalidates).
export function RunButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Running…" : "Rebuild & resolve"}
    </button>
  );
}
