// Draft recommendation math — pure, so it's easy to reason about and could be
// unit-tested. Given the value board + my roster + the draft state, it answers
// "what should I take now": remaining needs, the best available for those needs,
// tier cliffs, and (best-effort) when I'm next up.
import type { DraftBoardRow, RosterPick } from "./draft-board";

const STARTERS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
const FLEX_ELIGIBLE = ["RB", "WR", "TE"] as const;

export type Needs = {
  base: Record<string, number>; // remaining base starter slots per position
  flexOpen: number; // open FLEX (W/R/T) slots
  needed: Set<string>; // positions that still fill a starter slot (incl. FLEX)
};

// roster_positions_json uses Yahoo slot keys; DEF is our DST.
function required(slots: Record<string, number>, pos: string): number {
  return (pos === "DST" ? slots["DEF"] : slots[pos]) ?? 0;
}

export function computeNeeds(
  slots: Record<string, number>,
  roster: RosterPick[],
): Needs {
  const count: Record<string, number> = {};
  for (const p of roster) count[p.pos] = (count[p.pos] ?? 0) + 1;

  const base: Record<string, number> = {};
  let surplus = 0; // RB/WR/TE beyond their base requirement → spill to FLEX
  for (const pos of STARTERS) {
    const c = count[pos] ?? 0;
    const req = required(slots, pos);
    base[pos] = Math.max(0, req - c);
    if ((FLEX_ELIGIBLE as readonly string[]).includes(pos))
      surplus += Math.max(0, c - req);
  }
  const flexSlots = slots["W/R/T"] ?? 0;
  const flexOpen = Math.max(0, flexSlots - Math.min(flexSlots, surplus));

  const needed = new Set<string>();
  for (const pos of STARTERS) {
    if (base[pos] > 0) needed.add(pos);
    else if (flexOpen > 0 && (FLEX_ELIGIBLE as readonly string[]).includes(pos))
      needed.add(pos);
  }
  return { base, flexOpen, needed };
}

// The top undrafted players that fill a starter need (VOR-ranked; rows arrive
// sorted). Once every starter is filled, fall back to best-available overall
// (bench depth).
export function bestAvailable(
  rows: DraftBoardRow[],
  needs: Needs,
  n = 5,
): DraftBoardRow[] {
  const avail = rows.filter((r) => !r.drafted);
  const pool = needs.needed.size
    ? avail.filter((r) => needs.needed.has(r.pos))
    : avail;
  return pool.slice(0, n);
}

// Is `r` the last undrafted player in his tier at his position? If so, taking the
// next player at that position means dropping a tier — the "draft now" signal.
export function isTierCliff(rows: DraftBoardRow[], r: DraftBoardRow): boolean {
  const atPos = rows.filter((x) => !x.drafted && x.pos === r.pos); // VOR-sorted
  const i = atPos.findIndex((x) => x.overallRank === r.overallRank);
  const next = atPos[i + 1];
  return !next || next.tier !== r.tier;
}

export type PickClock = {
  drafted: number;
  nextPick: number;
  picksUntil: number; // 0 = on the clock now
  onClock: boolean;
};

// My overall pick numbers in a snake draft from a draft slot.
function snakeSeq(slot: number, numTeams: number, rounds = 16): number[] {
  const seq: number[] = [];
  for (let k = 1; k <= rounds; k++) {
    seq.push(k % 2 === 1 ? (k - 1) * numTeams + slot : k * numTeams - slot + 1);
  }
  return seq;
}

// Best-effort: use the assigned draft slot, else derive it from my round-1 pick
// once the draft's underway. null until either is known (order not yet drawn).
export function pickClock(
  numTeams: number,
  draftedCount: number,
  draftPosition: number | null,
  myPickOveralls: number[],
): PickClock | null {
  let slot = draftPosition ?? null;
  if (!slot && myPickOveralls.length) {
    const r1 = myPickOveralls
      .filter((o) => o <= numTeams)
      .sort((a, b) => a - b)[0];
    if (r1) slot = r1;
  }
  if (!slot) return null;
  const next = snakeSeq(slot, numTeams).find((o) => o > draftedCount);
  if (!next) return null;
  return {
    drafted: draftedCount,
    nextPick: next,
    picksUntil: next - (draftedCount + 1),
    onClock: next === draftedCount + 1,
  };
}
