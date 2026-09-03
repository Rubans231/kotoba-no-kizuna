# Kotoba no Kizuna

**Kotoba no Kizuna** (言葉の絆, "bonds of words") is an offline, AI-companion
desktop app for learning Japanese the way you'd actually learn it from people:
by talking. You summon a cast of companions — each a different personality with
a different teaching philosophy — and simply chat with them. They weave new
vocabulary into the conversation, the app quietly files every word into a
spaced-repetition deck, and you review those cards when they're due. Rarity
doesn't make a companion a "stronger unit"; it makes her a *better teacher*.

Everything runs on your own machine against your own local model. Nothing is
sent to a hosted API, ever.

```
        you  ──►  chat with a companion  ──►  she teaches a word in context
                                                        │
        gems / shards ◄── daily commissions            ▼
                                                        │
        you  ◄── review due cards (SM-2)  ◄──  SRS deck + vocab dictionary
                                                        │
        companions ◄── gacha / random banner ──  bond & abilities unlock
```

## Checkpoint status (see build log in chat / commit message)

Current state, in order of what landed:

1. **Rust wouldn't compile** - `lindera-tokenizer = "0.34.0"` never existed
   (that split-crate family is deprecated, frozen at 0.32.3). Migrated to
   the maintained unified `lindera` crate (4.x) - `Segmenter` + `Tokenizer`
   + `load_dictionary("embedded://ipadic")`. This has been compiled and run
   successfully (there's a real `Cargo.lock` to prove it).
2. **Blank screen after summoning a companion, and chat's top/bottom bars
   requiring a scroll to reach** - both were the same root cause: leftover
   Vite-template CSS on `#root` used `min-height` instead of a bounded
   `height`, so long content grew the whole page instead of scrolling
   internally, carrying the nav bar and chat composer off-screen with it.
   Fixed the height chain end-to-end (`index.css`, `App.tsx`, `ChatPanel.tsx`)
   and added a "Chat now" button on freshly-pulled companions plus a
   defensive auto-recovery if the active companion ever points at nothing.
3. **Review cards only showed the bare word** - rebuilt as a real flip-card:
   word first, "Show Answer" reveals reading/meaning/nuance/mnemonic/related
   words, *then* you grade. Needed a new `vocab_dictionary` table (migration
   4) since that teaching detail wasn't persisted anywhere queryable before.
4. **"migration N was previously applied but is missing"** - not an app bug;
   see Troubleshooting below for why, plus a reset script.
5. **Teaching replies sometimes drifted into pure Japanese for fields meant
   to be English** (a known weakness in some local models' multilingual
   instruction-following, not unique to this app). Rather than just asking
   more firmly, the GBNF grammar (`src-tauri/src/ai/client.rs`) now
   physically excludes Japanese Unicode ranges (hiragana, katakana, CJK
   ideographs, fullwidth forms) from `translation`/`meaning`/`nuance`/
   `mnemonic` at the character-sampling level - the model is incapable of
   emitting Japanese there regardless of model quality. `speech`/`word`/
   `reading`/`related_words` are untouched since those should contain
   Japanese.
6. **Abilities system** - one signature global passive per companion
   (`src/data/abilities.ts`), unlocked permanently by owning her and
   reaching a bond level, then toggleable on/off. Unlocking one applies its
   effect to *every* companion's teaching, not just hers. New Abilities tab
   with progress bars and toggles, plus a nav badge for unseen unlocks.
7. **Random banner** - a separate acquisition path from the curated
   Standard/Special gacha: a roulette pull (1-in-6 hit chance, 68/25/7 split
   across 3/4/5-star given a hit) that, on a hit, generates a brand-new
   companion via the local model rather than drawing from a fixed pool -
   genuinely unique per player. Second currency (shards), roster cap with
   discard/wager-to-reroll options once full.

Frontend is verified: `npm run build` and `npx oxlint` both pass clean.
Ability unlock logic (ownership + bond-level gating, no double-unlocking)
and the roulette odds (300k+ simulated pulls landing within statistical
noise of the specified 1/6, 68%, 25%, 7% targets) were both smoke-tested
directly, not just written and assumed correct. Both GBNF grammars were
checked with a hand-written structural validator (rule references resolve,
brackets/quotes balance) since no llama.cpp grammar parser is available in
this environment - worth a real test run against llama-server to confirm
the language restriction and character generation behave as intended in
practice.
The Rust side compiles and runs (per the working `Cargo.lock`) as of the
lindera migration; the newer changes in `main.rs`/`client.rs` since then
(migrations 4-6, the grammar rewrite, the character-generation endpoint)
have not been separately re-verified with a fresh `cargo build` in this
environment - that's still worth doing after pulling this.

## Setup

```bash
npm install

# In a separate terminal, start your local model server first:
llama-server -m /path/to/model.gguf -c 8192 --host 127.0.0.1 --port 8080 -ngl 999

npm run tauri dev
```

No API key needed by default. If you changed llama-server's host/port, or
started it with `--api-key`, copy `src-tauri/.env.example` to
`src-tauri/.env` and set `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_API_KEY` there.

### Switching models

The app doesn't know or care which model is loaded — it just talks to
whatever's on `LOCAL_LLM_BASE_URL`. Swapping models is purely a llama-server
launch-command concern, no app changes needed:

```bash
# Whatever you're already running, e.g. Gemma 4 26B A4B (MoE, fits 12GB VRAM
# via expert offload):
llama-server -m gemma-4-26b-a4b-Q4_K_M.gguf -c 8192 --host 127.0.0.1 --port 8080 -ngl 999

# Hermes 4 14B (dense, Qwen3-14B base) - fits fully in 12GB VRAM at Q4_K_M
# with room to spare for context, no offloading tricks required:
llama-server -m Hermes-4-14B-Q4_K_M.gguf -c 8192 --host 127.0.0.1 --port 8080 -ngl 999
```

Just restart llama-server with the new `-m` path and the app picks it up on
the next message - no rebuild.

The SQLite database (`kotoba.db`) is created automatically on first launch
and the schema in `src-tauri/migrations/001_init_schema.sql` (plus later
numbered migration files) is applied via Tauri's migration runner.

### Troubleshooting

**"migration N was previously applied but is missing in the resolved
migrations"** — this means the db file on disk has a migration recorded as
applied that the currently-running code doesn't register. The important
thing to know: `kotoba.db` does **not** live in this project folder. It
lives in your OS's app-config directory, keyed by the app identifier in
`tauri.conf.json` (`com.rubans231.kotobanokizuna`):

- Linux: `~/.config/com.rubans231.kotobanokizuna/kotoba.db`
- macOS: `~/Library/Application Support/com.rubans231.kotobanokizuna/kotoba.db`
- Windows: `%APPDATA%\com.rubans231.kotobanokizuna\kotoba.db`

That means it persists across git checkouts, branches, and patches. If you
ever run a build whose migrations list doesn't match what an earlier run
recorded (jumping to an older commit, or a patch conflict that silently
dropped a `Migration { ... }` entry from `main.rs`), the plugin refuses to
start rather than guess. During active development this is expected and
low-stakes — it's a throwaway dev database — so the fix is just to delete
it and let it rebuild fresh from the current migrations:

```bash
./scripts/reset-dev-db.sh
```

(Windows: delete the `kotoba.db` file at the path above manually.)

## What's actually implemented right now

- Companion persona system (`src/data/companions.ts`,
  `src/core/types/companion.ts`) — 4 companions across 3 rarities (Rin ★3,
  Sora ★3, Aoi ★4, Yui ★5), each with a personality, specialty, and teaching
  philosophy that shapes the system prompt every turn. Only Rin starts
  owned; the rest are earned through the gacha.
- Chat loop (`src/features/chat/`) — sends the conversation to a local
  OpenAI-compatible server (llama-server by default) via a Tauri command
  (`send_chat_message` in `src-tauri/src/main.rs`). One model stays loaded;
  each companion is a different system prompt + separate conversation
  history against that same model, not a model swap per character (swapping
  GGUF weights per message would take seconds to minutes and kill the UX).
- The model is constrained via a GBNF grammar (`src-tauri/src/ai/client.rs`)
  to always reply in structured JSON, including per-word nuance/mnemonic/
  related-word fields that a companion is instructed to fill in more or less
  based on her rarity — the "rarity makes you a better teacher, not a
  stronger unit" idea from the design doc. `translation`/`meaning`/`nuance`/
  `mnemonic` are further constrained to a character class that excludes
  Japanese Unicode ranges entirely, so those fields can't drift into
  Japanese regardless of model quality — `speech`/`word`/`reading`/
  `related_words` are left unrestricted since those should contain Japanese.
- SRS engine (`src/features/language-engine/utils/srsAlgorithm.ts`) — SM-2,
  wired into a proper flip-card review screen (`src/features/srs/`): word
  first, "Show Answer" reveals reading/meaning/nuance/mnemonic/related
  words from the new vocab dictionary, then you grade based on actual
  recall. Higher-rarity companions re-teaching an already-known word will
  fill in nuance/mnemonic that a lower-rarity companion left blank, without
  ever overwriting existing detail with blanker data.
- **Abilities** (`src/data/abilities.ts`, `src/features/abilities/`,
  `src/lib/abilityUnlocks.ts`) — one signature global passive per companion,
  unlocked permanently by owning her and reaching a bond level, then
  toggleable on/off. Unlocking one applies its effect to every companion's
  teaching, not just hers (e.g. Aoi's "Deep Teaching" forces max teaching
  depth account-wide once toggled on). New Abilities tab shows locked
  abilities with a bond-level progress bar, unlocked ones with a toggle, and
  the main nav gets a badge dot when there's an unseen unlock.
- **Random banner** (`src/features/randomBanner/`, `src/lib/randomBanner.ts`,
  `src/lib/characterGenerator.ts`) — a separate acquisition path from the
  curated Standard/Special gacha. Pull mechanic is a roulette: 1-in-6 chance
  of any character, and given a hit, 68%/25%/7% split across 3/4/5-star
  (verified against 300k simulated pulls). Every hit invents a brand-new,
  never-before-seen companion via the local model (name, personality,
  archetype, teaching philosophy, daily routine, and a visual design prompt
  saved for a future art-gen pipeline) — genuinely unique per player, not
  drawn from a fixed pool. Costs a second, cheaper currency (**shards**,
  separate from gems) so it doesn't compete with the curated banners'
  economy. Roster is capped (12 by default) since an unbounded number of
  characters becomes unmanageable; once full, you either **discard** a
  random companion outright or **wager** her on one more spin - win and
  she's replaced by a fresh mystery character, lose and she's gone. Random
  characters are fully chattable (same chat/SRS/relationship systems as the
  curated cast) via a persona resolver that looks in both the static roster
  and the generated one - but they don't have abilities, since those are
  tied to the four named curated companions specifically.
- **Daily commissions** (`src/features/commissions/`) — 3 daily tasks (talk,
  learn 3 words, review 10 cards) that award gems on completion/claim.
- **Gacha** (`src/features/gacha/`, `src/lib/gacha.ts`) — a real weighted
  pull (70/25/5 by rarity) with hard pity at 10 pulls and duplicate refunds,
  against a roster you can extend by adding entries to `companions.ts`. This
  is the curated Standard banner - kept deliberately separate from the
  Random banner above.
- **Relationship depth** (`src/lib/relationship.ts`,
  `src/features/chat/components/RelationshipBars.tsx`) — seven tracked
  dimensions per companion (trust, respect, comfort, friendship, affection,
  study compatibility, shared memories), each nudged independently by the
  model based on what actually happened in the turn, visible as a
  collapsible bar panel under her name in chat.
- **Daily routines** (`src/lib/companionStatus.ts`) — each companion has a
  morning/afternoon/evening/late-night activity that changes with real time
  of day, shown as a status line in chat and fed into her system prompt so
  she can reference it naturally.
- Everything persists to SQLite so progress survives a restart.
- The original NLP tokenizer sandbox (Rust `lindera` + IPADIC) is kept as a
  "sandbox" tab — useful for testing Japanese tokenization directly.

## Roadmap

1. **Rotating shop** - same procedural character pool as the Random banner,
   but a small curated selection refreshed daily (low rarity) / weekly (high
   rarity) for direct purchase instead of RNG pulls.
2. **AI-generated character art** - a Rust HTTP client analogous to the
   llama-server integration, hitting a local ComfyUI instance with the
   `visual_design_prompt` already being generated and saved per character,
   using the Hoseki LustrousMix Anima checkpoint. Not started, and can't be
   tested in the environment this was built in (no GPU, no reachable
   ComfyUI/civitai) - the Rust side can be written following the existing
   local-server pattern, but needs real testing on a machine that has
   ComfyUI running.
3. Events (seasonal banners/stories) and outfits — see the See-through /
   StretchyStudio discussion for the art pipeline plan there too.
4. Reading/listening toolkit (hover dictionary, sentence mining) — reuses
   the tokenizer that's already there.
5. A real animated companion — see the "Live2D" discussion for the current
   plan (procedural layer animation first, real rigging later).
6. Desktop assistant overlay (OCR, clipboard translation) — leverages the
   fact this is already a native Tauri app.
7. **Adventure gacha** (mid-term) - a Red Light/Green Light + dice-driven
   event run as an alternate pull mechanic, with power-ups and hazards along
   the way.
8. **Living worlds** (far future) - 3D character/environment generation with
   auto-rigging, for real-time interactive bonding.
