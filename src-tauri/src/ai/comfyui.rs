use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;
use uuid::Uuid;

/// Maps a logical "kind" of generation onto an actual ComfyUI workflow graph
/// and the specific node IDs in that graph that need to be patched per-call.
/// Defaults here match the real Anima workflow exports this project was
/// built against (see comfyui/workflows/) - positive/negative prompt, LoRA
/// injection, and output node IDs turned out to be identical (24, 25, 26,
/// 35) across every exported variant, since they're all derived from the
/// same base template. Only the reference/input image node IDs differ
/// between kinds. If you re-export your own workflows with different node
/// IDs, update the matching config file - nothing here is hardcoded in Rust.
#[derive(Deserialize, Clone)]
pub struct WorkflowConfig {
    /// Filename of the workflow JSON (API format export from ComfyUI),
    /// relative to comfyui/workflows/ next to this config.
    pub workflow_file: String,
    /// Node ID (an ImpactWildcardProcessor) whose wildcard_text/populated_text should hold the positive prompt.
    pub positive_prompt_node_id: Option<String>,
    /// Node ID (an ImpactWildcardProcessor) whose wildcard_text/populated_text should hold the negative prompt.
    pub negative_prompt_node_id: Option<String>,
    /// Node IDs (LoadImage nodes) that should receive IPAdapter reference images, in order.
    /// Empty/absent for workflows with no IPAdapter (t2i_base, i2i).
    #[serde(default)]
    pub ipadapter_image_node_ids: Vec<String>,
    /// Node ID (a LoadImage) that should receive the I2I source image, if this is an I2I workflow.
    pub input_image_node_id: Option<String>,
    /// Node ID (the LoraManager loader)'s `text` field gets a `<lora:name:weight>` tag
    /// appended (not replacing existing content) when a trained character LoRA should be used.
    pub lora_tag_node_id: Option<String>,
    /// Node ID (a Save-Image-style node) whose output we should fetch. Only
    /// used to detect job completion via /history - the actual filename
    /// used to *locate* the file comes from output_filename_node_id, since
    /// custom save nodes don't reliably expose the same /history "images"
    /// schema as vanilla SaveImage.
    pub output_node_id: String,
    /// Node ID whose `inputs.filename` we overwrite with a unique value per
    /// call, so the resulting file can be found by name-glob afterward
    /// rather than trusting /history's output schema. Defaults to
    /// output_node_id if not set separately.
    pub output_filename_node_id: Option<String>,
    /// Node ID whose `inputs.path` we overwrite with a fixed subfolder
    /// (kotoba_app) for tidiness, if the save node supports a path input.
    pub output_path_node_id: Option<String>,
}

fn configs_dir() -> PathBuf {
    PathBuf::from("comfyui/configs")
}

fn workflows_dir() -> PathBuf {
    PathBuf::from("comfyui/workflows")
}

fn load_config(kind: &str) -> Result<WorkflowConfig, String> {
    let path = configs_dir().join(format!("{kind}.json"));
    let text = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "Couldn't read ComfyUI config at {}: {e}. See src-tauri/comfyui/README.md.",
            path.display()
        )
    })?;
    serde_json::from_str(&text).map_err(|e| format!("Invalid JSON in {}: {e}", path.display()))
}

fn load_workflow(config: &WorkflowConfig) -> Result<Value, String> {
    let path = workflows_dir().join(&config.workflow_file);
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("Couldn't read workflow file at {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("Invalid JSON in {}: {e}", path.display()))
}

fn base_url() -> String {
    std::env::var("COMFYUI_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8188".to_string())
}

/// Uploads a local image file to ComfyUI's input directory so a LoadImage
/// node in the workflow can reference it by filename. Returns the filename
/// ComfyUI assigned (usually the same name, but it may rename on collision).
async fn upload_image(client: &reqwest::Client, local_path: &str) -> Result<String, String> {
    let bytes = tokio::fs::read(local_path)
        .await
        .map_err(|e| format!("Couldn't read image at {local_path}: {e}"))?;
    let filename = PathBuf::from(local_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}.png", Uuid::new_v4()));

    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(filename.clone())
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new().part("image", part);

    let url = format!("{}/upload/image", base_url());
    let res = client
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach ComfyUI at {url}: {e}. Is it running?"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("ComfyUI image upload failed ({status}): {text}"));
    }

    #[derive(Deserialize)]
    struct UploadResponse {
        name: String,
    }
    let parsed: UploadResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse ComfyUI upload response: {e}"))?;
    Ok(parsed.name)
}

/// Patches an ImpactWildcardProcessor node's text. Both wildcard_text and
/// populated_text are set (not just one) since it's ambiguous from the
/// exported JSON alone which one ComfyUI actually reads at queue time in
/// "populate" mode without a live instance to test against - setting both
/// is the safe choice.
fn patch_wildcard_node(workflow: &mut Value, node_id: &str, text: &str) {
    if let Some(inputs) = workflow.get_mut(node_id).and_then(|n| n.get_mut("inputs")) {
        inputs["wildcard_text"] = Value::String(text.to_string());
        inputs["populated_text"] = Value::String(text.to_string());
    }
}

