# 0033 — Quiet: chrome recedes, features stay

- **Status** Accepted
- **Date** 2026-09-18
- **Affects** Tier 0 §0.2, §0.3 and §0.5 in `conformance.md` (each superseded by its own
  follow-on ADR, not by this one); the default theme; `tokens/`; `readme.md`; every binding.
  Rules version 8.0.

## Context

The system's stated vibe in `readme.md` is Swiss-clean, warm, playful in motion and accent,
dark by default, density 7 of 10, "borders define, shadows lift". Three products consume it
(`fantasy-hub` at rules 3.2, `juntio` at 4.2, `job-search` at 7.0) and the owner's read
after living with it is that screens feel heavier than the features on them warrant. The
ask was a system that feels easy to use while the apps keep every feature they have.

That ask was turned into a direction by reversing six references the owner picked as the
target feel: Notion, Flighty, Cal.com, shadcn/ui, Resend, Attio. Their published CSS and
UI agree on more than expected. Four of five are light by default. All six make the primary
action neutral ink and keep hue for links, focus, selection and status. All separate
regions with whitespace and tinted surface fills, and use a 1px alpha hairline only where a
gap cannot do the job (table rows, inputs). None uses press scale or overshoot; all use
fades at or under 150ms. Controls sit at 8 to 10px radius, cards at 12. Control text is
14px. Neutral temperature varies (rec.us and Flighty warm or pure, Notion and Attio cool),
so it is not what makes them read clean.

SeaKim differed from that consensus on five levers, in order of visual weight: dark
default; opaque hairline on every in-flow element; accent on the primary button; 0.97 press
scale with spring easing; controls at 6px. It already matched on shadows (none in flow),
one accent hue, and control height (34).

Two constraints shaped the answer. Juntio is touch-first on Flutter, so a Notion-style
hover-reveal of secondary actions would cost touch users the actions. And the owner set a
standing rule for the whole revamp: **nothing is locked; a rule stays only if it still earns
its place.** Structural ADRs (0001, 0007, 0008, 0010, 0011, 0012, 0019, 0020) are not on the
table by default, but any ticket may challenge one.

The rules are at 7.0, and 7.0 itself was the precedent: 0030, 0031 and 0032 reversed
earlier aesthetic positions (0px corners, three type families). Reversing aesthetic ADRs is
a thing this repo does on purpose, by supersession, with a Major.

## Decision

The direction is named **Quiet**. Chrome recedes; features stay. Everything visible,
lighter. The following are decided here so that no follow-on ticket re-argues them; each
one that touches a Tier 0 clause is executed by its own ADR that supersedes the clause and
ships the check (0012).

1. **Light is the default theme.** Dark is a peer, neither derived from the other. §0.8
   and 0005 are unchanged; only the default flips.
2. **Whitespace and surface fills define regions. A hairline is the exception, and it is
   alpha.** Supersedes §0.2. In-flow elements still carry no shadow; overlays still lift
   (0018 still applies to them).
3. **The primary action is ink**: text color on light, inverse on dark. The app accent
   lives in links, the focus ring, selection, active navigation, and identity fills (0026,
   unchanged). Rewrites §0.3; the one-hue rule survives, its home moves.
4. **Press is a tint.** No scale, no ripple. All easing is ease-out at or under 150ms;
   spring and pop curves are removed. Supersedes §0.5. §0.9 (reduced motion) is unchanged.
5. **The radius ladder stays** (0030, 0032). Controls move to `lg` (8), cards to `xl`
   (12). Rungs with no consumer after the pass are removed then, not before.
6. **A type trial** runs on the preview surfaces: UI text 14px, weight 500 throughout,
   tracking −0.01em. Decided at the M1 checkpoint. 0031 is unchanged either way.
7. **Dark follows the same separator rule as light.** Alpha hairlines make one token work
   on both grounds.
8. **Versioning (0019): one Major, to 8.0.0**, carrying every clause change above.

What stays, on purpose: warm stone neutrals; the component catalogue; the two bindings and
spec-over-binding (0001); the DTCG token pipeline (0007); Phosphor (0009); Instrument Sans
(0031); the 4px grid and 28/34/42/44 control heights; progressive disclosure as written
(0025); the conformance tiers, gates and versioning machinery.

## Consequences

- **Three Tier 0 clauses get successors.** §0.2, §0.3 and §0.5 are retired and renumbered
  (clauses are never reused); each successor ADR carries its check, and the check reads
  token values from the token file, not names (lesson 17). A rule must bind Dart as well
  as CSS.
- **Per-app identity gets quieter.** With ink primaries, Juntio (brick) and job-search
  (sea) differ at a glance only by link, focus, selection and identity fills. The owner
  accepted this trade with the comparison in front of them.
- **Consumers lag by design.** job-search vendors an 8.0.0 release candidate first and is
  the full-feature check. Juntio's 4.2 to 8.0 migration is its own effort after 8.0.0
  ships. fantasy-hub follows on its own schedule.
- **Every contrast claim is computed** across every app hue and both themes before a value
  lands (lesson 18). The first pass (`docs/research/quiet-contrast.md`, branch
  `research/quiet-contrast`) already settles one thing: at 8 to 12% alpha a hairline sits
  at 1.2 to 1.4:1 on every surface, so it is decorative and can never be the sole marker of
  an input or focus boundary. Inputs get a fill or a stronger edge; the focus ring (3.3:1
  worst case) and ink primary (9.5:1 worst case) pass everywhere. The alpha-hairline ticket
  chooses with those numbers in hand.
- **`readme.md` becomes wrong in four places** (dark default, borders define, springy
  motion, corners) on top of the place it is already wrong (0px corners contradicts
  0030). It is rewritten after M1 lands, against what shipped.
- **Work runs in four milestones**, each ending at a review the owner signs off: M1
  foundations (tokens, this ADR's successors) on the preview surfaces; M2 components,
  React first per component, Flutter before the milestone closes; M3 the job-search
  trial; M4 ship 8.0.0 with checks matching rules.

## Enforceability

This ADR is direction and is not itself checkable. Each numbered decision that changes a
Tier 0 clause is enforced by the successor ADR that retires the clause, and that ADR is
not accepted without its check in `tool/conformance-check.mjs`, covering both bindings. A
reviewer reading a green gate after 8.0.0 should read it as "the outcome held" in the sense
`conformance.md` already gives that phrase.

## Rejected alternatives

- **Hover-reveal secondary actions**, Notion and Linear style. Punishes touch, which is
  Juntio's primary input. Lighter chrome gets most of the feel without hiding anything.
- **Cooler neutrals.** rec.us ships the same Tailwind stone ramp SeaKim already uses and
  reads clean; temperature is not the lever.
- **Reshape the ladder to three rungs** (4 / 8 / 12 plus pill). Prunes before the evidence.
  Reassign rungs, count consumers, then remove what nothing uses.
- **Keep the accent on the primary button** and lighten everything else. Every reference
  puts ink there; it is the single largest quiet move, and the identity cost was judged
  worth it.
- **Keep press scale, drop only the overshoot.** Scale still reads as playful, which is the
  trait being retired; a tint gives touch users the same feedback without motion.
- **Keep dark as the default.** All six references are light-first; Quiet reads on white.
- **Land it as additive Minors** that keep old tokens alive. That is how one package
  becomes two systems. 0011 says a Tier 0 change is a Major; this is several.
