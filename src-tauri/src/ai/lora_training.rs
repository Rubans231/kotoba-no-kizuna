use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

/// One training image plus which framing category it represents. Framing
/// matters for two reasons: it drives the recommended dataset composition
/// (~40% close-up, ~40% upper-body, ~20% full-body) and it feeds the third
/// caption segment (environment/framing), keeping that separate from the
/// character's own physical-trait tags so framing doesn't get baked into
/// her identity.
pub struct TrainingImage<'a> {
    pub path: &'a str,
    pub framing: Framing,
}

#[derive(Clone, Copy)]
pub enum Framing {
    CloseUp,
    UpperBody,
    FullBody,
}

impl Framing {
    fn caption_tags(self) -> &'static str {
        match self {
            Framing::CloseUp => "close-up, face focus, looking at viewer, simple background",
            Framing::UpperBody => "upper body, standing, simple background",
            Framing::FullBody => "full body, standing, simple background",
        }
    }
}

/// Builds a kohya-ss-style training dataset for Anima character LoRAs:
/// each image gets a sequentially numbered filename and a matching .txt
/// caption using the three-segment `|||` format Anima/kohya expects:
///
///   {quality prefix if targeting Anima-Base}, 1girl, {trigger_word} ||| {visual_tags} ||| {framing tags}
///
/// The first segment is the locked prefix (trigger word survives caption
/// shuffling/dropout); the second is physical traits/outfit (allowed to
/// shuffle/drop so outfit isn't hardcoded into identity); the third is
/// framing/environment (kept separate so it doesn't bleed into the
/// character's identity either). Quality tags (masterpiece, best quality,
/// score_7, safe) are only included for Anima-Base - the Aesthetic variant
/// was fine-tuned with those strings stripped from its own training data,
/// so including them here would work against it. This project defaults to
/// the Aesthetic checkpoint (anima-aesthetic-v1.1.safetensors), so
/// `use_quality_tags` should normally be false.
///
/// Also writes dataset_config.toml alongside the images, with num_repeats
/// scaled to the image count so total training steps land in the
/// documented safe range (~1500-2000 steps at 10 epochs, batch size 1) -
/// training beyond ~2400-3000 steps on Anima is documented to cause
/// overfitting and degraded prompt adherence.
pub async fn assemble_dataset(
    images: &[TrainingImage<'_>],
    trigger_word: &str,
    visual_tags: &str,
    use_quality_tags: bool,
    dataset_dir: &str,
) -> Result<(), String> {
    tokio::fs::create_dir_all(dataset_dir)
        .await
        .map_err(|e| format!("Couldn't create dataset directory {dataset_dir}: {e}"))?;

    let segment_one = if use_quality_tags {
        format!("masterpiece, best quality, score_7, safe, 1girl, {trigger_word}")
    } else {
        format!("1girl, {trigger_word}")
    };

    for (i, image) in images.iter().enumerate() {
        let source = PathBuf::from(image.path);
        let extension = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let base_name = format!("{:03}", i + 1);

        let dest_image = PathBuf::from(dataset_dir).join(format!("{base_name}.{extension}"));
        tokio::fs::copy(&source, &dest_image)
            .await
            .map_err(|e| format!("Couldn't copy training image {}: {e}", image.path))?;

        let caption = format!("{segment_one} ||| {visual_tags} ||| {}", image.framing.caption_tags());
        let dest_caption = PathBuf::from(dataset_dir).join(format!("{base_name}.txt"));
        tokio::fs::write(&dest_caption, &caption)
            .await
            .map_err(|e| format!("Couldn't write caption file for {base_name}: {e}"))?;
    }

    write_dataset_config(dataset_dir, images.len()).await?;

    Ok(())
}

/// num_repeats scaled so total steps land around 1800 (documented safe
/// midpoint of the 1500-2000 target range) at 10 epochs, batch size 1:
/// num_repeats = 1800 / (image_count * 10) = 180 / image_count. Matches
/// the documented reference table exactly (12 images -> 15, 25 -> 7,
/// 40 -> 4), rounding down to stay under the overfitting threshold rather
/// than over it.
fn recommended_num_repeats(image_count: usize) -> usize {
    if image_count == 0 {
        return 1;
    }
    (180 / image_count).max(1)
}

async fn write_dataset_config(dataset_dir: &str, image_count: usize) -> Result<(), String> {
    let num_repeats = recommended_num_repeats(image_count);
    let toml = format!(
        r#"[general]
shuffle_caption = true
caption_extension = ".txt"
keep_tokens_separator = "|||"
keep_tokens = 1
flip_aug = false
enable_bucket = true
bucket_no_upscale = true
bucket_reso_steps = 32
min_bucket_reso = 288
max_bucket_reso = 2048

[[datasets]]
resolution = 1024
batch_size = 1

[[datasets.subsets]]
image_dir = "{dataset_dir}"
num_repeats = {num_repeats}
caption_tag_dropout_rate = 0.05
"#
    );

    let config_path = PathBuf::from(dataset_dir).join("dataset_config.toml");
    tokio::fs::write(&config_path, toml)
        .await
        .map_err(|e| format!("Couldn't write dataset_config.toml: {e}"))?;

    Ok(())
}

/// Invokes a user-supplied training script (path configured via the
/// KOHYA_TRAIN_SCRIPT env var) with (dataset_dir, output_dir, trigger_word)
/// as positional arguments, waits for it to exit, then looks for the
/// resulting .safetensors file in output_dir.
pub async fn train_lora(
    dataset_dir: &str,
    output_dir: &str,
    character_name: &str,
    trigger_word: &str,
) -> Result<String, String> {
    let script_path = std::env::var("KOHYA_TRAIN_SCRIPT")
        .unwrap_or_else(|_| crate::ai::comfyui::comfyui_base_dir().join("train_anima_lora.sh").to_string_lossy().to_string());

    if !PathBuf::from(&script_path).exists() {
        return Err(format!(
            "Training script not found at '{script_path}'. Set KOHYA_TRAIN_SCRIPT or create it - \
              see comfyui/train_anima_lora.sh.example for the expected contract."
        ));
    }

    tokio::fs::create_dir_all(output_dir)
        .await
        .map_err(|e| format!("Couldn't create LoRA output directory {output_dir}: {e}"))?;

    let mut command = Command::new(if cfg!(unix) { "bash" } else { script_path.as_str() });
    if cfg!(unix) {
        command.arg(&script_path);
    }

    let output = command
        .arg(dataset_dir)
        .arg(output_dir)
        .arg(trigger_word)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to launch training script '{script_path}': {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Training script exited with an error (status {:?}):\n{stderr}",
            output.status.code()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Some(last_line) = stdout.lines().rev().find(|l| !l.trim().is_empty()) {
        let candidate = PathBuf::from(last_line.trim());
        if candidate.extension().and_then(|e| e.to_str()) == Some("safetensors") && candidate.exists() {
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    let mut entries = tokio::fs::read_dir(output_dir)
        .await
        .map_err(|e| format!("Couldn't read LoRA output directory {output_dir}: {e}"))?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".safetensors") && name.to_lowercase().contains(&character_name.to_lowercase()) {
            return Ok(entry.path().to_string_lossy().to_string());
        }
    }

    Err(format!(
        "Training script finished successfully but no .safetensors file matching '{character_name}' \
         was found in {output_dir}, and the script didn't print a valid output path as its last line."
    ))
}