fn patch_image_node(workflow: &mut Value, node_id: &str, filename: &str) {
    if let Some(inputs) = workflow.get_mut(node_id).and_then(|n| n.get_mut("inputs")) {
        inputs["image"] = Value::String(filename.to_string());
    }
}

fn patch_image_node_field(workflow: &mut Value, node_id: &str, field: &str, value: &str) {
    if let Some(inputs) = workflow.get_mut(node_id).and_then(|n| n.get_mut("inputs")) {
        inputs[field] = Value::String(value.to_string());
    }
}

/// Appends a `<lora:name:weight>` tag to the LoraManager node's existing
/// text rather than overwriting it, so it doesn't clobber any style LoRAs
/// already dialed in on that node.
fn patch_lora_tag(workflow: &mut Value, node_id: &str, lora_name: &str, weight: f32) {
    if let Some(inputs) = workflow.get_mut(node_id).and_then(|n| n.get_mut("inputs")) {
        let existing = inputs.get("text").and_then(|t| t.as_str()).unwrap_or("").to_string();
        let tag = format!("<lora:{lora_name}:{weight:.2}>");
        inputs["text"] = Value::String(format!("{existing} {tag}").trim().to_string());
    }
}

/// Looks for an execution error in a /history entry's status messages.
/// ComfyUI's history schema nests this as
/// `status.messages: [["execution_error", {node_type, exception_message, ...}], ...]`
/// - written defensively (lots of `.get()`/`.and_then()`) since we're not
/// able to verify this against a live instance here; if the shape doesn't
/// match, this just returns None and the caller falls back to its
/// previous "no output file found" message rather than panicking.
fn find_execution_error(history_entry: &Value) -> Option<String> {
    let messages = history_entry.get("status")?.get("messages")?.as_array()?;

    for message in messages {
        let pair = message.as_array()?;
        let message_type = pair.first()?.as_str()?;
        if message_type != "execution_error" {
            continue;
        }
        let details = pair.get(1)?;
        let node_type = details.get("node_type").and_then(|v| v.as_str()).unwrap_or("unknown node");
        let exception_message = details
            .get("exception_message")
            .and_then(|v| v.as_str())
            .unwrap_or("no details provided");
        return Some(format!("{node_type}: {exception_message}"));
    }
    None
}

#[derive(Serialize)]
struct PromptRequest<'a> {
    prompt: &'a Value,
    client_id: String,
    extra_data: ExtraData<'a>,
}

#[derive(Serialize)]
struct ExtraData<'a> {
    extra_pnginfo: ExtraPngInfo<'a>,
}

#[derive(Serialize)]
struct ExtraPngInfo<'a> {
    // ComfyUI's own web UI always attaches the full graph here for
    // metadata embedding - some nodes (e.g. KJNodes' widget-value lookup,
    // used by the Image Saver's %basemodelname% filename template) read
    // this and crash with `None is not subscriptable` if it's absent,
    // since headless API calls otherwise never populate it. We don't have
    // the true UI-format graph (only the API-format export), so this is
    // the API-format workflow reused as a best-effort stand-in - not
    // byte-for-byte what the real frontend sends, but present and
    // dict-shaped, which is what the crashing code actually needed.
    workflow: &'a Value,
}

#[derive(Deserialize)]
struct PromptResponse {
    prompt_id: String,
}

/// Optional per-call LoRA injection - used once a character has a trained
/// LoRA, to lock in her identity without needing IPAdapter reference images
/// anymore (e.g. for consistent-background generation: LoRA carries "who",
/// IPAdapter on a background reference image carries "where").
pub struct LoraInjection<'a> {
    pub name: &'a str,
    pub weight: f32,
}

