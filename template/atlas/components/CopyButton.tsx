"use client";

import { useState } from "react";

/** Everything in the app is stealable, so this is everywhere. */
export default function CopyButton({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={`copy${done ? " is-done" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          // Clipboard can be blocked; fall back to a selection the user can copy.
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
