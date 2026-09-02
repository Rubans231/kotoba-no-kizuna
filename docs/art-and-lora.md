# Character art & LoRA training

The optional pipeline that gives each companion a face and then *trains* a LoRA
so she renders consistently across images. It runs entirely on a local ComfyUI
install and a local kohya/sd-scripts checkout — no hosted generation.

> **Status: work in progress.** The pipeline runs end to end, but **character
> fidelity is a known open issue** — trained LoRAs currently don't render
> characters that clearly resemble their persona. That's the active work item.
> Everything below describes how the machinery works; read the
> [known issues](#known-issues-work-in-progress) section before investing a lot
> of GPU time.

<sub>[← Back to README](../README.md) · Related:
[Architecture](architecture.md) ·
[Configuration](configuration.md) ·
[ComfyUI setup](../src-tauri/comfyui/README.md)</sub>

## Why a LoRA

Image generation from a text description alone won't keep a character looking
like *themselves* — the same prompt drifts between images. A **LoRA** (a small
adapter trained on a set of images of *one* character) teaches the model that
character's face/outfit, so you can then summon a consistent version of her on
demand. That's the whole point: portrait a companion, train a LoRA on the
portraits, and she becomes reproducible.

## The pipeline stages

`runLoraPipelineForCharacter` (`src/lib/loraPipeline.ts`) walks a character
through stages, **resuming** from wherever it last stopped (each stage runs only
if its output isn't already present, so an app restart mid-pipe doesn't lose
hours of work):

| Stage | What it does |
|---|---|
| `base_image` | Generates one **character reference sheet** — A-pose, full body, neutral, white background — via the `t2i_base` workflow. This becomes the seed for everything else. |
| `view_profiles` | Generates two **IPAdapter-anchored** views (front and back) using the base image as reference (`single_ipa` workflow), so the same character is established from both sides. |
| `training_set` | Generates **24 training images** anchored to the view profiles (`double_ipa`), composed ~**40% close-up / 40% upper-body / 20% full-body** across a set of pose/expression variants. |
| `training` | Assembles a kohya-style **dataset** (numbered images + 3-segment `|||` captions + `dataset_config.toml`) and shells out to your training script to produce the `.safetensors` LoRA. |
| `complete` / `failed` | Terminal states. `failed` stores the error so the queue can move on. |

**Per character, sequential.** The queue (`src/lib/loraQueue.ts`) trains **one
character at a time** — never in parallel, since they'd fight over the same
GPU. It targets exactly the companions you *actually own right now* that don't
already have a completed LoRA (the curated starter plus any gacha/random
pulls), processes them in order, and is safe to call repeatedly (it's a no-op if
already running). A failure on one character is recorded and the queue moves to
the next.

### The trigger word

Each character gets an invented **trigger token**, not her display name —
`buildTriggerWord` takes the first 6 letters of the name plus the last 4 of the
character ID (e.g. `rin_slang` → `rin` + `lang` → `rinlang`). Training docs
recommend an invented, association-free token, so the LoRA binds to *that token*
rather than to a word the text encoder already has meaning for. The token is
stored in the pipeline state and used in the captions.

### Where things live

Everything is written to the **app data dir** (not the repo), resolved internally
by the backend so the frontend never passes writable paths:

- Generated images → `<app_data_dir>/generated_images/`
- LoRA datasets → `<app_data_dir>/lora_datasets/{character_id}/`
- Trained LoRAs → `COMFYUI_LORAS_DIR` (default `~/comfy/ComfyUI/models/loras`)

Pipeline state (stage, trigger word, every artifact path, error) is persisted in
the `character_lora_pipeline` table, which is also what the **Log** panel
(top-right) streams progress from.

### Training against the right checkpoint

The dataset is built with `use_quality_tags=false` and the script trains against
the **Aesthetic** checkpoint (`anima-aesthetic-v1.1.safetensors`) — the *same*
checkpoint the generation workflows use at inference, so a trained LoRA lines up
with the base it's applied to. (Training against Anima-Base instead would need
`use_quality_tags=true`; see the notes in
[`src-tauri/comfyui/README.md`](../src-tauri/comfyui/README.md).)

## Training is deferred, not fatal

Only the final `training` step needs your Kohya script. The base image, view
profiles, training set, and assembled dataset are all **reusable artifacts** that
generate fine without it. So if `KOHYA_TRAIN_SCRIPT` isn't configured, the
pipeline **defers training** — it stays in the `training` stage (nothing is lost)
and logs *"images + dataset ready — LoRA training deferred (set KOHYA_TRAIN_SCRIPT
and re-run)"*. The `lora_training_preflight` command is what fails fast so the
app knows to defer rather than burn GPU time on a set that can't be trained.
Once you set the script, re-running resumes right at the training step.

## Known issues (work in progress)

- **Fidelity.** The end-to-end path works (images generate, the dataset assembles,
  the LoRA trains), but the resulting LoRAs **don't yet render characters that
  clearly look like their persona** — the outputs don't obviously resemble the
  source. This is the open item. Likely contributors to investigate: the
  IPAdapter reference strength/consistency across the 24-image set, caption
  composition, and training hyperparameters (dim/alpha, steps, dropout). It is
  *not* a wiring bug in the app — the pipeline is doing what it's told; the
  model output quality is the gap.
- **VRAM.** Training is memory-hungry. The training script ships a GPU guard
  (it refuses to start unless enough VRAM is free, overridable via
  `KOTOB_IGNORE_GPU`). Running the local LLM *and* a LoRA train at the same time
  on one GPU will often not fit — stop the model server first.

To set up the ComfyUI + kohya environment the pipeline expects, follow
[`src-tauri/comfyui/README.md`](../src-tauri/comfyui/README.md). For how the
app talks to ComfyUI and the local LLM in general, see
[Architecture](architecture.md).
