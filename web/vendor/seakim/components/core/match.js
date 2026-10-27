// Shared filter matchers for the searchable picker (decision 0028), so every
// long list ranks the same way instead of each consumer inventing its own. The
// Flutter mirror is flutter/lib/src/util/sk_fuzzy_match.dart — keep the two in
// step (same tiers, same bonuses, same accent-folding).

// Case- and accent-insensitive fold. NFD-decompose then strip combining marks
// handles é/ü/ñ/ç/…; the ligatures below are what NFD does not decompose.
function fold(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss');
}

/**
 * The DEFAULT combobox matcher: a predictable, tiered rank — exact, then prefix,
 * then substring, then no match. Returns 0 for a miss, or a tier score (higher
 * is better). Callers sort by score descending and keep original list order
 * within a tier. Preferred over fuzzy because it is explicable.
 */
export function skMatchScore(query, target) {
  const q = fold(query.trim());
  if (!q) return 1;
  const t = fold(target);
  if (t === q) return 300; // exact
  if (t.startsWith(q)) return 200; // prefix
  if (t.includes(q)) return 100; // substring
  return 0;
}

/**
 * Opt-in fuzzy matcher — a scored subsequence (fzf-lite): the query's chars must
 * appear in order, and the score rewards start-of-string, start-of-word, and
 * contiguous runs. Use only when the list's shape (short codes + long names)
 * justifies a scattered match; fuzzy ranking is harder for a user to predict.
 */
export function skFuzzyScore(query, target) {
  const q = fold(query.trim());
  if (!q) return 1;
  const t = fold(target);
  let score = 0;
  let from = 0;
  let prev = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const at = t.indexOf(q[qi], from);
    if (at < 0) return 0;
    let bonus = 1;
    if (at === 0) bonus += 4;
    else if (!/[a-z0-9]/.test(t[at - 1])) bonus += 3;
    if (at === prev + 1) bonus += 3;
    score += bonus;
    prev = at;
    from = at + 1;
  }
  return score;
}
