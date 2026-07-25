use serde::{Deserialize, Serialize};

// GBNF grammar constraining the model's output to the exact JSON shape the
// frontend expects. Local models are much less reliable than hosted ones at
// "just follow the format instruction," so this constrains sampling itself
// rather than hoping the prompt is obeyed.
const REPLY_GRAMMAR: &str = r#"
root ::= "{" ws "\"speech\":" ws string "," ws "\"translation\":" ws english-string "," ws "\"vocab_introduced\":" ws vocab-array "," ws "\"relationship_delta\":" ws relationship-delta ws "}"
relationship-delta ::= "{" ws "\"affection\":" ws integer "," ws "\"trust\":" ws integer "," ws "\"respect\":" ws integer "," ws "\"comfort\":" ws integer "," ws "\"friendship\":" ws integer "," ws "\"study_compatibility\":" ws integer "," ws "\"shared_memories\":" ws integer ws "}"
vocab-array ::= "[" ws "]" | "[" ws vocab-item (ws "," ws vocab-item)* ws "]"
vocab-item ::= "{" ws "\"word\":" ws string "," ws "\"reading\":" ws string "," ws "\"meaning\":" ws english-string "," ws "\"nuance\":" ws english-string "," ws "\"mnemonic\":" ws english-string "," ws "\"related_words\":" ws string-array ws "}"
string-array ::= "[" ws "]" | "[" ws string (ws "," ws string)* ws "]"
string ::= "\"" string-char* "\""
string-char ::= [^"\\\x00-\x1F] | "\\" (["\\/bfnrt] | "u" hex hex hex hex)
english-string ::= "\"" english-char* "\""
english-char ::= [^"\\\x00-\x1F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF] | "\\" ["\\/bfnrt]
hex ::= [0-9a-fA-F]
integer ::= "-"? digit digit?
digit ::= [0-9]
ws ::= [ \t\n]*
"#;

// Grammar for procedurally generating a brand-new companion persona (used by
// the Random banner / rotating shop). Rarity is NOT part of the model's
// output - our own code decides rarity before calling this (it has real
// game-mechanical weight via teaching depth), and only passes it into the
// prompt as a flavor hint. display_name and archetype get the permissive
// `string`/fixed-enum treatment; everything else the player would read as
// an explanation is restricted to the same Japanese-script-free
// english-string rule used above, for the same reason (local models drift
// into Japanese in fields that should be plain English).
const CHARACTER_GRAMMAR: &str = r#"
root ::= "{" ws "\"display_name\":" ws string "," ws "\"archetype\":" ws archetype "," ws "\"specialty\":" ws english-string "," ws "\"personality\":" ws english-string "," ws "\"teaching_philosophy\":" ws english-string "," ws "\"speech_style\":" ws english-string "," ws "\"daily_routine_morning\":" ws english-string "," ws "\"daily_routine_afternoon\":" ws english-string "," ws "\"daily_routine_evening\":" ws english-string "," ws "\"daily_routine_late_night\":" ws english-string "," ws "\"visual_design_prompt\":" ws english-string ws "}"
archetype ::= "\"professor\"" | "\"big_sister\"" | "\"detective\"" | "\"idol\"" | "\"historian\""
string ::= "\"" string-char* "\""
string-char ::= [^"\\\x00-\x1F] | "\\" (["\\/bfnrt] | "u" hex hex hex hex)
english-string ::= "\"" english-char* "\""
english-char ::= [^"\\\x00-\x1F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF] | "\\" ["\\/bfnrt]
hex ::= [0-9a-fA-F]
ws ::= [ \t\n]*
"#;

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    grammar: String,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize, Debug)]
struct ChatChoice {
    message: ChoiceMessage,
}

#[derive(Deserialize, Debug)]
struct ChoiceMessage {
    content: String,
}

#[derive(Deserialize, Debug)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

/// Shared HTTP call to a local, OpenAI-compatible chat completions endpoint
/// (llama-server, Ollama, LM Studio, etc). `messages` is the full message
/// list (including any system message) - callers build it however suits
/// them. `grammar` is whichever GBNF grammar constrains this particular
/// call's output shape.
///
/// Configured via env vars, all optional:
///   LOCAL_LLM_BASE_URL - default "http://localhost:8080" (llama-server default)
///   LOCAL_LLM_MODEL     - default "local-model" (llama-server ignores this
///                         and just uses whatever's loaded; some other
///                         servers, e.g. Ollama, require the real model name)
///   LOCAL_LLM_API_KEY   - only needed if you started llama-server with --api-key
async fn call_local_llm(
    messages: Vec<ChatMessage>,
    grammar: &str,
    temperature: f32,
) -> Result<String, String> {
    let base_url = std::env::var("LOCAL_LLM_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:8080".to_string());
    let model = std::env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "local-model".to_string());
    let api_key = std::env::var("LOCAL_LLM_API_KEY").ok();

    let client = reqwest::Client::new();

    let body = ChatRequest {
        model,
        messages,
        grammar: grammar.to_string(),
        temperature,
        max_tokens: 1024,
    };

    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        req = req.bearer_auth(key);
    }

    let res = req.send().await.map_err(|e| {
        format!("Couldn't reach the local model server at {url}: {e}. Is llama-server running?")
    })?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Local model server returned an error ({status}): {text}"));
    }

    let parsed: ChatCompletionResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse local model server response: {e}"))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "Local model server returned no choices".to_string())
}

/// Sends one turn of conversation and returns the model's text reply.
/// `history` is a list of (role, content) pairs where role is "user" or
/// "assistant".
pub async fn send_message(
    system_prompt: &str,
    history: Vec<(String, String)>,
    user_message: &str,
) -> Result<String, String> {
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: system_prompt.to_string(),
    }];
    messages.extend(
        history
            .into_iter()
            .map(|(role, content)| ChatMessage { role, content }),
    );
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_message.to_string(),
    });

    call_local_llm(messages, REPLY_GRAMMAR, 0.8).await
}

/// Generates a brand-new companion persona (for the Random banner / rotating
/// shop). Returns the raw JSON string matching CHARACTER_GRAMMAR's shape;
/// the caller (TS side) parses it and assigns the rarity that was already
/// decided before this was called. Higher temperature than chat replies -
/// we want variety across generations, not consistency with a character.
pub async fn generate_character(system_prompt: &str) -> Result<String, String> {
    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: "Generate the character now.".to_string(),
        },
    ];

    call_local_llm(messages, CHARACTER_GRAMMAR, 1.05).await
}
