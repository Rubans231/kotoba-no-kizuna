use serde::{Serialize, Deserialize};
use lindera_tokenizer::tokenizer::Tokenizer;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenResult {
    pub surface: String,
    pub feature: String,
    pub reading: Option<String>,
    pub base_form: Option<String>,
}

pub struct NlpAnalyzer {
    tokenizer: Tokenizer,
}

impl NlpAnalyzer {
    pub fn new() -> Self {
        let tokenizer = Tokenizer::new().expect("Failed to initialize Lindera IPADIC Tokenizer");
        Self { tokenizer }
    }

    pub fn analyze(&self, text: &str) -> Vec<TokenResult> {
        let mut results = Vec::new();
        if let Ok(tokens) = self.tokenizer.tokenize(text) {
            for mut token in tokens {
                let details: Vec<&str> = token.get_details().unwrap_or_default();
                
                // IPADIC feature array layout mapping:
                // 0: POS, 7: Reading, 6: Base Form
                let reading = details.get(7).map(|s| s.to_string());
                let base_form = details.get(6).map(|s| s.to_string());

                results.push(TokenResult {
                    surface: token.text.to_string(),
                    feature: details.get(0).unwrap_or(&"*").to_string(),
                    reading,
                    base_form,
                });
            }
        }
        results
    }
}
