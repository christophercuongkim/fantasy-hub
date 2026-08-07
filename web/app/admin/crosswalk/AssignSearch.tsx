"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@seakim/design-system";
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
    <div
      ref={box}
      style={{
        position: "relative",
        marginTop: "var(--space-2)",
        maxWidth: "20rem",
      }}
    >
      <Input
        size="sm"
        fullWidth
        iconLeft="magnifying-glass"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="or search any player…"
      />
      {open && hits.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: "var(--space-1)",
            width: "100%",
            overflow: "hidden",
            listStyle: "none",
            padding: 0,
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-popover)",
          }}
        >
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => confirmMatch(sourceId, p.id))}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  cursor: pending ? "default" : "pointer",
                  opacity: pending ? 0.5 : 1,
                  font: "var(--type-body-sm)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                <span
                  style={{
                    font: "var(--type-caption)",
                    color: "var(--text-tertiary)",
                  }}
                >
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
