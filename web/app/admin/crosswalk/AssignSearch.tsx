"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { confirmMatch, searchPlayers, type PlayerHit } from "./actions";

// Free-text "assign any player" combobox for a review entry — used when the
// suggested candidates are wrong or there are none. Follows the ARIA combobox
// pattern: focus stays in the input, arrows move the active option, Enter
// selects, Escape closes (the option `<button>`s are tabIndex=-1 and driven by
// aria-activedescendant, not the Tab order).
export function AssignSearch({ sourceId }: { sourceId: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const showing = open && hits.length > 0;

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setHits(await searchPlayers(q));
      setActive(0);
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

  const choose = (p: PlayerHit) => {
    setOpen(false);
    start(() => confirmMatch(sourceId, p.id));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[active]) choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={box}
      style={{
        position: "relative",
        marginTop: "var(--space-2)",
        maxWidth: "20rem",
      }}
    >
      {/* Token-styled native input (matches the DS Input look) rather than the
          DS Input component. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          height: "var(--control-h-sm)",
          padding: "0 var(--space-4)",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-none)",
        }}
      >
        <i
          className="ph ph-magnifying-glass"
          aria-hidden="true"
          style={{ fontSize: 14, color: "var(--text-tertiary)", flex: "none" }}
        />
        <input
          role="combobox"
          aria-expanded={showing}
          aria-controls={listId}
          aria-activedescendant={showing ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="or search any player…"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            font: "var(--type-body-sm)",
            color: "var(--text-primary)",
          }}
        />
      </div>
      {showing && (
        <ul
          id={listId}
          role="listbox"
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
          {hits.map((p, i) => (
            <li
              key={p.id}
              role="option"
              id={`${listId}-${i}`}
              aria-selected={i === active}
            >
              <button
                type="button"
                tabIndex={-1}
                disabled={pending}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  textAlign: "left",
                  border: "none",
                  cursor: pending ? "default" : "pointer",
                  opacity: pending ? 0.5 : 1,
                  font: "var(--type-body-sm)",
                  color: "var(--text-primary)",
                  // Active option (arrow or hover) is the highlight — no
                  // imperative :hover, the state drives it.
                  background:
                    i === active ? "var(--surface-hover)" : "transparent",
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
