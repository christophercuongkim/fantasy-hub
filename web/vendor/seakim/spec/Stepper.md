# Stepper

A labelled pipeline. Decided 2026-10-12 from the Mobbin references the job-search postings
spike collected; promoted under [0038](../decisions/0038-promote-on-a-spike.md).

## Anatomy

Steps in order, each a **node** and a **label**, with a **connector** between nodes. Three
states fall out of the current step's position: **done** (behind it: a check in a
`--surface-selected` fill), **current** (an ink fill, `--fill-primary` / `--on-primary`,
the step's number), **upcoming** (ahead: a `--border-strong` circle, the number in
`--text-tertiary`). Labels at `--type-label`; the current label in `--text-primary`, the
others secondary; an optional description line at `--type-caption`. The connector behind
the current step is `--border-strong`, ahead of it `--border-subtle`.

## Orientation

Horizontal: nodes in a row with the label under each, the connector through the nodes
(Salesforce's path, the one horizontal labelled pipeline in the references). Vertical:
nodes down the left with the label and description beside each, the connector between
nodes (Grab's, the only pipeline a phone reference showed). `auto` measures the container
and goes vertical under `md`. No dots mode: no reference labels a dot; a wizard uses
`Progress`.

## Behaviour

A display by default. With `onSelect` the steps become buttons and the app decides which
moves are legal; the component never greys a step out on its own, because which steps may
be reached is business logic, not layout. The pipeline is not the status control: pair it
with a labelled control (a `Select`-styled button or a `Sheet` on phone) that names the
current state and offers the transitions.

## What it is not

Not a wizard's progress (`Progress`). Not a checklist (`Checkbox`). Not a timeline of
events with timestamps (a list).

## Accessibility

An ordered list. The current step carries `aria-current="step"`; done and current steps
carry visually hidden text ("Completed", "Current step") so the state is announced
without relying on the fill. Nodes are decorative. With `onSelect` each step is a button
labelled by its text.

## Bindings

React `Stepper`; Flutter `SkStepper` with `SkStep` and `SkStepperOrientation`.
