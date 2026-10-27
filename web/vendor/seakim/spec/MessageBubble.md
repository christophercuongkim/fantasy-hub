# Message bubbles

A note, not a component: a chat bubble stays app code. It exists so a reviewer reading
§0.1 has an answer for a shape the radius ladder's roles did not name. Decided 2026-10-15
from Juntio's chat spike (JUN-103, option B), under
[0038](../decisions/0038-promote-on-a-spike.md); CHR-421.

## Corners

A bubble is a surface, so it takes `--radius-xl`, the card and panel rung.

Inside a **run** (consecutive messages from one sender), the corners on the sender's side
where two bubbles meet step down to `--radius-sm`, so the run reads as one block and the
flattened side says whose it is:

| Position in the run | Sender-side corners |
| --- | --- |
| Alone | all `xl` |
| First | top `xl`, bottom `sm` |
| Middle | top `sm`, bottom `sm` |
| Last | top `sm`, bottom `xl` |

The far side's corners stay `xl` throughout. Both values are rungs, so every corner still
names one (§0.1); the ladder gains nothing. Different rungs on the corners of one shape are
allowed when each corner's role differs, and here they do: a joined corner is a seam, a
free corner is the surface's edge. Nothing nests, so concentricity
([0032](../decisions/0032-concentric-corners.md), §0.14) does not apply; a reply preview
or an image inside a bubble does nest and follows §0.14 against the bubble's corner.

Own-message bubbles may share the accent identity fill (§0.3,
[0026](../decisions/0026-accent-as-ownership-fill.md)); the corners do not change with it.

## Reaction chip

A display-only reaction under a bubble (a glyph and a count, not a control) is the
**count-badge** role: `--radius-full`. When tapping it toggles your reaction it is a
control, and takes the control rung and the 44px touch floor like any other.

## Bindings

None. Flutter apps compose `BorderRadius.only` from `SkRadius.xl` and `SkRadius.sm`; web
apps the four `border-*-radius` properties from the tokens.
