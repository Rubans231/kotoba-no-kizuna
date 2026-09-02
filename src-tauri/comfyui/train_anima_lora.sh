#!/usr/bin/env bash
#
# train_anima_lora.sh — Train an Anima character LoRA with kohya-ss/sd-scripts.
#
# Output is kohya's native LoRA format (lora_unet_* / lora_down / lora_up), which
# ComfyUI loads directly - comfy/lora.py builds its key_map from the real model
# keys (dots -> underscores, prefixed lora_unet_), so no conversion step is needed.
#
# This is the DEFAULT training script: lora_training.rs resolves KOHYA_TRAIN_SCRIPT
# to <comfyui dir>/train_anima_lora.sh when the env var is unset, so creating this
# file is enough (no env var required).
#
# Contract (parsed by src-tauri/src/ai/lora_training.rs::train_lora):
#   train_anima_lora.sh <dataset_dir> <output_dir> <trigger_word>
#     $1 dataset_dir  numbered images + matching .txt captions + dataset_config.toml
#                      (written by the app; do NOT regenerate it here)
#     $2 output_dir   where the final .safetensors is written (created if missing)
#     $3 trigger_word unique token embedded in captions, also the output filename
#
# On success the final .safetensors path is printed as the LAST line of stdout
# (train_lora parses it from there, falling back to scanning output_dir).
#
# We train against the AESTHETIC checkpoint (anima-aesthetic-v1.1) — the same one
# the generation workflows use at inference — so the LoRA delta lines up with the
# base it's applied to. Its training data had quality tags stripped, so the dataset
# must be built with use_quality_tags=false (see loraPipeline.ts).

set -euo pipefail

log() { printf '[train] %s\n' "$*" >&2; }
die() { printf '[train][error] %s\n' "$*" >&2; exit 1; }

DATASET_DIR="${1:?usage: train_anima_lora.sh <dataset_dir> <output_dir> <trigger_word>}"
OUTPUT_DIR="${2:?usage: train_anima_lora.sh <dataset_dir> <output_dir> <trigger_word>}"
TRIGGER_WORD="${3:?usage: train_anima_lora.sh <dataset_dir> <output_dir> <trigger_word>}"

# --- Locations (env-overridable; defaults match this machine) -----------------
PYTHON="${KOTOB_PYTHON:-/home/robin/comfy/.venv/bin/python}"
SD_SCRIPTS_DIR="${KOTOB_SD_SCRIPTS:-/home/robin/comfy/sd-scripts}"
COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/comfy/ComfyUI}"

# Trained against Aesthetic (matches inference). To target Base instead, set
# KOTOB_ANIMA_DIT to the base checkpoint AND rebuild the dataset with
# use_quality_tags=true (Base's training data kept quality tags).
ANIMA_DIT="${KOTOB_ANIMA_DIT:-${COMFYUI_ROOT}/models/diffusion_models/anima-aesthetic-v1.1.safetensors}"
QWEN3="${KOTOB_QWEN3:-${COMFYUI_ROOT}/models/text_encoders/qwen_3_06b_base.safetensors}"
VAE="${KOTOB_VAE:-${COMFYUI_ROOT}/models/vae/qwen_image_vae.safetensors}"

# --- Training hyperparameters (env-overridable) --------------------------------
NETWORK_DIM="${KOTOB_NETWORK_DIM:-16}"
NETWORK_ALPHA="${KOTOB_NETWORK_ALPHA:-16}"
LEARNING_RATE="${KOTOB_LEARNING_RATE:-1e-4}"
OPTIMIZER_TYPE="${KOTOB_OPTIMIZER_TYPE:-adafactor}"
OPTIMIZER_ARGS="${KOTOB_OPTIMIZER_ARGS:-relative_step=False scale_parameter=False warmup_init=False}"
LR_SCHEDULER="${KOTOB_LR_SCHEDULER:-constant}"
MAX_TRAIN_EPOCHS="${KOTOB_MAX_TRAIN_EPOCHS:-10}"
TRAIN_BATCH_SIZE="${KOTOB_TRAIN_BATCH_SIZE:-1}"
GRAD_ACCUM="${KOTOB_GRADIENT_ACCUM_STEPS:-4}"
BLOCKS_TO_SWAP="${KOTOB_BLOCKS_TO_SWAP:-20}"
SEED="${KOTOB_SEED:-42}"

