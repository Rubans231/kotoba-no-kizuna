# Kotoba no Kizuna

An AI companion desktop app for learning Japanese: talk with a companion who
has her own personality and teaching philosophy, she teaches you vocabulary
naturally in conversation, and it schedules that vocabulary into spaced
repetition review automatically.

Stack: **Tauri 2 (Rust)** + **React 19 + TypeScript** + **Zustand** + **SQLite**
(via `tauri-plugin-sql`) + a **local model server** (llama-server, OpenAI-compatible)
for companion dialogue + `lindera` for Japanese morphological analysis.

Runs fully offline against your own local model - nothing is sent to a hosted API.

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
and the schema in `src-tauri/migrations/001_init_schema.sql` is applied via
Tauri's migration runner.

## What's actually implemented right now

- Companion persona system (`src/data/companions.ts`,
  `src/core/types/companion.ts`) — each companion has a personality,
  specialty, and teaching philosophy that shapes the system prompt sent to
  the model every turn.
- Chat loop (`src/features/chat/`) — sends the conversation to a local
  OpenAI-compatible server (llama-server by default) via a Tauri command
  (`send_chat_message` in `src-tauri/src/main.rs`). One model stays loaded;
  each companion is a different system prompt + separate conversation
  history against that same model, not a model swap per character (swapping
  GGUF weights per message would take seconds to minutes and kill the UX).
- The model is constrained via a GBNF grammar (`src-tauri/src/ai/client.rs`)
  to always reply in structured JSON (speech, translation, new vocab,
  relationship delta) — this matters more for local models than hosted ones,
  since they're much less reliable about just following a "reply in JSON"
  instruction on their own.
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
