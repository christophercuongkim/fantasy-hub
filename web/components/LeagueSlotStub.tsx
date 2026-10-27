"use client";

import { Select } from "@seakim/design-system";

/**
 * CHR-125 placeholder — family → season chrome lives here eventually.
 * Disabled Select keeps the SideNav header slot sized; no persistence yet.
 */
export function LeagueSlotStub() {
  return (
    <Select
      size="sm"
      value="stub"
      disabled
      aria-label="League (coming soon)"
      options={[{ value: "stub", label: "League (soon)" }]}
      onChange={() => {}}
    />
  );
}
