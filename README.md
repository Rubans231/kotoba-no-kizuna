# Kotoba no Kizuna

An AI companion desktop app for learning Japanese: talk with a companion who
has her own personality and teaching philosophy, she teaches you vocabulary
naturally in conversation, and it schedules that vocabulary into spaced
repetition review automatically.

Stack: **Tauri 2 (Rust)** + **React 19 + TypeScript** + **Zustand** + **SQLite**
(via `tauri-plugin-sql`) + Anthropic API for companion dialogue + `lindera`
for Japanese morphological analysis.

## Checkpoint status (see build log in chat / commit message)

This is the "Vertical Slice v0" checkpoint: one working loop of
**chat → teach a word → review it later**, for two companions with distinct
personas (Aoi, a grammar-focused professor; Rin, a slang/internet-culture
big sister). No gacha, no Live2D, no outfits yet — those are later phases.

Frontend is verified: `npm run build` and `npx oxlint` both pass clean.
The Rust/Tauri side is written to the current Tauri v2 + tauri-plugin-sql
conventions but **has not been compiled** in this environment (no Rust
toolchain available here) — run `cargo check` inside `src-tauri` the first
time you pull this and report back anything that doesn't build.

## Setup

```bash
npm install
cp src-tauri/.env.example src-tauri/.env
# edit src-tauri/.env and paste in your ANTHROPIC_API_KEY

npm run tauri dev
```

The SQLite database (`kotoba.db`) is created automatically on first launch
and the schema in `src-tauri/migrations/001_init_schema.sql` is applied via
Tauri's migration runner.

## What's actually implemented right now

- Companion persona system (`src/data/companions.ts`,
  `src/core/types/companion.ts`) — each companion has a personality,
  specialty, and teaching philosophy that shapes the system prompt sent to
  the model every turn.
- Chat loop (`src/features/chat/`) — sends the conversation to Claude via a
  Tauri command (`send_chat_message` in `src-tauri/src/main.rs`), which
  calls the Anthropic API directly from Rust so the API key never touches
  the frontend.
- The model replies in structured JSON (speech, translation, new vocab,
  relationship delta) instead of free text, so new words can be reliably
  pulled out and scheduled for review without guessing.
- SRS engine (`src/features/language-engine/utils/srsAlgorithm.ts`) — SM-2,
  wired into a review screen (`src/features/srs/`).
- Everything persists to SQLite so progress survives a restart.
- The original NLP tokenizer sandbox (Rust `lindera` + IPADIC) is kept as a
  "sandbox" tab — useful for testing Japanese tokenization directly.

## Next phases (not built yet)

1. Multi-dimensional relationship stats (trust/respect/comfort, not just one
   affection number) and companion routines/daily life dialogue.
2. Gacha banners + currency earned from learning actions.
3. Reading/listening toolkit (hover dictionary, sentence mining).
4. A real animated companion — see the "Live2D" discussion for the current
   plan (procedural layer animation first, real rigging later).
5. Desktop assistant overlay (OCR, clipboard translation) — leverages the
   fact this is already a native Tauri app.
