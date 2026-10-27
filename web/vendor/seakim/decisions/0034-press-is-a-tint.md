# 0034 — Press is a tint, and nothing overshoots

- **Status** Accepted
- **Date** 2026-09-18
- **Affects** Tier 0 §0.5 (retired) and §0.15 (new) in `conformance.md`; `tokens/motion.css`;
  `SkMotion` and `SkPressable`; every control in both bindings. Executes decision 4 of
  [0033](0033-quiet.md).

## Context

The motion rules were written to feel playful: enters and toggles overshot on a spring
curve, badges and knobs popped harder, and every press scaled the control to 0.97. §0.5
existed to keep Material's ink ripple out, and it did that by naming the scale as the one
permitted press treatment. `readme.md` lists "playful in motion" as a trait of the system.

0033 retires playful. Of the six references it reversed, none scales on press and none
overshoots; every transition is a fade or a short ease-out at or under 150ms. In the
round-three comparison the owner held the three treatments side by side (0.97 with a
spring release; 0.97 on ease-out; a tint with no transform) and chose the tint.

Two facts about this repo shaped the mechanics. Flutter press was centralised in
`SkPressable`, which wrapped every builder in an `AnimatedScale`; nine widgets opted out
with `pressScale: 1` and two (Card, Slider) tuned it. React press was per-component: Button,
IconButton and Slider each set a `transform` on their pressed state, and every other
component already tinted through its `*-active` fill tokens. So the tint already existed
almost everywhere; the scale was layered on top of it.

## Decision

**Press feedback is the control's active fill. No scale, no ripple, nothing moves.**
**Every easing eases out, and every duration is at or under 150ms.**

1. `--press-scale`, `--press-scale-lg`, `--ease-spring`, `--ease-pop` and
   `--transition-spring` are removed. `--ease-out` is the only curve. `--transition-enter`
   (transform and opacity on `--ease-out`) replaces `--transition-spring` for enters.
2. Durations: instant 80, fast 100, base 120, slow 150. Slow is the ceiling. The skeleton
   shimmer loop (0021) is the one exemption; it is a loop, not a transition.
3. `SkMotion` drops `spring`, `pop`, `pressScale` and `pressScaleLarge`. `SkPressable`
   drops the `pressScale` parameter and the `AnimatedScale`; the builder paints press from
   `SkInteraction.livePress`. A tappable surface that had no tint (Card, table rows,
   combobox options) now uses `surfaceActive` while pressed.
4. §0.5 is retired and its number is not reused. §0.15 states the rule. It is
   machine-checked two ways: `overshoot-easing` reads both motion token files and fails on
   any curve control point above 1 or any non-shimmer duration above 150ms; `press-transform`
   flags a retired token, a `scale(` tied to a pressed or active state, or an `AnimatedScale`
   driven by press.
5. §0.9 (reduced motion) is unchanged in intent: durations collapse to zero. The tint is
   not motion and stays, so a reduced-motion user still sees that a press registered.

## Consequences

- **Rules 8.0.** A Tier 0 clause changed. This is the first 8.0 change to land, so the
  version, CHANGELOG, `package.json` and `flutter/pubspec.yaml` move here (lesson 16); the
  CHANGELOG entry stays undated until 8.0.0 ships. The Flutter binding goes to 5.0.0
  because `SkPressable`'s public API lost a parameter.
- **Enter animations lose their bounce.** Toast, dialog, switch knob, tab indicator and
  the tab bar icon now settle on ease-out. The toast's 8px rise and the tab bar's 1px lift
  stay; they are motion, not overshoot.
- **A consumer that read the removed tokens breaks at build time**, which is the honest
  outcome for a Major. job-search vendors 7.0 and finds out at the M3 trial.
- **The checker reads values, not names** (lesson 17). Renaming a spring curve to
  `--ease-out` would still fail `overshoot-easing`, because the control points are what
  the gate reads.

## Rejected alternatives

- **Keep the 0.97 scale, drop only the spring release.** Scale still reads as playful, the
  trait being retired, and it is the one press treatment that behaves differently on a
  touch surface (the finger covers the change).
- **Add a `--press-tint` overlay token.** Every control already has an active fill token;
  a second mechanism for the same state is the two-interpretations problem 0012 warns
  about.
- **Leave §0.5 in place and reword it.** A clause that said "scale" now says "tint";
  readers citing §0.5 from old reviews would mean the opposite thing. Retire and renumber,
  as `conformance.md` already requires.
- **Cap durations at 200ms to keep the sheet slide.** Every reference sits at or under
  150ms; a sheet at 150ms reads as quick, not abrupt.
