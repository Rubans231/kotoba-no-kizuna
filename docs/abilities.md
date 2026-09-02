# Abilities

Companions don't just teach you words — bonding with them permanently upgrades
*how every companion teaches you*. The **Abilities** tab is where these global
passives live.

<sub>[← Back to README](../README.md) · Related:
[Teaching & review](teaching.md) ·
[Companions](companions.md)</sub>

## The core idea

Each companion has **one signature ability**. Unlocking it is a *permanent,
account-wide* upgrade: once earned, the effect applies to **every** companion's
teaching, not just the one who unlocked it. This is the "your account becomes
more capable over time" design — the same word taught by Rin later gets richer
because of an ability you unlocked months ago.

An ability unlocks when **both** are true:

1. You **own** the character that sources it, and
2. Your **bond level** with that character reaches its `requiredBondLevel`.

Unlocking is checked automatically after each chat turn (see
[Teaching & review → the chat loop](teaching.md#the-chat-loop-end-to-end), step 6).
When something new unlocks, a **red dot** appears on the Abilities tab until you
visit it.

## The four passives

| Ability | Unlocked via | Bond level | Effect (applies to *all* companions once on) |
|---|---|---|---|
| **Register Radar** | Rin (`rin_slang`) | 2 | Every word's `nuance` notes its register — casual/slang, neutral, or formal/written. |
| **Context Booster** | Sora (`sora_news`) | 2 | Every word's `mnemonic` gets a short real-world example sentence using it. |
| **Deep Teaching** | Aoi (`aoi_grammar`) | 3 | Every companion teaches at **maximum depth** (nuance + mnemonic + related words) regardless of her own rarity. |
| **Detective's Case File** | Yui (`yui_kanji`) | 4 | Any word containing kanji gets a radical/component breakdown in its mnemonic. |

These are implemented as **prompt injections**, not code branches: when a
passive is toggled on, its instruction line is appended to the system prompt's
"ACTIVE LEARNING TOOLS" block (see `abilityInstructions` in
`src/core/types/companion.ts`). That's why they stack cleanly and apply
regardless of who's talking.

**Deep Teaching** is the big one — it's a blanket override of the
rarity-based teaching depth, so your ★3 companions suddenly produce ★5-quality
flashcards. The other three *layer on top* of whatever depth the rarity already
calls for. See [Teaching & review → dynamic teaching
depth](teaching.md#dynamic-teaching-depth).

## Toggling

Unlocking is permanent, but you can **toggle any unlocked ability on or off** in
the tab. Off abilities simply stop being injected into the prompt — useful if,
say, you find the radical breakdowns noisy for a while. Your set of unlocked
abilities and your set of *enabled* ones are tracked separately (in the
`user_profile` row), so toggling never erases an unlock.
