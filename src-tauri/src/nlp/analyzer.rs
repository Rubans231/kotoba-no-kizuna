use serde::{Deserialize, Serialize};

use lindera::dictionary::load_dictionary;
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use lindera::tokenizer::Tokenizer;

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
        let dictionary = load_dictionary("embedded://ipadic").expect("Failed to load embedded IPADIC");

        let segmenter = Segmenter::new(
            Mode::Normal,
            dictionary,
            None,
        );

        let tokenizer = Tokenizer::new(segmenter);
        Self { tokenizer }
    }

    pub fn analyze(&self, text: &str) -> Vec<TokenResult> {
        let mut results = Vec::new();

        if let Ok(mut tokens) = self.tokenizer.tokenize(text) {
            for token in tokens.iter_mut() {
            let surface = token.surface.to_string();

            let (feature, reading, base_form) = {
                let details = token.details();

                (
                    details.first().copied().unwrap_or("*").to_string(),
                    details.get(7).map(|s| s.to_string()),
                    details.get(6).map(|s| s.to_string()),
                )
            };

            results.push(TokenResult {
                surface,
                feature,
                reading,
                base_form,
            });
        }        
        }

        results
    }

}
