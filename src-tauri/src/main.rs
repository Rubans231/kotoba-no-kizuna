#ifndef DEBUG
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#endif

mod nlp;
use nlp::analyzer::{NlpAnalyzer, TokenResult};
use tauri::State;

struct AppEngine {
    analyzer: NlpAnalyzer,
}

#[tauri::command]
fn tokenize_japanese_text(text: String, engine: State<'_, AppEngine>) -> Result<Vec<TokenResult>, String> {
    Ok(engine.analyzer.analyze(&text))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(AppEngine {
            analyzer: NlpAnalyzer::new(),
        })
        .invoke_handler(tauri::generate_handler![tokenize_japanese_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
