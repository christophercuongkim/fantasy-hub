# 0039 — The two bindings this repo owns ship every component together, and a gate proves it

- **Status** Accepted
- **Date** 2026-10-12
- **Affects** `index.js`, `flutter/lib/seakim_flutter.dart`, `flutter/README.md` (the
  mapping table becomes an input to a check); `tool/parity-check.mjs` (new);
  `.github/workflows/ci.yml`, `scripts/hooks/pre-push`, `CLAUDE.md` (gate lists).
  [0010](0010-bindings-are-contributed-not-owned.md) is unchanged for bindings this repo
  does not own.

## Context

The library has two bindings in this repo: React (the reference) and Flutter. The owner's
standing rule is that a component exists in both or in neither. Nothing enforced it:
`tool/preview-check.mjs` derives its set from `index.js` and never opens the barrel;
`flutter/example/test/preview_coverage_test.dart` counts widget files and never opens
`index.js`; the React-to-Flutter mapping in `flutter/README.md` is prose. Each side was
complete on its own terms and nothing compared them.

It held by habit until it did not. `showSkSheet` has existed in Flutter since the first
sheet; React never got a `Sheet`, and `conformance.md` filed Sheet under On demand so the
gap read as intended. Two job-search spikes then needed a bottom sheet in React and found
nothing to vendor. Lesson 6 is the general form: a rule that binds one binding is worse
than none, because the difference between the bindings becomes an artefact of which one
someone happened to write first.

## Decision

**Every component exported from `index.js` has a widget exported from the Flutter barrel,
and every widget exported from the Flutter barrel has a component in `index.js`, in the
same PR.** `tool/parity-check.mjs` proves it and runs with the other gates.

1. The default correspondence is by name: React `PascalCase` to Flutter
   `flutter/lib/src/widgets/sk_<snake_case>.dart`. `SegmentedControl` is
   `sk_segmented_control.dart`; nothing to declare.
2. Where Flutter's idiom is a function rather than a widget (`Sheet` is `showSkSheet`,
   defined in `sk_dialog.dart`), the row in the `flutter/README.md` mapping table is the
   declaration. The check reads that table and confirms the named symbol is defined in a
   barrel-exported file. A mapping row without a definition fails.
3. Flutter-only primitives that exist to build other widgets (`SkPressable`) are listed in
   the check's allowlist with the reason. The allowlist is for primitives, not for
   components that have not been written yet; adding a component to it is the failure the
   gate exists to catch, and review treats it as one.
4. The gate runs in CI's rules job, in `scripts/hooks/pre-push` for `main`, and is listed
   in `CLAUDE.md`. Like the other static gates it reads text; it does not prove the two
   widgets behave alike. Behaviour parity stays with the spec and with review.

## Consequences

- A React-only prototype cannot merge. The cost is real on a component with a hard Flutter
  half (a drop zone, a board); the alternative is a library that is React with a Flutter
  tail.
- The README mapping table is no longer documentation only. A rename on either side without
  a table edit fails the gate, which is the point.
- Third-party bindings (0010) are untouched. This rule binds what this repo owns.

## Rejected alternatives

- **Rule without a check.** The rule existed by habit already and did not hold. 0012 says a
  rule ships with its check.
- **A manifest listing both names per component.** A second registry to keep in step
  (lesson 14 is about exactly that). The name rule plus the README table that already
  exists is one less file to forget.
- **React to Flutter only.** The direction the owner first phrased. One-way parity is
  how `showSkSheet` went unmatched for months; the reverse check is what found it.
