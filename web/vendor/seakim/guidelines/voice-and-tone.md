# Voice & tone

## The shared voice

**Plain, warm, and specific.** SeaKim products talk like a competent friend who respects your time. Short sentences. Concrete nouns. The user's own words, not ours.

We are:

- **Clear before clever.** "Your flight moved to 6:40am" beats "Itinerary update available."
- **Specific.** Numbers, names, times. Never "recently," "some," or "several."
- **Calm under failure.** State what happened, what it means, what to do next. No apologising twice.
- **Warm, not chummy.** No exclamation marks in system copy. No "Oops!" No "Whoops, our bad."

We are not: cute, breathless, corporate, or apologetic.

## Rules

| Do | Don't |
| --- | --- |
| Your trip to Lisbon | Your Lisbon travel experience |
| 3 seats left at this price | Hurry — almost gone! |
| Couldn't reach the airline. Retry in a moment. | Oops! Something went wrong 😬 |
| Save trip | Submit |
| Nothing here yet. Add your first leg to get started. | No data available |

- **Sentence case everywhere.** Buttons, headings, menus, table headers. Title Case is reserved for proper nouns.
- **Verbs on buttons**, and the verb matches the outcome: `Book`, `Add leg`, `Trade player`. Never `OK` for a destructive confirm — use `Delete trip`.
- **No terminal punctuation** in labels, buttons, table cells, or single-sentence tooltips. Full stops in body paragraphs and multi-sentence help text.
- **Numerals always** — "3 nights," not "three nights."
- **Times in the user's local zone**, with the zone named when a second zone is on screen: `6:40am LIS`.
- **Second person.** "Your roster," not "the user's roster" or "my roster."

## App registers

The voice is shared. The register shifts.

### Voyage — travel

Reassuring and logistical. The user is spending real money on something that matters, often while stressed. Lead with the fact that reduces anxiety.

> **Confirmed.** TAP 1043, Sat 12 Apr, 6:40am from Lisbon. Ref `QK4T9M`.
> Free to change until 8 Apr.

- Always surface: what, when, where, how much, and what's reversible.
- Money is exact and never buried: `$412` not `from $399*`.
- Never manufacture urgency. Real scarcity only, and say the source: `3 seats left at this fare`.

### Bench — fantasy sport

Fast, competitive, a little dry. The user is here for edge and banter, and checks in twelve times a day. Short lines, ranked information, opinions allowed — but only when we have data behind them.

> **Start Okafor.** 18.4 projected vs Nabhan's 11.2. He's faced this defense twice and gone over 20 both times.

- Verdicts, not hedges: `Start`, `Bench`, `Risky`. Then the number that justifies it.
- Never celebrate losses or condescend after a bad week. State the result and the next action.
- Trash talk is a feature between *users*, never from the product to the user.

## Empty, loading, error

**Empty** — say what goes here and give the one action.
> No trips yet. Plan one and it'll show up here. → `Plan a trip`

**Loading** — name the thing being fetched if it takes over a second. Never a bare spinner on a full page.
Two sanctioned treatments carry this, per [0021](../decisions/0021-loading-states.md): a **skeleton**
when you know the shape of what is arriving, and a **labeled loading state** (`LoadingState` / `SkLoadingState`)
when you know only that something is.
> Checking 40 airlines…

**Error** — cause, consequence, next step. One sentence each, max.
> Payment declined by your bank. The seats are held for 9 more minutes. → `Try another card`

## Numbers & units

- Currency: symbol, no space, no trailing zeros on whole amounts — `$412`, `$412.50`.
- Large numbers: thin-space or comma grouping, never abbreviated below 10,000.
- Percentages: no decimal unless below 10% — `64%`, `4.2%`.
- Ranges use an en dash without spaces: `6:40–9:15am`, `$380–$460`.
