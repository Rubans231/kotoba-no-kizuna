# Teaching & review

The heart of the app: how a chat turn becomes a lesson, how the relationship
drifts, and how the spaced-repetition deck stays ahead of your forgetting curve.
This is the system you touch every time you open the app, so it's worth knowing
exactly how it decides what to do.

<sub>[← Back to README](../README.md) · Related:
[Companions](companions.md) ·
[Abilities](abilities.md) ·
[Architecture](architecture.md)</sub>

## The chat loop, end to end

Open **Chat**, pick an owned companion from the pill row under the nav, and send
a message. What happens on the backend, in order:

1. **Build the system prompt** (`buildSystemPrompt` in
   `src/core/types/companion.ts`). This is where the *dynamic teaching* lives —
   it folds in the persona's personality/philosophy, the current relationship
   stats, the vocabulary you already know, your target level, the time of day,
   and any toggled-on global ability passives. The same "hello" produces a
   different lesson from Rin than from Yui, and a different one the more you
   know.
2. **Send it to your local model** via the `send_chat_message` Tauri command.
   The model can't free-format: a **GBNF grammar** pins the reply to exactly
   `{ speech, translation, vocab_introduced[], relationship_delta{} }` and
   forbids Japanese in the English-only fields. See
   [Architecture → the local model & GBNF constrainting](architecture.md#the-local-model--gbnf-constraining).
3. **Parse the reply.** `speech` is shown as her in-character line;
   `translation` is its English gloss.
4. **File every taught word.** Each entry in `vocab_introduced` becomes a row in
   the **vocab dictionary** and, if it's new, an entry in the **SRS deck**.
   Re-teaching an existing word *upgrades* the dictionary entry — a 5-star
   companion can fill in nuance/mnemonic that a 3-star one left blank — but an
   existing non-empty detail is never overwritten with blanker data.
5. **Nudge the relationship.** The `relationship_delta` (seven small integers)
   is applied to her per-instance stats, each clamped to 0–100.
6. **Check for unlocks.** If the new bond level just cleared a global ability's
   threshold, it unlocks account-wide and a red dot appears on the Abilities tab.
7. **Bump the daily commissions.** Sending a message advances *Say hello*;
   teaching N new words advances *Learn something new* by N. See
   [Daily commissions](commissions.md).

Nothing here phones home — steps 2 and the character generator are the only
things that touch the network, and both hit your local server.

## Dynamic teaching depth

This is the "rarity makes her a *better teacher*, not a stronger unit" idea made
concrete. The system prompt tells the model how much detail to fill in **per
word**, based on the companion's rarity:

| Rarity | What she fills in for each word |
|---|---|
| **3★ and below** | Brief — `word`, `reading`, `meaning` only. Nuance/mnemonic left empty. |
| **4★** | `nuance` gets a short, useful contrast or usage note. Mnemonic and related words only if one comes naturally. |
| **5★** | Full depth — `nuance` (contrast vs. a near-synonym), `mnemonic` (a real memory hook), and 2–4 `related_words`. |

Two things can override this:

- **Deep Teaching** (the global ability unlocked via Aoi, see
  [Abilities](abilities.md)) forces **maximum depth on every word regardless of
  rarity** while it's toggled on.
- **The other passives** layer *on top* of whatever depth the rarity already
  calls for: **Register Radar** (Rin) adds a register note to nuance,
  **Context Booster** (Sora) adds a real example sentence to the mnemonic, and
  **Detective's Case File** (Yui) adds a radical breakdown to the mnemonic of any
  kanji word.

Because `vocab_introduced` is only for words she *deliberately* taught that
turn, casual chat turns can (and should) introduce zero words — the deck grows
with actual teaching, not noise.

### The language rule

Her `speech` is in-character and mostly Japanese. The `translation` and
`meaning` fields must be **entirely English, zero Japanese script** — for the
word 猫, the meaning is "cat", never "cat (猫)". `nuance` and `mnemonic` are
primarily English too, but may quote the specific Japanese word or kanji being
discussed (e.g. "unlike 漠然, this implies…", "登 combines 癶 and 豆") — just no
full Japanese sentences. The grammar enforces the hard part (no Japanese in the
strictly-English fields) at the sampling level, so it holds even on weaker
models.

## The relationship system

Each **owned instance** carries seven relationship dimensions, all 0–100,
starting at 10 each except `sharedMemories` (starts at 0):

| Dimension | What moves it |
|---|---|
| `affection` | Warm, friendly exchanges in general. |
| `trust` | You're vulnerable (admit confusion, make a mistake) and she responds supportively. |
| `respect` | You demonstrate real understanding of something she taught. |
| `comfort` | Casual, low-stakes daily-life chat. |
| `friendship` | Sustained, ordinary back-and-forth. |
| `studyCompatibility` | Her teaching approach visibly clicks for you. |
| `sharedMemories` | Almost always 0; ticks up by 1 only for a genuinely memorable turn. |

The model is told to move **at most 1–2 dimensions per turn, by small integers**
— it's a slow drift, not a meter you grind. The numbers are never shown to the
player in-chat; they shape her tone (low trust = more reserved; high = warmer)
and drive two things you can see:

- **Overall bond level** = `floor(average of all 7 dimensions / 20) + 1`, so it
  runs **1–6**. This is what gates ability unlocks.
- **Her speech** — the prompt maps the raw stats to tone, so a high-bond Rin is
  noticeably more familiar than a fresh one.

## Daily routines

Every persona has a `dailyRoutine` — one line each for **morning / afternoon /
evening / lateNight** (e.g. Rin at night is "definitely supposed to be asleep
but is instead deep in a group chat rabbit hole"). The app picks the line for
the current local time:

| Block | Local hours |
|---|---|
| morning | 5:00–11:00 |
| afternoon | 11:00–17:00 |
| evening | 17:00–22:00 |
| lateNight | 22:00–5:00 |

That line is injected as "RIGHT NOW: …" so the scene is colored by what she's
doing, without her announcing it. It also feeds the art pipeline's
`backgroundStyle`/scene (see [Character art & LoRA](art-and-lora.md)).

## Review

Your taught words live in the **SRS deck** (`srs_registry`), one row per
`vocab:{word}`. When a word is first taught it's added with `easeFactor 2.5`,
`repetitions 0`, and a due time of *now* — so it shows up immediately.

The **Review** tab lists everything whose `nextReviewTime` has passed. Each card
shows the word on the front; flip it to reveal the reading, meaning, nuance,
mnemonic, and related words, then grade how well you recalled it.

### The SM-2 algorithm

Grading runs the classic **SM-2** schedule in
`src/features/language-engine/utils/srsAlgorithm.ts`:

- **Grade < 3** (you forgot it): repetitions reset to 0 and the interval resets
  to **1 day**.
- **First successful recall** (repetitions 0 → 1): interval = **1 day**.
- **Second** (repetitions 1 → 2): interval = **6 days**.
- **After that:** interval = `round(previous interval × ease factor)`.

The ease factor updates every recall with the standard SM-2 formula and is
**floored at 1.3** so a card never collapses into an infinite re-review loop.
The new interval becomes the `nextReviewTime` (today + interval days).

Reviewing a card also counts toward the *Keep it fresh* commission
([Daily commissions](commissions.md)).

> **The dictionary vs. the deck.** The *vocab dictionary* is the rich,
> human-readable record of a word (meaning, nuance, mnemonic, who taught it,
> when). The *SRS deck* is the scheduling record (ease, interval, next review).
> They're two tables keyed to the same word — one is what the word *is*, the
> other is *when you'll see it again*.
