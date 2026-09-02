#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod nlp;

use nlp::analyzer::{NlpAnalyzer, TokenResult};
use serde::Deserialize;
use tauri::{Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};

struct AppEngine {
    analyzer: NlpAnalyzer,
}

#[derive(Deserialize)]
struct ChatTurn {
    role: String,
    content: String,
}

#[tauri::command]
fn tokenize_japanese_text(
    text: String,
    engine: State<'_, AppEngine>,
) -> Result<Vec<TokenResult>, String> {
    Ok(engine.analyzer.analyze(&text))
}

/// Forwards a chat turn to the local model server (llama-server by default).
/// Nothing leaves the machine - this never calls out to a hosted API.
#[tauri::command]
async fn send_chat_message(
    system_prompt: String,
    history: Vec<ChatTurn>,
    user_message: String,
) -> Result<String, String> {
    let history_pairs = history.into_iter().map(|t| (t.role, t.content)).collect();
    ai::client::send_message(&system_prompt, history_pairs, &user_message).await
}

/// Generates a brand-new companion persona (Random banner / rotating shop).
/// Returns the raw JSON string; the frontend parses it and assigns rarity
/// (which is decided by the pull outcome, not the model).
#[tauri::command]
async fn generate_character_concept(system_prompt: String) -> Result<String, String> {
    ai::client::generate_character(&system_prompt).await
}

/// Generates one image via ComfyUI using the named workflow config. Returns
/// the local file path of the saved PNG. `kind` selects which config in
/// src-tauri/comfyui/configs/ to use - see src-tauri/comfyui/README.md.
/// Images are saved under the app's own data directory rather than a path
/// supplied by the frontend, so the location is correct and consistent
/// across platforms.
#[tauri::command]
async fn generate_character_image(
    app_handle: tauri::AppHandle,
    kind: String,
    positive_prompt: String,
    negative_prompt: String,
    reference_image_paths: Vec<String>,
    input_image_path: Option<String>,
    lora_name: Option<String>,
    lora_weight: Option<f32>,
) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Couldn't resolve app data directory: {e}"))?;
    let output_dir = app_data_dir.join("generated_images");

    let lora = lora_name
        .as_deref()
        .map(|name| ai::comfyui::LoraInjection { name, weight: lora_weight.unwrap_or(1.0) });

    ai::comfyui::generate_image(
        &kind,
        &positive_prompt,
        &negative_prompt,
        &reference_image_paths,
        input_image_path.as_deref(),
        lora,
        &output_dir.to_string_lossy(),
    )
    .await
}

/// Assembles a kohya-ss-style training dataset (numbered images + matching
/// three-segment `|||` caption files, plus a dataset_config.toml) from a
/// set of already-generated images. `images` is a list of (path, framing)
/// pairs where framing is "close_up" | "upper_body" | "full_body".
/// `use_quality_tags` should be true when training against Anima-Base
/// (this project's training target) and false only if pointed at Aesthetic
/// instead. The dataset directory is resolved internally from
/// character_id (app_data_dir/lora_datasets/{character_id}), same pattern
/// as generate_character_image, so the frontend doesn't need to guess a
/// writable path.
#[tauri::command]
async fn assemble_lora_dataset(
    app_handle: tauri::AppHandle,
    images: Vec<(String, String)>,
    trigger_word: String,
    visual_tags: String,
    use_quality_tags: bool,
    character_id: String,
) -> Result<String, String> {
    let framing_images: Result<Vec<ai::lora_training::TrainingImage>, String> = images
        .iter()
        .map(|(path, framing_str)| {
            let framing = match framing_str.as_str() {
                "close_up" => ai::lora_training::Framing::CloseUp,
                "upper_body" => ai::lora_training::Framing::UpperBody,
                "full_body" => ai::lora_training::Framing::FullBody,
                other => return Err(format!("Unknown framing category '{other}' - expected close_up, upper_body, or full_body")),
            };
            Ok(ai::lora_training::TrainingImage { path: path.as_str(), framing })
        })
        .collect();
    let framing_images = framing_images?;

    let dataset_dir = lora_dataset_dir(&app_handle, &character_id)?;
    ai::lora_training::assemble_dataset(&framing_images, &trigger_word, &visual_tags, use_quality_tags, &dataset_dir).await?;
    Ok(dataset_dir)
}

/// Invokes the user-supplied training script (KOHYA_TRAIN_SCRIPT env var)
/// against a dataset already assembled by assemble_lora_dataset for this
/// character_id, and returns the resulting LoRA's path. output_dir
/// defaults to ComfyUI's own models/loras directory when not overridden -
/// intentionally NOT under app_data_dir, since that's a genuinely
/// different location (the ComfyUI installation itself).
#[tauri::command]
async fn train_character_lora(
    app_handle: tauri::AppHandle,
    character_id: String,
    character_name: String,
    trigger_word: String,
    output_dir: Option<String>,
) -> Result<String, String> {
    let dataset_dir = lora_dataset_dir(&app_handle, &character_id)?;
    let resolved_output_dir = output_dir.unwrap_or_else(|| {
        std::env::var("COMFYUI_LORAS_DIR").unwrap_or_else(|_| "ComfyUI/models/loras".to_string())
    });
    ai::lora_training::train_lora(&dataset_dir, &resolved_output_dir, &character_name, &trigger_word).await
}

fn lora_dataset_dir(app_handle: &tauri::AppHandle, character_id: &str) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Couldn't resolve app data directory: {e}"))?;
    Ok(app_data_dir
        .join("lora_datasets")
        .join(character_id)
        .to_string_lossy()
        .to_string())
}

fn load_local_env() {
    // Loads the project's .env regardless of the binary's working directory.
    // Harmless no-op if none of the candidate paths exist.
    let candidates = [
        std::path::PathBuf::from(".env"),
        std::path::PathBuf::from("src-tauri").join(".env"),
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".env"),
    ];
    for candidate in candidates {
        if candidate.exists() {
            let _ = dotenvy::from_path(candidate);
            return;
        }
    }
}

fn main() {
    load_local_env();

    let migrations = vec![
        Migration {
            version: 1,
            description: "init_schema",
            sql: include_str!("../migrations/001_init_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "gacha_economy",
            sql: include_str!("../migrations/002_gacha_economy.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "relationship_depth",
            sql: include_str!("../migrations/003_relationship_depth.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "vocab_dictionary",
            sql: include_str!("../migrations/004_vocab_dictionary.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "abilities",
            sql: include_str!("../migrations/005_abilities.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "random_characters",
            sql: include_str!("../migrations/006_random_characters.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "character_art",
            sql: include_str!("../migrations/007_character_art.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "procedural_character_art_fields",
            sql: include_str!("../migrations/008_procedural_character_art_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "visual_tags",
            sql: include_str!("../migrations/009_visual_tags.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "lora_pipeline",
            sql: include_str!("../migrations/010_lora_pipeline.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kotoba.db", migrations)
                .build(),
        )
        .manage(AppEngine {
            analyzer: NlpAnalyzer::new(),
        })
        .invoke_handler(tauri::generate_handler![
            tokenize_japanese_text,
            send_chat_message,
            generate_character_concept,
            generate_character_image,
            assemble_lora_dataset,
            train_character_lora
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
