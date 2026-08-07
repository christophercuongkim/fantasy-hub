"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@seakim/design-system";

// Season filter → the URL (`/draft?season=2024`), the shareable source of truth.
// Local state updates the control instantly; useTransition drives the pending
// state while the server re-renders (no blocking flash).
export function YearFilter({
  seasons,
  value,
}: {
  seasons: number[];
  value?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [val, setVal] = useState(value != null ? String(value) : "all");

  // Keep in sync if the URL changes elsewhere (back/forward).
  useEffect(() => {
    setVal(value != null ? String(value) : "all");
  }, [value]);

  const options = [
    { value: "all", label: "All seasons" },
    ...seasons.map((s) => ({ value: String(s), label: String(s) })),
  ];

  return (
    <Select
      size="sm"
      value={val}
      options={options}
      disabled={pending}
      aria-label="Filter by season"
      onChange={(e) => {
        const v = e.target.value;
        setVal(v);
        start(() =>
          router.push(v === "all" ? "/draft" : `/draft?season=${v}`, {
            scroll: false,
          }),
        );
      }}
    />
  );
}
