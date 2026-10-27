# 0032 — Concentric corners never round more than the corner they sit in

- **Status** Accepted
- **Date** 2026-09-10
- **Affects** Tier 0 §0.14 in `conformance.md`, `spec/`; every binding. Extends
  [0030](decisions/0030-corners-take-a-radius-ladder.md)

## Context

0030 gave every component a rung by role and said nothing about what happens when one
rounded surface sits inside another. That was deliberate — at the time nothing nested — but
the ladder made nesting expressible, so the gap is now reachable: a `lg` card holding an
`xl` dialog fragment would render a corner bulging out of the corner containing it.

An external system stated the rule as *"nested corners step down by one rung, never up"*.
Taken literally that is wrong here, and the repo already contains the counter-example:
`Toast` and `EmptyState` are `none`, and both hold a `md` Button. A square toast with
rounded buttons inside it is correct and ordinary. The child's corner is nowhere near the
parent's corner, so the parent's radius has no claim on it.

The property that actually matters is **concentricity**. Two corners share a centre of
curvature only when the child's corner is flush with, or barely inset from, the parent's.
That is the case where a child rounder than its parent reads as a mistake — the child's arc
escapes the parent's. A child sitting away from the corner is not in that relationship at
all, and "one rung down" would also forbid the perfectly good `lg` card holding an `sm`
input, which skips `md`.

## Decision

**A corner that is concentric with its parent's never rounds more than the parent's.**

A corner is concentric when the child's corner is inset from the parent's by less than one
space rung — flush, or all but flush. In that relationship:

1. **The child's rung never exceeds the parent's.** Equal is allowed; larger is a defect.
2. **Prefer `parent − inset`.** With a visible inset the optically correct child radius is
   the parent's minus the gap, snapped **down** to a rung. A `lg` (8) card with an `xs` (2)
   inset wants `md` (6) — not `lg`, which would read as a bulge, and not `xs`, which reads
   as an unrelated shape.
3. **A non-concentric child takes its own role's rung**, whatever the parent is. A Button
   inside a Toast is `md` because it is a button; the Toast being `none` is irrelevant.

Clause 3 is the one that keeps this from becoming the rule it is easy to mistake it for.

## Consequences

- **It is a review obligation, not a lint.** Whether two corners are concentric depends on
  layout at render time — padding, absolute positioning, whether a child is flush with an
  edge — and none of that is legible to a line-based checker. §0.14 joins §0.2, §0.3, §0.5,
  §0.9, §0.10, §0.11 and §0.12 on the manual list, taking machine coverage from six of
  thirteen to six of fourteen.
- **Nothing in either binding changes.** Every current pairing already complies: dialogs and
  popovers (`xl`) hold buttons (`md`) and fields (`sm`); cards (`lg`) hold both; the pill
  and circle shapes are conceptually round and outside the ladder. This records a rule the
  system was already keeping by accident.
- **It adds a Tier 0 obligation**, so a contributed binding that has never been reviewed
  against it may now be non-conformant even though nothing here moved. That is precisely
  what a Major bump is for.
- Versioning (0019): **Major**. Tier 0 gains a clause.

## Enforceability

Not checkable, and this record does not pretend otherwise. What a static rule can see is
that a radius names a legal rung — §0.1 already does that. Which rung is *right* for a role
was left to review by 0030, and which rung is right *for a nesting* is the same kind of
judgement one level down.

The honest partial is a reviewer's question rather than a regex: **is this corner flush with
the one behind it, and if so, is it rounder?** `conformance.md`'s manual list carries it.

## Rejected alternatives

- **"Step down by exactly one rung."** The external phrasing. Forbids a `lg` card holding an
  `sm` input — a pairing the system ships — and still gets Toast wrong.
- **"A child never rounds more than its parent," with no concentricity test.** Simple and
  checkable-sounding, but it makes the `none` Toast holding a `md` Button a violation, which
  would push toasts and empty states to invent a rung they do not need.
- **Derive the child radius arithmetically at runtime** (`parent − padding`, unsnapped).
  Produces off-ladder values, which §0.1 forbids, and trades a judgement call for a
  precision nobody can see.
