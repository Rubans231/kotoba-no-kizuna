# Companions

The people you learn from. This page covers the curated roster, what rarity
actually means, the anatomy of a persona, and the procedurally-generated
companions the Random banner can invent.

<sub>[← Back to README](../README.md) · Related:
[Teaching & review](teaching.md) ·
[Abilities](abilities.md) ·
[Banners & economy](banners.md)</sub>

## The curated roster

Four companions ship in the box. Only **Rin** is owned at first; the rest are
earned through the banners. Each is a full persona, not a skin over the same
personality.

| Name | ID | Rarity | Archetype | Specialty | Teaching philosophy, in one line |
|---|---|---|---|---|---|
| **Rin** | `rin_slang` | ★3 | big_sister | Slang & Internet Culture | Fluency starts with how people *actually* talk — she teaches through memes, group chats, and exaggerated reactions. |
| **Sora** | `sora_news` | ★3 | idol | News & Business Japanese | Practical high-register Japanese (keigo, news, business email) is the fastest path to feeling like a "real" adult speaker. |
| **Aoi** | `aoi_grammar` | ★4 | professor | Grammar | Grammar is a skeleton, not decoration — every new pattern is traced back to a simpler one you already know. |
| **Yui** | `yui_kanji` | ★5 | detective | Kanji | No kanji is arbitrary — each has a decomposable history of radicals and etymology, and "solving" it that way makes it unforgettable. |

Rin is the deliberate low-rarity starter: she teaches the register and
everyday-vocabulary foundation, and her ★3 rarity means her per-word teaching is
brief (word/reading/meaning only) until you unlock the global passives that
deepen it account-wide (see [Abilities](abilities.md)).

## What rarity means

Rarity is **not** combat power. It's *teaching depth* — how much detail a
companion is asked to fill in for each word she teaches:

- **★3 and below** — brief (word, reading, meaning).
- **★4** — adds a useful `nuance` contrast/usage note.
- **★5** — full depth: `nuance` + `mnemonic` + 2–4 `related_words`.

So a ★5 companion produces *richer flashcards*, not a stronger unit. See
[Teaching & review → dynamic teaching depth](teaching.md#dynamic-teaching-depth)
for the exact rules and the Deep Teaching override.

## Anatomy of a persona

Every companion — curated or procedural — is a `CompanionPersona`
(`src/core/types/companion.ts`) with:

- **Identity** — `characterId`, `displayName`, `archetype`, `specialty`, `rarity`.
- **Voice** — `personality`, `teachingPhilosophy`, `speechStyle`. These three are
  what make two ★3 companions teach differently.
- **`dailyRoutine`** — four time-of-day lines (morning/afternoon/evening/
  lateNight) used to color the chat scene. See
  [Teaching & review → daily routines](teaching.md#daily-routines).
- **Art** — `visualDesignPrompt` (natural-language appearance, used for image
  generation), `visualTags` (Danbooru-style tags, used *only* for LoRA training
  captions), `backgroundStyle` (`splash` vs. `regular`), and
  `backgroundScenePrompt`. See [Character art & LoRA](art-and-lora.md).

Curated personas live in `src/data/companions.ts`; procedurally-generated ones
are stored in SQLite (`procedural_characters`).

## Characters vs. instances

A **character** (e.g. `rin_slang`) is the shared persona. An **instance** is a
specific owned copy (e.g. `inst_rin_slang`) that carries its *own* relationship
stats, outfit, favorite status, and voice lines. You can own the same character's
persona through different paths, and each instance bonds independently. The
relationship system operates on the **instance**, so two copies of the same
companion can be at different bond levels.

## Procedural companions

The **Random banner** (and the planned shop) don't pull from a fixed pool — they
*invent* a brand-new companion at runtime. `generateProceduralCharacter`
(`src/lib/characterGenerator.ts`) asks your local model to create a wholly
original character — never based on existing IP or a real person — with a
specific language specialty, a personality, a teaching philosophy, a daily
routine, and a full visual design (both a natural-language prompt and
Danbooru-style tags). The rarity is decided by the **caller** (the roulette
roll), not the model; the model only sees it as a flavor hint ("she should feel
like a rare, deeply specialized master" vs. "an approachable, everyday
companion"). Each gets a `proc_<uuid>` character ID and is stored in
`procedural_characters`, so it's a real, persistent companion — not a throwaway
summon. See [Banners & economy → Random banner](banners.md#random-banner-the-roulette)
for how you actually get one.
