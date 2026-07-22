#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod nlp;

use nlp::analyzer::{NlpAnalyzer, TokenResult};
use serde::Deserialize;
use tauri::State;
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

fn main() {
    // Loads src-tauri/.env in dev so ANTHROPIC_API_KEY doesn't need to be
    // exported manually every session. Harmless no-op if the file is absent.
    dotenvy::dotenv().ok();

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
            send_chat_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
