use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<AnthropicMessage>,
}

#[derive(Deserialize, Debug)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Deserialize, Debug)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
}

/// Sends one turn of conversation to the Anthropic Messages API and returns
/// the model's text reply. `history` is a list of (role, content) pairs
/// where role is "user" or "assistant".
pub async fn send_message(
    api_key: &str,
    system_prompt: &str,
    history: Vec<(String, String)>,
    user_message: &str,
) -> Result<String, String> {
    // Configurable so the model can be bumped without a Rust rebuild.
    // Defaults to a current Sonnet-tier model as of this writing.
    let model = std::env::var("ANTHROPIC_MODEL").unwrap_or_else(|_| "claude-sonnet-5".to_string());

    let client = reqwest::Client::new();

    let mut messages: Vec<AnthropicMessage> = history
        .into_iter()
        .map(|(role, content)| AnthropicMessage { role, content })
        .collect();
    messages.push(AnthropicMessage {
        role: "user".to_string(),
        content: user_message.to_string(),
    });

    let body = AnthropicRequest {
        model,
        max_tokens: 1024,
        system: system_prompt.to_string(),
        messages,
    };

    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request to Anthropic API failed: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error ({status}): {text}"));
    }

    let parsed: AnthropicResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {e}"))?;

    parsed
        .content
        .into_iter()
        .find(|b| b.block_type == "text")
        .and_then(|b| b.text)
        .ok_or_else(|| "Anthropic response contained no text block".to_string())
}
