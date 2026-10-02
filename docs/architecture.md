# Architecture

How Kotoba no Kizuna fits together under the hood. If you want to change
behavior, this is the map of where things live and how they talk to each other.

<sub>[← Back to README](../README.md) · Related:
[Configuration](configuration.md) ·
[Teaching & review](teaching.md) ·
[Character art & LoRA](art-and-lora.md)</sub>

## The big picture

```
┌─────────────────────────────  Tauri window  ─────────────────────────────┐
│  React 19 + TypeScript (frontend)                                        │
│  ├── Zustand store (src/store/slices/*)  ← in-memory, hydrated from DB   │
│  ├── features/*  (chat, srs, gacha, randomBanner, abilities, …)          │
│  └── lib/*       (pure logic: gacha, relationship, srsAlgorithm, …)      │
│        │                                                                  │
│        │  invoke('command_name', args)                                   │
│        ▼                                                                  │
│  Rust backend (src-tauri/src/)                                            │
│  ├── main.rs          Tauri commands + migration registration            │
│  ├── ai/client.rs     local LLM client + GBNF grammars                   │
│  ├── ai/comfyui.rs    ComfyUI image generation                           │
│  ├── ai/lora_training.rs  dataset assembly + training-script invocation   │
│  └── nlp/analyzer.rs  lindera (IPADIC) tokenizer                         │
└───────────────────────────────────────────────────────────────────────────┘
        │                          │                            │
        ▼                          ▼                            ▼
  llama-server            SQLite (kotoba.db)            ComfyUI + kohya
  (local, OpenAI-         (tauri-plugin-sql,            sd-scripts (LoRA
   compatible)            app-config dir)                training)
```

- **Frontend** (`src/`) is a normal React app. It keeps all live state in
  **Zustand** slices and hydrates them from SQLite at startup
  (`App.tsx`), then writes back through `lib/db.ts`.
- **Backend** (`src-tauri/src/`) exposes a small set of **Tauri commands**
  (registered in `main.rs`). The frontend never talks to llama-server,
  ComfyUI, or the database directly — it always goes through a command.
- **Persistence** is SQLite, applied via Tauri's migration runner from
  `src-tauri/migrations/0NN_*.sql`.

## Tauri commands

The full command surface (all in `src-tauri/src/main.rs`):

| Command | Purpose |
|---|---|
| `send_chat_message` | Forward a chat turn (system prompt + history + message) to the local LLM; return the raw structured reply. |
| `generate_character_concept` | Ask the local LLM to invent a new companion persona (Random banner / shop). Returns raw JSON. |
| `generate_character_image` | Generate one image via ComfyUI using a named workflow config; return the saved PNG path. |
| `assemble_lora_dataset` | Build a kohya-style training dataset (numbered images + 3-segment captions + `dataset_config.toml`) from generated images. |
| `train_character_lora` | Shell out to the user's Kohya training script for a character's dataset; return the resulting LoRA path. |
| `lora_training_preflight` | Fail fast if the training script is missing (so we don't generate a set that can't be trained). |
| `tokenize_japanese_text` | Tokenize Japanese text with `lindera` (IPADIC); return morphemes. |

## The local model & GBNF constrainting

All AI runs against a **local OpenAI-compatible server** (llama-server by
default at `http://localhost:8080`). One model stays loaded the whole time; each
companion is just a *different system prompt + conversation history* against that
same model (swapping GGUF weights per message would take seconds-to-minutes and
kill the UX).

The model is **not** trusted to format its own output. `ai/client.rs` ships two
**GBNF grammars** that pin the JSON shape *at the sampling level*:

- **`REPLY_GRAMMAR`** — forces every chat reply into the exact
  `{ speech, translation, vocab_introduced[], relationship_delta{} }` object.
- **`CHARACTER_GRAMMAR`** — forces character-generation output into the exact
  persona JSON.

