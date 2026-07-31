"""
Setup script for the Kotoba no Kizuna ComfyUI backend, adapted from an
existing launch_comfy.py pattern (comfy-cli install, custom node setup,
model downloads, then launch). See https://github.com/Comfy-Org/comfy-cli.

Custom nodes are installed via `comfy node install <name> --uv-compile`
(faster, isolated dependency resolution) rather than raw git clone.
"""

import logging
import os
import subprocess
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Real node list, confirmed against the actual workflow exports this
# project is built around.
CUSTOM_NODES = [
    "ComfyUI-Manager",          # Comfy-Org - node manager itself
    "ComfyUI-Impact-Pack",      # ltdrdata - ImpactWildcardProcessor, ImpactSwitch, ToDetailerPipe
    "ComfyUI-Impact-Subpack",   # ltdrdata - UltralyticsDetectorProvider, SAMLoader
    "rgthree-comfy",            # rgthree - Seed (rgthree)
    "ComfyUI-Image-Saver",      # alexopus - Image Saver Simple / Metadata
    "ComfyUI-KJNodes",          # kijai - ImageResizeKJv2
    "ComfyUI-Lora-Manager",     # willmiao - Lora Loader (LoraManager)
    "ComfyUI-Easy-Use",         # yolain - easy int / easy showAnything
    "ComfyUI_UltimateSDUpscale",  # ssitu - t2i_upscale.json only, not part of the automated pipeline
]

# Anima-specific nodes not in the ComfyUI-Manager registry - installed by
# git URL instead of by name.
CUSTOM_NODE_GIT_URLS = [
    "https://github.com/kohya-ss/ComfyUI-Anima-LLLite",           # ControlNet-LLLite for Anima (pose/structure control - not wired into any workflow yet)
    "https://github.com/LuciferTC9527/ComfyUI-Anima_IP-Adapter.git",  # AnimaIPAdapterLoader / AnimaIPAdapterApply
]

# Model files with known download URLs. relative_path matches ComfyUI's
# own model folder convention.
MODEL_DOWNLOADS = [
    # (url, relative_path, token_type) - token_type is None, "hf", or "civitai"
    ("https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/diffusion_models/anima-aesthetic-v1.1.safetensors", "diffusion_models", "hf"),
    # For LoRA training specifically (anima_train_network.py trains against
    # Base, not Aesthetic - see train_anima_lora.sh.example):
    ("https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/diffusion_models/anima-base-v1.0.safetensors", "diffusion_models", "hf"),
    ("https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/text_encoders/qwen_3_06b_base.safetensors", "text_encoders", "hf"),
    ("https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/vae/qwen_image_vae.safetensors", "vae", "hf"),
    ("https://huggingface.co/LuciferTC/Anima-IP-Adapter/resolve/main/ip_adapter-Character_Reference-10.safetensors", "ipadapter", "hf"),
    # Detector models - these appear to already be wired into the
    # provided T2I/IPA workflows (ToDetailerPipe / UltralyticsDetectorProvider
    # / SAMLoader nodes are present in them), so they're likely required
    # for those workflows to run at all, not just a nice-to-have:
    ("https://huggingface.co/Bingsu/adetailer/resolve/main/hand_yolov9c.pt", "detection", "hf"),
    ("https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov9c.pt", "detection", "hf"),
    # Eyeful_v2 eye detector - Civitai-hosted, needs a Civitai token.
    ("https://civitai.com/models/178518/eyeful-or-robust-eye-detection-for-adetailer-comfyui", "detection", "civitai"),
]


def run_command_live(command: str, cwd: Path | None = None) -> None:
    """Executes a shell command and streams live output."""
    logger.info(f"Executing: {command} (cwd={cwd})")
    process = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        cwd=str(cwd) if cwd else None,
    )
    for line in iter(process.stdout.readline, ""):
        sys.stdout.write(line)
        sys.stdout.flush()
    process.stdout.close()
    return_code = process.wait()
    if return_code != 0:
        logger.error(f"Command failed with exit code {return_code}: {command}")
        raise subprocess.CalledProcessError(return_code, command)


def main() -> None:
    comfy_root = Path.home() / "comfy" / "ComfyUI"

    # -------------------------------------------------------------------
    # 1. Environment setup
    # -------------------------------------------------------------------
    if not (comfy_root / "main.py").exists():
        logger.info("Initializing ComfyUI environment via comfy-cli...")
        run_command_live(
            f"comfy --skip-prompt --no-enable-telemetry --workspace={comfy_root} "
            "install --nvidia --fast-deps"
        )
    else:
        logger.info("ComfyUI workspace already initialized. Skipping install.")

    # -------------------------------------------------------------------
    # 2. Custom nodes - registry names first, then Anima-specific git URLs
    # -------------------------------------------------------------------
    for node_name in CUSTOM_NODES:
        logger.info(f"Installing {node_name}...")
        run_command_live(f"comfy --workspace={comfy_root} node install {node_name} --uv-compile")

    for repo_url in CUSTOM_NODE_GIT_URLS:
        node_dir = comfy_root / "custom_nodes" / repo_url.rstrip("/").rstrip(".git").split("/")[-1]
        if node_dir.exists():
            logger.info(f"{node_dir.name} already installed, skipping.")
            continue
        logger.info(f"Installing {repo_url} (not in the node registry)...")
        run_command_live(f"git clone {repo_url} {node_dir}")
        node_req = node_dir / "requirements.txt"
        if node_req.exists():
            run_command_live(f"pip install -r {node_req}")

    # -------------------------------------------------------------------
    # 3. Model downloads
    # -------------------------------------------------------------------
    for url, relative_path, token_type in MODEL_DOWNLOADS:
        logger.info(f"Downloading {url} -> models/{relative_path}/...")
        command = f'comfy --workspace={comfy_root} model download --url "{url}" --relative-path {relative_path}'

        if token_type == "hf":
            token = os.environ.get("HF_API_TOKEN")
            if token:
                command += f' --set-hf-api-token "{token}"'
            # else: fine to omit - many HF files (including these) don't require auth
        elif token_type == "civitai":
            token = os.environ.get("CIVITAI_API_TOKEN")
            if not token:
                logger.warning(
                    f"Skipping {url} - CIVITAI_API_TOKEN is not set in the environment "
                    "and this download needs it. Export it and re-run, or download manually."
                )
                continue
            command += f' --set-civitai-api-token "{token}"'

        run_command_live(command)

    # -------------------------------------------------------------------
    # 4. Launch
    # -------------------------------------------------------------------
    logger.info("Launching ComfyUI server...")
    run_command_live(
        f"comfy --skip-prompt --workspace={comfy_root} launch -- "
        "--listen 127.0.0.1 --port 8188"
    )


if __name__ == "__main__":
    main()