# --- Preflight -----------------------------------------------------------------
[[ -x "$PYTHON" ]] || die "python not found: $PYTHON (set KOTOB_PYTHON)"
[[ -f "$SD_SCRIPTS_DIR/anima_train_network.py" ]] || die "kohya sd-scripts not found: $SD_SCRIPTS_DIR (set KOTOB_SD_SCRIPTS)"
[[ -f "$ANIMA_DIT" ]] || die "Anima DiT not found: $ANIMA_DIT (set KOTOB_ANIMA_DIT)"
[[ -f "$QWEN3" ]] || die "Qwen3 encoder not found: $QWEN3 (set KOTOB_QWEN3)"
[[ -f "$VAE" ]] || die "VAE not found: $VAE (set KOTOB_VAE)"

DATASET_CONFIG="${DATASET_DIR}/dataset_config.toml"
[[ -f "$DATASET_CONFIG" ]] || die "dataset_config.toml missing in $DATASET_DIR (the app writes it - don't train an empty dir)"
IMG_COUNT="$(find "$DATASET_DIR" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | wc -l | tr -d ' ')"
[[ "$IMG_COUNT" -gt 0 ]] || die "no training images found in $DATASET_DIR"

mkdir -p "$OUTPUT_DIR"

# --- GPU guard: fail fast instead of OOMing hours into a run -------------------
MIN_FREE_MB="${KOTOB_GPU_MIN_FREE_MB:-6000}"
if command -v nvidia-smi >/dev/null 2>&1; then
  if FREE_MB="$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -n1)"; then
    if [[ "$FREE_MB" =~ ^[0-9]+$ ]] && (( FREE_MB < MIN_FREE_MB )) && [[ "${KOTOB_IGNORE_GPU:-0}" != "1" ]]; then
      die "only ${FREE_MB} MiB free on GPU (< ${MIN_FREE_MB} MiB needed). Free up VRAM (close ComfyUI / the local LLM, etc.), or set KOTOB_IGNORE_GPU=1 to override."
    fi
  fi
fi

# Fully offline: every model is passed by local path, so never touch the HF hub.
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_DATASETS_OFFLINE=1

# --- Output naming -------------------------------------------------------------
# kohya saves its final checkpoint to <output_dir>/<output_name>.safetensors, in
# kohya's native format (lora_unet_* / lora_down / lora_up) - see above, ComfyUI
# loads that directly.
FINAL_LORA="${OUTPUT_DIR}/${TRIGGER_WORD}.safetensors"

# --- Train ---------------------------------------------------------------------
log "training Anima LoRA (dim=${NETWORK_DIM} alpha=${NETWORK_ALPHA} lr=${LEARNING_RATE} opt=${OPTIMIZER_TYPE} epochs=${MAX_TRAIN_EPOCHS})"
log "DiT=${ANIMA_DIT}"
log "Qwen3=${QWEN3}"
log "VAE=${VAE}"
log "dataset=${DATASET_DIR} (${IMG_COUNT} images) -> ${OUTPUT_DIR}"

cd "$SD_SCRIPTS_DIR"

TRAIN_CMD=(
  "$PYTHON" anima_train_network.py
  --pretrained_model_name_or_path "$ANIMA_DIT"
  --qwen3 "$QWEN3"
  --vae "$VAE"
  --dataset_config "$DATASET_CONFIG"
  --network_module networks.lora_anima
  --network_train_unet_only
  --network_dim "$NETWORK_DIM"
  --network_alpha "$NETWORK_ALPHA"
  --optimizer_type "$OPTIMIZER_TYPE"
  --learning_rate "$LEARNING_RATE"
  --lr_scheduler "$LR_SCHEDULER"
  --train_batch_size "$TRAIN_BATCH_SIZE"
  --gradient_accumulation_steps "$GRAD_ACCUM"
  --max_train_epochs "$MAX_TRAIN_EPOCHS"
  --mixed_precision bf16
  --save_model_as safetensors
  --save_precision fp16
  --gradient_checkpointing
  --cache_latents
  --qwen_image_vae_2d
  --blocks_to_swap "$BLOCKS_TO_SWAP"
  --attn_mode torch
  --timestep_sampling sigmoid
  --discrete_flow_shift 1.0
  --max_data_loader_n_workers 2
  --seed "$SEED"
  --output_dir "$OUTPUT_DIR"
  --output_name "$TRIGGER_WORD"
)

if [[ -n "$OPTIMIZER_ARGS" ]]; then
  # shellcheck disable=SC2206
  OPTS=( $OPTIMIZER_ARGS )
  TRAIN_CMD+=( --optimizer_args "${OPTS[@]}" )
fi

"${TRAIN_CMD[@]}"

[[ -f "$FINAL_LORA" ]] || die "training finished but LoRA not found: $FINAL_LORA"

# LAST stdout line is consumed by lora_training.rs::train_lora.
printf '%s\n' "$FINAL_LORA"
