# 0038 — A design spike's say-so promotes a shape into the library

- **Status** Accepted
- **Date** 2026-10-12
- **Affects** `readme.md` ("Adding an app", step 4, which this supersedes); `conformance.md`
  Tier 2 (the On demand list grows); every binding, through [0039](0039-flutter-parity.md).

## Context

The readme's rule for adding an app ends with: *do not add app-specific components to the
shared library; build them in the app and promote once a second app needs them.* It was
written when the library had two demo kits and no consumer, to stop one app's nouns leaking
into the shared vocabulary.

job-search then ran fifteen design spikes against Mobbin references (CHR-322, all decided
2026-10-12). Every spike ended "nothing upstream", and every spike named one or two
app-level pieces instead: a page header, a list row, a split pane, a stepper, a drop zone,
a gate layout, a board. None of those carries a job-search noun. They are the shapes any
second product would build on day one, and under the rule they would have been built in
the app, with its spacing and its bugs, and promoted later if anyone remembered.

The owner's call: a library exists so the next repo starts with the shapes already made.
Waiting for the second app means the second app pays for the first one's shortcuts.

## Decision

**A shape is promoted into the library when a consumer's design spike names it and it
carries no consumer noun.** "Names it" means the spike's references show the shape and its
pick depends on it. "No consumer noun" means the component's props, states and copy would
read the same in a travel app as in a job tracker; a `ScoreBar` fails, a `Meter` passes.

1. The shape follows the references, not the consumer's sketch. Where a spike's wireframe
   and its cited screens disagree, the screens win and the consumer's ticket gets an
   addendum. This is what stops a promoted component from being one app's habit in a
   library coat.
2. A promoted component lands in the **On demand** tier of `conformance.md` unless an ADR
   moves it. The tier is a promise to third-party bindings; a consumer's need does not
   raise it.
3. It ships complete: both bindings this repo owns (0039), the demo card, the preview
   manifest entry, the prompt doc, a `spec/` contract when it has anatomy worth binding,
   and a changelog line. "Built in React, Flutter later" is not promoted.
4. The readme's step 4 now reads: *build it here when a spike names it (0038); build it in
   the app only while it still carries the app's nouns.*

## Consequences

- The library grows faster than its consumers prove it out. Eleven components arrive from
  one redesign, and some will see one consumer for a long time. Dead weight is the price of
  a second app starting from a full shelf; the inventory review in each Major release
  (0011) is where unused shapes get pruned.
- A spike can be wrong, and the component inherits the error. The references rule (1) is
  the hedge, and the addendum trail on the consumer's ticket is the audit. Amended
  2026-10-13 (CHR-390): where the consumer's pick was itself made with the references in
  hand, the pick stands; rule (1) reaches a sketch nobody has checked, not a decision
  somebody has.
- Every promotion is a Minor bump under 0011; a batch of them is still one Minor.

## Rejected alternatives

- **Keep the second-app rule.** It optimises for a small library and against the next
  consumer. The owner has three consumers and wants the fourth to start whole.
- **Promote anything a consumer asks for.** Without the no-noun test, `AlumniCheckList`
  arrives next. The test is the whole rule.
- **A "candidates" tier below On demand.** A component that is in the package is in the
  package; a softer label would not change what a consumer imports.
