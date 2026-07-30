# ComfyUI integration

This app calls a local ComfyUI instance (default `http://127.0.0.1:8188`,
override with `COMFYUI_BASE_URL`) to generate character art, using the
Anima checkpoint (`anima-aesthetic-v1.1.safetensors`, Qwen-Image
architecture - not SDXL/Illustrious, despite earlier confusion on our part).
Official model page: https://civitai.com/models/2458426/anima-official,
HF repo: https://huggingface.co/circlestone-labs/Anima.

## Setup

1. Run `setup_comfyui.py` (adapted from an existing launch script) to
   install ComfyUI via `comfy-cli`. The custom node list and model
   downloads are filled in with confirmed real values - see the top of
   that file. Nodes install via `comfy node install <name> --uv-compile`;
   two Anima-specific nodes (the IPAdapter and the LLLite ControlNet, the
   latter not wired into any current workflow) aren't in the node registry
   and are git-cloned directly. This also downloads **two checkpoints** -
   `anima-aesthetic-v1.1.safetensors` for generation (what the workflows in
   `workflows/` use) and `anima-base-v1.0.safetensors` for LoRA training
   (anima_train_network.py trains against Base, not Aesthetic - see the
   note in `train_anima_lora.sh.example`) - plus the Qwen3 text encoder and
   Qwen-Image VAE, needed for both.
2. **API tokens for model downloads**: these are NOT this app's own
   `src-tauri/.env` (that file is for the app's own runtime config, like
   `LOCAL_LLM_BASE_URL`). `comfy model download` reads `HF_API_TOKEN` and
   `CIVITAI_API_TOKEN` directly from your shell environment - export them
   before running `setup_comfyui.py`:
   ```bash
   export HF_API_TOKEN=hf_...
   export CIVITAI_API_TOKEN=...
   python setup_comfyui.py
   ```
   Most of the HF downloads here don't actually require a token (public
   files), but the Civitai-hosted eye detector does - that download is
   skipped with a warning if `CIVITAI_API_TOKEN` isn't set, rather than
   failing the whole script.
3. Set env vars if your setup doesn't match the defaults:
   - `COMFYUI_BASE_URL` (default `http://127.0.0.1:8188`)
   - `COMFYUI_OUTPUT_DIR` - **the real filesystem path** to ComfyUI's
     output folder (e.g. `/home/robin/comfy/ComfyUI/output`). This has to
     be a path the Tauri app can read directly - we locate generated
     images by filename-glob here rather than trusting `/history`'s exact
     schema for your custom "Image Saver Simple" node (unverified whether
     it matches vanilla `SaveImage`).
   - `COMFYUI_LORAS_DIR` - where trained LoRAs get written (default
     `ComfyUI/models/loras`, matching what you said you're most familiar
     with - trained LoRAs land there and get used with a plain `<lora:...>`
     tag, no separate registration step needed).
   - `KOHYA_TRAIN_SCRIPT` - path to your training script (default
     `comfyui/train_anima_lora.sh`, copy `train_anima_lora.sh.example` and
     fill in `SD_SCRIPTS_DIR`). The example script is a complete, real
     `anima_train_network.py` invocation with three selectable VRAM tiers,
     not a placeholder - just needs your local paths filled in.
   - Whatever calls `assemble_lora_dataset` should pass
     `use_quality_tags=true` - training targets Base, which was NOT
     fine-tuned with quality strings stripped (unlike Aesthetic).

## What each workflow is for

| Workflow | File | Used for |
|---|---|---|
| Base T2I | `t2i_base.json` | First-ever generation of a character (no reference exists yet). Also used post-training with a `<lora:...>` tag once she has one. |
| Single IPAdapter | `single_ipa.json` | One reference image. View-profile bootstrapping for simple characters, or consistent-background generation (reference = a generated background, combined with the character's trained LoRA). |
| Double IPAdapter | `double_ipa.json` | Two chained references (e.g. front + back) - view-profile bootstrapping for simple characters. |
| Four IPAdapter | `four_ipa.json` | Four chained references - view-profile bootstrapping for visually complex characters. |
| I2I | `i2i.json` | Fine control over scenes/stories, generally used once a character has a trained LoRA (no IPAdapter needed anymore). |
| T2I + upscale | `t2i_upscale.json` | Experimental/manual only - not called by the automated pipeline. A dedicated external upscale workflow will likely replace this. |
| Regional prompting | `regional.json` | Experimental - not automated yet, no config file wired up for it. |

All configs found in `configs/*.json` use real node IDs discovered from
your actual workflow exports - positive/negative prompt (24/25), LoRA tag
injection (26), seed (65), and the save node (35) turned out to be
identical across every variant, since they're all derived from the same
base template. Only the reference/input image node IDs differ between
kinds (see each config's `_comment`).

## Character creation pipeline

1. Generate the base A-pose reference image (`t2i_base`).
2. Generate view-profile images via `single_ipa`/`double_ipa`/`four_ipa`
   (2 or 4 views depending on how visually complex the character is -
   decided once at character-invention time).
3. Generate a training set of 20-30 varied images using the view profiles
   as multi-image references - roughly 40% close-up/headshot, 40%
   upper-body, 20% full-body (this composition, and outfit/angle variety,
   matters more for small-dataset LoRA quality than raw image count).
4. Assemble the dataset (`assemble_lora_dataset` Tauri command) - numbered
   images with matching three-segment `|||` caption files (locked trigger
   prefix, then physical traits, then framing/environment - kept separate
   so outfit and background don't get baked into her identity), plus an
   auto-generated `dataset_config.toml` with `num_repeats` scaled to land
   training around 1500-2000 total steps. Quality tags are omitted since
   this project targets Anima-Aesthetic, which was fine-tuned with those
   strings stripped from its own training data.
5. Train (`train_character_lora` Tauri command) - shells out to your
   script, returns the resulting LoRA's path once found.
6. From then on, generate with `t2i_base` (or `i2i`/`single_ipa` for
   consistent backgrounds) using the trained LoRA's `<lora:...>` tag
   instead of IPAdapter reference images.

## Known unverified/uncertain things

- Whether the custom "Image Saver Simple" node's `/history` output entry
  matches vanilla `SaveImage`'s schema closely enough to matter - sidestepped
  entirely by injecting a unique filename and glob-matching the output
  directory directly, rather than depending on it.
- The `-1` seed value on "Seed (rgthree)" means auto-randomize per your
  confirmation, so it's left untouched rather than patched.
- No part of the ComfyUI HTTP integration has been tested against a real
  running instance in the environment this was built in - the custom nodes
  these workflows depend on aren't set up here, and there's no GPU.
