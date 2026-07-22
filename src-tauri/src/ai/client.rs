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

/// Sends one turn of conversation to a local, OpenAI-compatible chat
/// completions endpoint (llama-server, Ollama, LM Studio, etc.) and returns
/// the model's text reply. `history` is a list of (role, content) pairs
/// where role is "user" or "assistant".
///
/// Configured via env vars, all optional:
///   LOCAL_LLM_BASE_URL - default "http://localhost:8080" (llama-server default)
///   LOCAL_LLM_MODEL     - default "local-model" (llama-server ignores this
///                         and just uses whatever's loaded; some other
///                         servers, e.g. Ollama, require the real model name)
///   LOCAL_LLM_API_KEY   - only needed if you started llama-server with --api-key
pub async fn send_message(
    system_prompt: &str,
    history: Vec<(String, String)>,
    user_message: &str,
) -> Result<String, String> {
    let base_url = std::env::var("LOCAL_LLM_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:8080".to_string());
    let model = std::env::var("LOCAL_LLM_MODEL").unwrap_or_else(|_| "local-model".to_string());
    let api_key = std::env::var("LOCAL_LLM_API_KEY").ok();

    let client = reqwest::Client::new();

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

    let body = ChatRequest {
        model,
        messages,
        grammar: REPLY_GRAMMAR.to_string(),
        temperature: 0.8,
        max_tokens: 1024,
    };

    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        req = req.bearer_auth(key);
    }

    let res = req.send().await.map_err(|e| {
        format!(
            "Couldn't reach the local model server at {url}: {e}. Is llama-server running?"
        )
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
