"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { confirmMatch, searchPlayers, type PlayerHit } from "./actions";

// Free-text "assign any player" box for a review entry — used when the
// suggested candidates are wrong or there are none.
export function AssignSearch({ sourceId }: { sourceId: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setHits(await searchPlayers(q));
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={box} className="relative mt-2 w-full max-w-xs">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="or search any player…"
        className="w-full rounded-md border border-neutral-300 bg-transparent px-2.5 py-1 text-sm outline-none focus:border-blue-500 dark:border-neutral-700"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                disabled={pending}
                onClick={() => start(() => confirmMatch(sourceId, p.id))}
                className="flex w-full items-baseline justify-between px-2.5 py-1.5 text-left text-sm hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-950"
              >
                <span className="font-medium">{p.full_name}</span>
                <span className="text-xs text-neutral-500">
                  {[
                    p.position,
                    p.team ?? undefined,
                    p.draft_year
                      ? `'${String(p.draft_year).slice(2)}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