/// Generates one image using the named workflow config (see comfyui/configs/
/// and comfyui/README.md for what exists). Returns the local file path of
/// the saved PNG.
///
/// `reference_image_paths` are IPAdapter identity/background references, in
/// the same order as the config's `ipadapter_image_node_ids`; extras beyond
/// the configured node count are ignored, fewer are fine (unfilled slots
/// keep whatever image the workflow file itself already references).
/// `input_image_path` is the I2I source image. `lora` is optional and only
/// meaningful once a character has a trained LoRA.
pub async fn generate_image(
    kind: &str,
    positive_prompt: &str,
    negative_prompt: &str,
    reference_image_paths: &[String],
    input_image_path: Option<&str>,
    lora: Option<LoraInjection<'_>>,
    output_dir: &str,
) -> Result<String, String> {
    let config = load_config(kind)?;
    let mut workflow = load_workflow(&config)?;
    let client = reqwest::Client::new();

    if let Some(node_id) = &config.positive_prompt_node_id {
        patch_wildcard_node(&mut workflow, node_id, positive_prompt);
    }
    if let Some(node_id) = &config.negative_prompt_node_id {
        patch_wildcard_node(&mut workflow, node_id, negative_prompt);
    }
    for (node_id, path) in config.ipadapter_image_node_ids.iter().zip(reference_image_paths) {
        let filename = upload_image(&client, path).await?;
        patch_image_node(&mut workflow, node_id, &filename);
    }
    if let (Some(node_id), Some(path)) = (&config.input_image_node_id, input_image_path) {
        let filename = upload_image(&client, path).await?;
        patch_image_node(&mut workflow, node_id, &filename);
    }
    if let (Some(node_id), Some(lora)) = (&config.lora_tag_node_id, &lora) {
        patch_lora_tag(&mut workflow, node_id, lora.name, lora.weight);
    }

    // Give the output a unique, findable name rather than trusting the
    // custom Image Saver node's default %time_%basemodelname_%seed
    // pattern or its /history output schema (unverified for this node).
    let unique_marker = format!("kotoba_{}", Uuid::new_v4());
    let filename_node_id = config
        .output_filename_node_id
        .clone()
        .unwrap_or_else(|| config.output_node_id.clone());
    patch_image_node_field(&mut workflow, &filename_node_id, "filename", &unique_marker);
    if let Some(path_node_id) = &config.output_path_node_id {
        patch_image_node_field(&mut workflow, path_node_id, "path", "kotoba_app");
    }

    let client_id = Uuid::new_v4().to_string();
    let body = PromptRequest {
        prompt: &workflow,
        client_id,
        extra_data: ExtraData {
            extra_pnginfo: ExtraPngInfo { workflow: &workflow },
        },
    };

    let submit_url = format!("{}/prompt", base_url());
    let res = client
        .post(&submit_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach ComfyUI at {submit_url}: {e}. Is it running?"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        return Err(format!("ComfyUI rejected the workflow ({status}): {text}"));
    }

    let PromptResponse { prompt_id } = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse ComfyUI /prompt response: {e}"))?;

    // Poll /history to detect completion AND check whether the job
    // actually succeeded - a history entry existing means ComfyUI
    // finished the job, but that includes finishing with an error. Not
    // checking for that used to produce a misleading "no output file
    // found" message when the real problem was a node crashing mid-run;
    // now we surface the actual ComfyUI exception instead.
    let history_url = format!("{}/history/{}", base_url(), prompt_id);
    let max_attempts = 150; // 5 minutes at 2s intervals
    let mut completed = false;
    for _ in 0..max_attempts {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let res = client.get(&history_url).send().await.map_err(|e| format!("Couldn't poll ComfyUI history: {e}"))?;
        if !res.status().is_success() {
            continue;
        }
        let history: Value = res.json().await.map_err(|e| format!("Failed to parse ComfyUI history response: {e}"))?;
        let Some(entry) = history.get(&prompt_id) else { continue };

        if let Some(error_message) = find_execution_error(entry) {
            return Err(format!("ComfyUI execution failed: {error_message}"));
        }

        completed = true;
        break;
    }
    if !completed {
        return Err(format!("Timed out waiting for ComfyUI to finish generating (prompt_id {prompt_id})"));
    }

    // Locate the file by our unique marker rather than trusting a
    // specific /history output schema. ComfyUI's real output directory
    // must be reachable on the local filesystem (COMFYUI_OUTPUT_DIR),
    // since we're reading the file directly rather than via /view -
    // avoids needing to guess this custom node's exact filename/counter
    // suffix convention.
    let comfyui_output_dir = std::env::var("COMFYUI_OUTPUT_DIR").unwrap_or_else(|_| "ComfyUI/output".to_string());
    let search_dir = PathBuf::from(&comfyui_output_dir).join("kotoba_app");
    let search_dir = if search_dir.exists() { search_dir } else { PathBuf::from(&comfyui_output_dir) };

    let mut found: Option<PathBuf> = None;
    // Give the filesystem a moment in case /history reports completion
    // fractionally before the file write is flushed to disk.
    for _ in 0..10 {
        if let Ok(mut entries) = tokio::fs::read_dir(&search_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.contains(&unique_marker) {
                    found = Some(entry.path());
                    break;
                }
            }
        }
        if found.is_some() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    let source_path = found.ok_or_else(|| {
        format!(
            "ComfyUI finished but no output file containing '{unique_marker}' was found in {}. \
             Check COMFYUI_OUTPUT_DIR is set correctly (currently '{comfyui_output_dir}').",
            search_dir.display()
        )
    })?;

    tokio::fs::create_dir_all(output_dir).await.map_err(|e| format!("Couldn't create output directory {output_dir}: {e}"))?;
    let extension = source_path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let saved_path = PathBuf::from(output_dir).join(format!("{}.{extension}", Uuid::new_v4()));
    tokio::fs::copy(&source_path, &saved_path).await.map_err(|e| format!("Couldn't copy generated image: {e}"))?;

    Ok(saved_path.to_string_lossy().to_string())
}
