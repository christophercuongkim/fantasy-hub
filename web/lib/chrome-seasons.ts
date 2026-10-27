import { draftSeasons } from "@/lib/draft-superlatives";
import { teamSeasons } from "@/lib/hall-of-records";

/** Union of HoR + draft seasons for the shell season control (newest first). */
export async function chromeSeasons(): Promise<number[]> {
  const [team, draft] = await Promise.all([teamSeasons(), draftSeasons()]);
  const set = new Set<number>([...team.map((t) => t.season), ...draft]);
  return [...set].sort((a, b) => b - a);
}
