# Troubleshooting

The errors you'll actually hit and how to fix them. If yours isn't here, the
most common root cause is one of the first two.

<sub>[← Back to README](../README.md) · Related:
[Configuration](configuration.md) ·
[Architecture](architecture.md)</sub>

## "migration N was previously applied but is missing"

**Symptom:** the app fails to start after you added (or switched branches with a
new) migration.

**Cause:** a migration file exists in `src-tauri/migrations/` but wasn't
registered in the `migrations` vec in `src-tauri/src/main.rs` — or you removed
one that had already been applied to the DB on disk.

**Fix:**
```bash
./scripts/reset-dev-db.sh
```
This deletes the dev `kotoba.db` so it rebuilds from the *current* set of
migrations. (You lose local progress — see
[Configuration → where your data lives](configuration.md#where-your-data-lives)
for where the DB actually is.) When adding a migration, always do **both**:
create `0NN_*.sql` *and* register it in `main.rs`. See
[Architecture → adding a migration](architecture.md#adding-a-migration-gotcha).

## Tauri commands do nothing in the browser

**Symptom:** you ran `npm run dev`, opened the app in a browser, and chat /
image / training buttons error or no-op.

**Cause:** `npm run dev` is **Vite only** — there's no Rust backend, so every
`invoke(...)` fails. Use the full app:
```bash
npm run tauri dev
```

## Chat fails / no reply

Work through these in order:

1. **Is the local model running?** The default is
   `http://localhost:8080`. `curl http://localhost:8080/v1/models` should
   respond. If you use a different host/port, set `LOCAL_LLM_BASE_URL`.
2. **Ollama users:** set `LOCAL_LLM_MODEL` to the real model name (llama-server
   ignores it; Ollama needs it to route). See
   [Configuration → switching models](configuration.md#switching-models).
3. **Starting the server with `--api-key`?** Set `LOCAL_LLM_API_KEY` to match.
4. **Model is loaded but replies are poor?** That's a model-quality issue, not a
   wiring bug. The GBNF grammar still keeps the *shape* valid; a stronger model
   gives better dialogue. See
   [Architecture → the local model & GBNF constrainting](architecture.md#the-local-model--gbnf-constraining).

## Image generation fails

- **Is ComfyUI running?** Default `http://127.0.0.1:8188` — set
  `COMFYUI_BASE_URL` if it's elsewhere.
- **Output not found / "no image" errors?** `COMFYUI_OUTPUT_DIR` must be the
  *real* filesystem path to ComfyUI's output folder (the backend globs it
  directly), not a URL. See
  [Configuration](configuration.md#comfyui-art--lora-training--optional).
- **Seed / wildcard node crash in the ComfyUI console** (Impact Pack
  `ValueError: expected non-negative integer`): this was a known issue with the
  `-1` "randomize" seed sentinel. The app now replaces negative seed sentinels
  with a real non-negative seed before submitting, so update the app and it
  should clear. See the note in
  [`src-tauri/comfyui/README.md`](../src-tauri/comfyui/README.md).

## LoRA training

- **"LoRA training script not found at …"** — set `KOHYA_TRAIN_SCRIPT` to your
  `train_anima_lora.sh`, or copy `train_anima_lora.sh.example` and fill in your
  paths. Until then the pipeline **defers training** (images + dataset still
  generate and persist) rather than failing. See
  [Character art & LoRA → training is deferred, not
  fatal](art-and-lora.md#training-is-deferred-not-fatal) and the ComfyUI setup
  guide.
- **Training refuses to start / GPU guard** — the script checks that enough VRAM
  is free before launching (override with `KOTOB_IGNORE_GPU`). The usual
  culprit is the local LLM still occupying the GPU — **stop the model server
  first** if you're training on the same card.
- **Trained LoRA doesn't resemble the character** — this is the current
  *known fidelity issue*, not a setup bug. See
  [Character art & LoRA → known issues](art-and-lora.md#known-issues-work-in-progress).

## General

- **Nothing persists / fresh data on every launch** — you're likely pointing at
  a different app-config dir than you think. The DB lives in
  `~/.config/com.rubans231.kotobanokizuna/` (Linux), keyed by the identifier,
  not in the project. See
  [Configuration → where your data lives](configuration.md#where-your-data-lives).
- **Frontend typecheck** — `npm run build` (`tsc -b && vite build`) is the only
  typecheck; there's no separate script and no test suite. Lint with
  `npm run lint`.
