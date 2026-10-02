# Configuration

Everything you might need to tweak: the environment variables, where your data
actually lives, and how to point the app at a different model.

<sub>[← Back to README](../README.md) · Related:
[Architecture](architecture.md) ·
[Troubleshooting](troubleshooting.md)</sub>

## Environment variables

All configuration is **optional** — the app runs with sensible defaults and no
API key. Set a variable only when your setup differs. Values are read from a
`.env` file (see [Where the app looks for
`.env`](#where-the-app-looks-for-env) below); the template is
`src-tauri/.env.example`.

### Local model (dialogue + character generation)

| Variable | Default | Notes |
|---|---|---|
| `LOCAL_LLM_BASE_URL` | `http://localhost:8080` | Your local OpenAI-compatible server (llama-server). Change if it runs elsewhere. |
| `LOCAL_LLM_MODEL` | `local-model` | llama-server ignores this (it serves whatever GGUF you loaded). **Ollama needs the real model name** here. |
| `LOCAL_LLM_API_KEY` | *(empty)* | Only needed if you started your server with `--api-key`. |

### ComfyUI (art + LoRA training — optional)

| Variable | Default | Notes |
|---|---|---|
| `COMFYUI_BASE_URL` | `http://127.0.0.1:8188` | Your ComfyUI server. |
| `COMFYUI_OUTPUT_DIR` | `~/comfy/ComfyUI/output` | The **real filesystem path** to ComfyUI's output folder — it's a path the Tauri backend reads directly to find generated images. |
| `COMFYUI_LORAS_DIR` | `~/comfy/ComfyUI/models/loras` | Where trained LoRAs are written. Trained LoRAs are used with a plain `<lora:...>` tag; no separate registration. |
| `KOHYA_TRAIN_SCRIPT` | `comfyui/train_anima_lora.sh` (if present) | Path to your training script. If missing, LoRA **training is deferred** (images + dataset still generate) — see [Character art & LoRA](art-and-lora.md#training-is-deferred-not-fatal). |

## Where the app looks for `.env`

The backend (`load_local_env` in `src-tauri/src/main.rs`) tries, in order, the
first that exists:

1. `.env` in the binary's working directory
2. `src-tauri/.env`
3. `.env` in the compile-time manifest dir (`src-tauri/`)

`src-tauri/.env` is **gitignored** — copy `src-tauri/.env.example` to
`src-tauri/.env` and fill in what you need. Note this is the *app's own* runtime
config, separate from any tokens ComfyUI's download tooling uses.

## Where your data lives

The SQLite database (`kotoba.db`) does **not** live in the project folder. It's
in the **OS app-config directory**, keyed by the app identifier
`com.rubans231.kotobanokizuna` (from `tauri.conf.json`). On Linux that's:

```
~/.config/com.rubans231.kotobanokizuna/
```

This is deliberate: the database **survives checkouts and branch switches**.
Generated images and LoRA datasets land in the **app data dir** (a sibling of
the config dir), not in the repo — see
[Character art & LoRA → where things live](art-and-lora.md#where-things-live).

To start from a clean slate (rebuild the DB from the current migrations), run:

```bash
./scripts/reset-dev-db.sh
```

> This is also the fix for the *"migration N was previously applied but is
> missing"* error — see [Troubleshooting](troubleshooting.md).

## Switching models

The app speaks the **OpenAI-compatible** API, so any local server that implements
it works:

- **llama-server** (the default, and what the examples assume) — load a GGUF and
  point `LOCAL_LLM_BASE_URL` at it. `LOCAL_LLM_MODEL` is ignored.
  ```bash
  llama-server -m /path/to/model.gguf -c 8192 --host 127.0.0.1 --port 8080 -ngl 999
  ```
- **Ollama** — set `LOCAL_LLM_BASE_URL` to Ollama's endpoint
  (`http://localhost:11434/v1`) **and** set `LOCAL_LLM_MODEL` to the actual model
  name (Ollama uses it to route).

One model server stays loaded for the whole session; each companion is just a
different system prompt + history against that same model (see
[Architecture → the local model & GBNF constrainting](architecture.md#the-local-model--gbnf-constraining)).
Stronger, more instruction-following models give better in-character dialogue and
cleaner vocab, but the GBNF grammar keeps the output shape correct regardless.
