// Keeper analysis — pure logic (no I/O, so it's unit-testable). Given the
// commissioner's keeper-cost CSV (authoritative for cost + eligibility, incl. the
// two-years-in-a-row rule that draft data can't express) and the persisted draft
// board, this scores each keeper by the value it returns over the pick it costs.
//
// "Value at the round it occupies" = two independent surpluses:
//   • model  — our projection's VOR minus the VOR of the pick you'd forfeit
//   • market — keeper-cost round minus the player's ADP round
// A keeper is only "robust" when both agree it's a gain. See the DS-free normalize
// below: it MUST mirror api/app/crosswalk/names.py or name matching silently drifts.

const SUFFIX = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

// Mirror of api/app/crosswalk/names.normalize — lowercase, drop .'` and
// generational suffixes, hyphen→space, collapse whitespace.
export function normalize(name: string): string {
  const n = name.toLowerCase().replace(/[.'`]/g, "").replace(/-/g, " ");
  return n
    .split(/\s+/)
    .filter((t) => t && !SUFFIX.has(t))
    .join(" ")
    .trim();
}

export type KeeperCsvRow = {
  rawName: string;
  name: string;
  pos: string | null; // QB/RB/WR/TE/K/DST, or null if the row didn't parse
  draftPos: string | null; // "Round 6, Pick 10" — null when undrafted ("-")
  cost: number | null; // keeper-cost round; null when ineligible/unparseable
  eligible: boolean;
  isKeeper2025: boolean;
  note: string;
};

export type BoardRow = {
  nameNormalized: string;
  fullName: string;
  pos: string;
  overallRank: number;
  posRank: number;
  vor: number;
  seasonPts: number;
  adp: number | null;
  tier: number;
};

export type KeeperAnalysis = KeeperCsvRow & {
  matched: boolean;
  overallRank: number | null;
  posRank: number | null;
  seasonPts: number | null;
  vor: number | null;
  adp: number | null;
  tier: number | null;
  projRound: number | null; // our model's projected draft round
  marketRound: number | null; // ADP round
  vorSurplus: number | null; // vor − vor of the forfeited pick (points)
  marketSurplus: number | null; // cost round − ADP round (rounds; + = value)
  verdict: Verdict;
  robust: boolean; // positive on BOTH signals
};

export type Verdict =
  | "ineligible"
  | "no-projection"
  | "strong-keep" // robust: both signals a gain
  | "value" // exactly one signal a gain
  | "reach"; // neither

// --- CSV parsing -----------------------------------------------------------

// Minimal RFC-4180-ish parser: handles quoted fields with embedded commas
// (e.g. "Round 6, Pick 10") and doubled quotes. Good enough for this sheet.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Strip Yahoo's " <TEAM> - <POS> …notes" tail off a player cell → clean name + pos.
// "Baker Mayfield TB - QB Player Note" → { name: "Baker Mayfield", pos: "QB" }
// "Eagles Phi - DEF No new player Notes" → { name: "Eagles", pos: "DST" }
const NAME_RE = /^(.*?)\s+[A-Za-z]{2,3}\s+-\s+(QB|WR|RB|TE|K|DEF)\b/;

function parsePlayerCell(cell: string): { name: string; pos: string | null } {
  const m = cell.match(NAME_RE);
  if (!m) return { name: cell.trim(), pos: null };
  return { name: m[1].trim(), pos: m[2] === "DEF" ? "DST" : m[2] };
}

// Extract one team's roster from the whole-league sheet. Section headers are rows
// with a name in col 0 and an empty Keeper-Cost (col 2); player rows always carry
// a cost cell (a number, "Ineligible", or "10" for undrafted).
export function parseKeeperCsv(text: string, team: string): KeeperCsvRow[] {
  const rows = parseCsv(text);
  const want = team.trim().toLowerCase();
  let current: string | null = null;
  const out: KeeperCsvRow[] = [];
  for (const r of rows) {
    const c0 = (r[0] ?? "").trim();
    const c1 = (r[1] ?? "").trim();
    const c2 = (r[2] ?? "").trim();
    const c3 = (r[3] ?? "").trim();
    if (!c0 && !c2) continue; // blank separator
    if (c0 === "Player") continue; // the sheet header
    const isHeader = c0 && !c2; // team section header
    if (isHeader) {
      current = c0;
      continue;
    }
    if (current?.trim().toLowerCase() !== want) continue; // not my section
    const { name, pos } = parsePlayerCell(c0);
    const note = c3;
    const notIneligibleNote = !/not eligible/i.test(note);
    const costIsNum = /^\d+$/.test(c2);
    out.push({
      rawName: c0,
      name,
      pos,
      draftPos: c1 && c1 !== "-" ? c1 : null,
      cost: costIsNum ? Number(c2) : null,
      eligible: costIsNum && notIneligibleNote,
      isKeeper2025: /2025 keeper/i.test(note),
      note,
    });
  }
  return out;
}

// --- valuation -------------------------------------------------------------

// VOR of the pick you forfeit to keep at cost round C: the board player at the
// middle of that round (overall ≈ (C−0.5)·teams), clamped to the board's range.
function vorAtRound(
  costRound: number,
  numTeams: number,
  vorByRank: Map<number, number>,
  maxRank: number,
): number {
  const overall = Math.max(1, Math.round((costRound - 0.5) * numTeams));
  const rank = Math.min(overall, maxRank);
  // walk down to the nearest populated rank (board can have gaps below the pool)
  for (let k = rank; k >= 1; k--) {
    const v = vorByRank.get(k);
    if (v !== undefined) return v;
  }
  return 0;
}

export function analyzeKeepers(
  csv: KeeperCsvRow[],
  board: BoardRow[],
  numTeams: number,
): KeeperAnalysis[] {
  const byKey = new Map<string, BoardRow>();
  const byName = new Map<string, BoardRow>();
  for (const b of board) {
    byKey.set(`${b.nameNormalized}|${b.pos}`, b);
    if (!byName.has(b.nameNormalized)) byName.set(b.nameNormalized, b);
  }
  const vorByRank = new Map(board.map((b) => [b.overallRank, b.vor]));
  const maxRank = board.reduce((m, b) => Math.max(m, b.overallRank), 0);

  const analyzed = csv.map((row): KeeperAnalysis => {
    const nn = normalize(row.name);
    const hit =
      (row.pos ? byKey.get(`${nn}|${row.pos}`) : undefined) ?? byName.get(nn);

    const base = {
      ...row,
      matched: !!hit,
      overallRank: hit?.overallRank ?? null,
      posRank: hit?.posRank ?? null,
      seasonPts: hit?.seasonPts ?? null,
      vor: hit?.vor ?? null,
      adp: hit?.adp ?? null,
      tier: hit?.tier ?? null,
      projRound: hit ? Math.ceil(hit.overallRank / numTeams) : null,
      marketRound: hit?.adp != null ? Math.ceil(hit.adp / numTeams) : null,
    };

    if (!row.eligible || row.cost == null)
      return {
        ...base,
        vorSurplus: null,
        marketSurplus: null,
        verdict: "ineligible",
        robust: false,
      };
    if (!hit)
      return {
        ...base,
        vorSurplus: null,
        marketSurplus: null,
        verdict: "no-projection",
        robust: false,
      };

    const vorSurplus =
      hit.vor - vorAtRound(row.cost, numTeams, vorByRank, maxRank);
    const marketSurplus =
      base.marketRound != null ? row.cost - base.marketRound : null;
    const modelGain = vorSurplus > 0;
    const marketGain = marketSurplus != null && marketSurplus > 0;
    const robust = modelGain && (marketSurplus == null || marketSurplus >= 0);
    const verdict: Verdict = robust
      ? "strong-keep"
      : modelGain || marketGain
        ? "value"
        : "reach";
    return {
      ...base,
      vorSurplus: Math.round(vorSurplus * 10) / 10,
      marketSurplus,
      verdict,
      robust,
    };
  });

  // best keeper = highest model surplus among the robust ones; fall back to the
  // highest model surplus overall if nothing is robust.
  return analyzed;
}

// The single recommended keeper (or null). Robust picks first, then raw model
// surplus. Returns the rawName so the UI can highlight the row.
export function bestKeeper(analyzed: KeeperAnalysis[]): string | null {
  const scored = analyzed.filter((a) => a.vorSurplus != null);
  if (!scored.length) return null;
  const robust = scored.filter((a) => a.robust);
  const pool = robust.length ? robust : scored;
  return pool.reduce((best, a) =>
    (a.vorSurplus ?? -Infinity) > (best.vorSurplus ?? -Infinity) ? a : best,
  ).rawName;
}