Crucially, the reply grammar also **excludes Japanese Unicode ranges**
(hiragana, katakana, CJK ideographs, fullwidth forms) from the
`translation` / `meaning` / `nuance` / `mnemonic` fields. That's a defense
against a known weakness of some local models — drifting into pure Japanese in
fields meant to be English. With the grammar, the model is *incapable* of
emitting Japanese there regardless of model quality. `speech` / `word` /
`reading` / `related_words` are deliberately left unrestricted, because those
*should* contain Japanese. If you edit these grammars, preserve both properties
(the shape pinning **and** the per-field character classes).

## Data & persistence

Everything meaningful is in SQLite (`kotoba.db`), which lives in the OS
app-config directory — **not** the project folder — so it survives checkouts
and branch switches. See [Configuration → Where your data lives](configuration.md#where-your-data-lives).

The schema (built by migrations 1–10):

| Table | Holds |
|---|---|
| `user_profile` | One row: username, level, XP, gems, shards, pity counter, unlocked/enabled ability IDs. |
| `companions` | One row per *owned instance*: character_id, affection, `relationship_stats` (JSON), outfit, favorite, voice lines. |
| `conversation_logs` | Full message history per instance (FK → companions, cascades). |
| `srs_registry` | One row per learnable item (vocab/kanji/grammar): SM-2 ease factor, interval, repetitions, next/last review times. |
| `vocab_dictionary` | One row per word: reading, meaning, nuance, mnemonic, related words, who taught it, when. |
| `daily_commissions` | Per-date task rows: target, progress, completed, claimed, reward. |
| `procedural_characters` | Random-banner / shop companions invented by the model. |
| `character_art` | Generated image paths per character (base, banner, splash, chat background). |
| `character_lora_pipeline` | Per-character pipeline stage + artifacts (trigger word, base/view/training paths, LoRA path, error). |

A few conventions worth knowing:

- **Instances vs. characters.** A *character* (e.g. `rin_slang`) is the shared
  persona; an *instance* is a specific owned copy (`inst_rin_slang`). You can
  own the same character's persona through different acquisition paths, and each
  carries its own relationship stats.
- **Vocab upsert never downgrades.** When a word is re-taught, the dictionary
  entry is updated, but an existing non-empty nuance/mnemonic is never
  overwritten with blanker data — so a 5-star companion re-teaching a word a
  3-star one taught shallowly *fills in* the detail rather than erasing it.
- **JSON-in-SQLITE.** List/struct fields (`relationship_stats`,
  `unlocked_abilities`, `view_profile_paths`, …) are stored as JSON strings and
  (de)serialized at the TypeScript boundary.

## Japanese NLP sandbox

The **Sandbox** tab is a direct window into the Rust tokenizer. It calls
`tokenize_japanese_text`, which uses the maintained, unified **`lindera`** crate
(4.x) with the embedded IPADIC dictionary — *not* the old frozen
`lindera-tokenizer` split-crate family. It returns, per token: `surface`,
`feature` (POS/grammar features), `reading`, and `base_form`. This is the same
morphological engine that will back the future reading/sentence-mining toolkit.

## Where frontend logic lives

- `src/features/<name>/` — feature folders (chat, srs, gacha, randomBanner,
  abilities, commissions, language-engine/dev sandbox, activityLog).
- `src/lib/` — **pure** logic, no React: `srsAlgorithm` (SM-2), `gacha`,
  `randomBanner`, `relationship`, `abilityUnlocks`, `loraPipeline`,
  `characterGenerator`, `personaResolver`, `companionStatus`, `db`.
- `src/data/` — static content: `companions`, `abilities`, `commissions`,
  `gachaBanner`.
- `src/store/slices/` — one Zustand slice per concern (profile, companions,
  chat, srs, commissions, vocab, abilities, procedural characters, lora
  pipeline, log, ui).
- `src/core/types/` — shared TypeScript types.

## Adding a migration (gotcha)

Create `src-tauri/migrations/0NN_*.sql` **and** register it in the `migrations`
vec in `src-tauri/src/main.rs`. Forgetting the registration makes the next
launch fail with *"migration N was previously applied but is missing"*. Fix it
with `./scripts/reset-dev-db.sh`. See [Troubleshooting](troubleshooting.md).
