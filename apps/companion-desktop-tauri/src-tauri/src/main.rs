use anyhow::{anyhow, Context};
use keyring::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, time::Duration};
use tauri::{AppHandle, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use url::Url;

const SERVICE: &str = "sven-companion-desktop";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DesktopConfig {
  gateway_url: String,
  chat_id: String,
  polling_enabled: bool,
}

impl Default for DesktopConfig {
  fn default() -> Self {
    Self {
      gateway_url: "https://app.sven.systems".into(),
      chat_id: String::new(),
      polling_enabled: true,
    }
  }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base = app.path().app_config_dir().map_err(|e| format!("path error: {e}"))?;
  fs::create_dir_all(&base).map_err(|e| format!("create dir error: {e}"))?;
  Ok(base.join("desktop-config.json"))
}

fn secrets_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base = app.path().app_config_dir().map_err(|e| format!("path error: {e}"))?;
  fs::create_dir_all(&base).map_err(|e| format!("create dir error: {e}"))?;
  Ok(base.join("desktop-secrets.json"))
}

fn read_secret_fallback(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
  let path = secrets_path(app)?;
  if !path.exists() {
    return Ok(None);
  }
  let raw = fs::read_to_string(path).map_err(|e| format!("read secrets error: {e}"))?;
  let map = serde_json::from_str::<serde_json::Map<String, Value>>(&raw)
    .map_err(|e| format!("parse secrets error: {e}"))?;
  Ok(map.get(key).and_then(|v| v.as_str()).map(|v| v.to_string()))
}

fn write_secret_fallback(app: &AppHandle, key: &str, value: Option<&str>) -> Result<(), String> {
  let path = secrets_path(app)?;
  let mut map = if path.exists() {
    let raw = fs::read_to_string(&path).map_err(|e| format!("read secrets error: {e}"))?;
    serde_json::from_str::<serde_json::Map<String, Value>>(&raw)
      .map_err(|e| format!("parse secrets error: {e}"))?
  } else {
    serde_json::Map::new()
  };

  match value {
    Some(v) => {
      map.insert(key.to_string(), Value::String(v.to_string()));
    }
    None => {
      map.remove(key);
    }
  }

  let raw = serde_json::to_string_pretty(&map).map_err(|e| format!("serialize secrets error: {e}"))?;
  fs::write(path, raw).map_err(|e| format!("write secrets error: {e}"))?;
  Ok(())
}

fn ensure_gateway_allowed(gateway_url: &str) -> Result<(), String> {
  let parsed = Url::parse(gateway_url).map_err(|e| format!("invalid gateway url: {e}"))?;
  let host = parsed.host_str().unwrap_or_default().to_lowercase();
  let is_local = host == "localhost"
    || host == "127.0.0.1"
    || host.starts_with("192.168.")
    || host.starts_with("10.")
    || host.starts_with("172.");

  if parsed.scheme() == "https" {
    return Ok(());
  }

  let allow_insecure = std::env::var("SVEN_DESKTOP_ALLOW_INSECURE").ok().as_deref() == Some("1");
  if is_local || allow_insecure {
    return Ok(());
  }

  Err("insecure gateway URL blocked; use https or local network in dev".into())
}

fn build_client() -> Result<Client, String> {
  Client::builder()
    .timeout(Duration::from_secs(15))
    .build()
    .map_err(|e| format!("http client error: {e}"))
}

fn keyring_entry(key: &str) -> Result<Entry, String> {
  Entry::new(SERVICE, key).map_err(|e| format!("keyring init error: {e}"))
}

#[tauri::command]
fn load_config(app: AppHandle) -> Result<DesktopConfig, String> {
  let path = config_path(&app)?;
  if !path.exists() {
    return Ok(DesktopConfig::default());
  }
  let raw = fs::read_to_string(path).map_err(|e| format!("read config error: {e}"))?;
  let cfg = serde_json::from_str::<DesktopConfig>(&raw).map_err(|e| format!("parse config error: {e}"))?;
  Ok(cfg)
}

#[tauri::command]
fn save_config(app: AppHandle, config: DesktopConfig) -> Result<DesktopConfig, String> {
  ensure_gateway_allowed(&config.gateway_url)?;
  let path = config_path(&app)?;
  let raw = serde_json::to_string_pretty(&config).map_err(|e| format!("serialize config error: {e}"))?;
  fs::write(path, raw).map_err(|e| format!("write config error: {e}"))?;
  Ok(config)
}

#[tauri::command]
fn set_secret(app: AppHandle, key: String, value: String) -> Result<(), String> {
  let entry = keyring_entry(&key)?;
  entry
    .set_password(&value)
    .map_err(|e| format!("keyring write error: {e}"))?;
  write_secret_fallback(&app, &key, Some(&value))?;
  Ok(())
}

#[tauri::command]
fn get_secret(app: AppHandle, key: String) -> Result<Option<String>, String> {
  let entry = keyring_entry(&key)?;
  match entry.get_password() {
    Ok(v) => {
      let _ = write_secret_fallback(&app, &key, Some(&v));
      Ok(Some(v))
    }
    Err(_) => read_secret_fallback(&app, &key),
  }
}

#[tauri::command]
fn clear_secret(app: AppHandle, key: String) -> Result<(), String> {
  let entry = keyring_entry(&key)?;
  let _ = entry.delete_credential();
  write_secret_fallback(&app, &key, None)?;
  Ok(())
}

#[tauri::command]
async fn device_start(gateway_url: String) -> Result<Value, String> {
  ensure_gateway_allowed(&gateway_url)?;
  let client = build_client()?;
  let res = client
    .post(format!("{gateway_url}/v1/auth/device/start"))
    .json(&serde_json::json!({
      "client_name": "Sven Companion Desktop Tauri",
      "client_type": "desktop",
      "scope": "chat approvals"
    }))
    .send()
    .await
    .map_err(|e| format!("device start failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("device start http {}: {}", status, body));
  }
  let payload: Value = res.json().await.map_err(|e| format!("device start parse error: {e}"))?;
  Ok(payload.get("data").cloned().unwrap_or(payload))
}

#[tauri::command]
async fn device_poll(gateway_url: String, device_code: String, interval_seconds: u64) -> Result<String, String> {
  ensure_gateway_allowed(&gateway_url)?;
  let client = build_client()?;
  let wait_s = interval_seconds.max(2);
  let deadline = std::time::Instant::now() + Duration::from_secs(10 * 60);

  loop {
    if std::time::Instant::now() > deadline {
      return Err("device flow timed out".into());
    }

    let res = client
      .post(format!("{gateway_url}/v1/auth/device/token"))
      .json(&serde_json::json!({ "device_code": device_code }))
      .send()
      .await
      .map_err(|e| format!("device token failed: {e}"))?;

    let status = res.status();
    if !status.is_success() {
      let body = res.text().await.unwrap_or_default();
      return Err(format!("device token http {}: {}", status, body));
    }

    let payload: Value = res.json().await.map_err(|e| format!("device token parse error: {e}"))?;
    let data = payload.get("data").cloned().unwrap_or(Value::Null);
    let status = data.get("status").and_then(|v| v.as_str()).unwrap_or_default();
    if status == "authorized" {
      let token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "authorized without access_token".to_string())?;
      return Ok(token.to_string());
    }

    tokio::time::sleep(Duration::from_secs(wait_s)).await;
  }
}

#[tauri::command]
async fn refresh_session(gateway_url: String, bearer_token: String) -> Result<String, String> {
  ensure_gateway_allowed(&gateway_url)?;
  let client = build_client()?;
  let res = client
    .post(format!("{gateway_url}/v1/auth/refresh"))
    .bearer_auth(bearer_token)
    .send()
    .await
    .map_err(|e| format!("refresh failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("refresh http {}: {}", status, body));
  }

  let payload: Value = res.json().await.map_err(|e| format!("refresh parse error: {e}"))?;
  let next = payload
    .get("data")
    .and_then(|v| v.get("access_token"))
    .and_then(|v| v.as_str())
    .ok_or_else(|| anyhow!("missing access_token"))
    .context("refresh response invalid")
    .map_err(|e| e.to_string())?;
  Ok(next.to_string())
}

#[tauri::command]
async fn send_message(gateway_url: String, chat_id: String, bearer_token: String, text: String) -> Result<(), String> {
  ensure_gateway_allowed(&gateway_url)?;
  let client = build_client()?;
  let res = client
    .post(format!("{gateway_url}/v1/chats/{chat_id}/messages"))
    .bearer_auth(bearer_token)
    .json(&serde_json::json!({ "text": text }))
    .send()
    .await
    .map_err(|e| format!("send failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("send http {}: {}", status, body));
  }
  Ok(())
}

#[tauri::command]
async fn fetch_approvals(gateway_url: String, bearer_token: String) -> Result<Vec<Value>, String> {
  ensure_gateway_allowed(&gateway_url)?;
  let client = build_client()?;
  let res = client
    .get(format!("{gateway_url}/v1/approvals?status=pending"))
    .bearer_auth(bearer_token)
    .send()
    .await
    .map_err(|e| format!("approvals fetch failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("approvals http {}: {}", status, body));
  }

  let payload: Value = res.json().await.map_err(|e| format!("approvals parse error: {e}"))?;
  let rows = payload
    .get("data")
    .and_then(|d| d.get("rows"))
    .and_then(|r| r.as_array())
    .cloned()
    .unwrap_or_default();
  Ok(rows)
}

#[tauri::command]
async fn fetch_timeline(gateway_url: String, chat_id: String, bearer_token: String, limit: Option<u32>) -> Result<Vec<Value>, String> {
  ensure_gateway_allowed(&gateway_url)?;
  let client = build_client()?;
  let capped_limit = limit.unwrap_or(30).clamp(1, 100);
  let res = client
    .get(format!("{gateway_url}/v1/chats/{chat_id}/messages?limit={capped_limit}"))
    .bearer_auth(bearer_token)
    .send()
    .await
    .map_err(|e| format!("timeline fetch failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("timeline http {}: {}", status, body));
  }

  let payload: Value = res.json().await.map_err(|e| format!("timeline parse error: {e}"))?;
  let rows = payload
    .get("data")
    .and_then(|d| d.get("rows"))
    .and_then(|r| r.as_array())
    .cloned()
    .unwrap_or_default();
  Ok(rows)
}

#[tauri::command]
async fn vote_approval(gateway_url: String, approval_id: String, bearer_token: String, decision: String) -> Result<Value, String> {
  ensure_gateway_allowed(&gateway_url)?;
  if decision != "approve" && decision != "deny" {
    return Err("decision must be approve|deny".into());
  }

  let client = build_client()?;
  let res = client
    .post(format!("{gateway_url}/v1/approvals/{approval_id}/vote"))
    .bearer_auth(bearer_token)
    .json(&serde_json::json!({ "decision": decision }))
    .send()
    .await
    .map_err(|e| format!("approval vote failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("approval vote http {}: {}", status, body));
  }

  let payload: Value = res.json().await.map_err(|e| format!("approval vote parse error: {e}"))?;
  Ok(payload.get("data").cloned().unwrap_or(payload))
}

// ═══════════════════════════════════════════════════════════════════════════
// On-device inference — llama.cpp / Ollama sidecar integration (6.3)
//
// Privacy: inference runs fully on-device via a local Ollama instance or
// llama.cpp process. No data leaves the machine.
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LocalModelInfo {
  id: String,
  name: String,
  variant: String,
  size_bytes: u64,
  context_window: u32,
  capabilities: Vec<String>,
  status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct InferenceRequest {
  prompt: String,
  model: Option<String>,
  max_tokens: Option<u32>,
  temperature: Option<f64>,
  stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InferenceResponse {
  text: String,
  model: String,
  tokens_generated: u32,
  duration_ms: u64,
  tokens_per_second: f64,
}

/// Resolve the Ollama base URL. Prefers env var, falls back to localhost.
fn ollama_url() -> String {
  std::env::var("SVEN_OLLAMA_URL").unwrap_or_else(|_| "http://127.0.0.1:11434".into())
}

#[tauri::command]
async fn inference_check_ollama() -> Result<bool, String> {
  let url = ollama_url();
  let client = build_client()?;
  match client.get(format!("{url}/api/version")).send().await {
    Ok(res) => Ok(res.status().is_success()),
    Err(_) => Ok(false),
  }
}

#[tauri::command]
async fn inference_list_models() -> Result<Vec<LocalModelInfo>, String> {
  let url = ollama_url();
  let client = build_client()?;
  let res = client
    .get(format!("{url}/api/tags"))
    .send()
    .await
    .map_err(|e| format!("ollama tags failed: {e}"))?;

  if !res.status().is_success() {
    return Err(format!("ollama tags http {}", res.status()));
  }

  let payload: Value = res.json().await.map_err(|e| format!("parse error: {e}"))?;
  let models = payload
    .get("models")
    .and_then(|m| m.as_array())
    .cloned()
    .unwrap_or_default();

  let mut result = Vec::new();
  for m in &models {
    let name = m.get("name").and_then(|v| v.as_str()).unwrap_or_default();
    let size = m.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
    let is_gemma = name.to_lowercase().contains("gemma");

    let variant = if name.contains("2b") {
      "e2b"
    } else if name.contains("4b") {
      "e4b"
    } else if name.contains("27b") || name.contains("26b") {
      "moe26b"
    } else {
      "dense31b"
    };

    let mut capabilities = vec!["text".to_string(), "multilingual".to_string()];
    if is_gemma {
      capabilities.push("function_calling".to_string());
      capabilities.push("vision".to_string());
    }

    result.push(LocalModelInfo {
      id: name.to_string(),
      name: name.to_string(),
      variant: variant.to_string(),
      size_bytes: size,
      context_window: if variant == "e2b" || variant == "e4b" { 128_000 } else { 256_000 },
      capabilities,
      status: "ready".to_string(),
    });
  }

  Ok(result)
}

#[tauri::command]
async fn inference_pull_model(model_name: String) -> Result<String, String> {
  let url = ollama_url();
  let client = Client::builder()
    .timeout(Duration::from_secs(600))
    .build()
    .map_err(|e| format!("http client error: {e}"))?;

  let res = client
    .post(format!("{url}/api/pull"))
    .json(&serde_json::json!({ "name": model_name, "stream": false }))
    .send()
    .await
    .map_err(|e| format!("ollama pull failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("ollama pull http {}: {}", status, body));
  }

  let payload: Value = res.json().await.map_err(|e| format!("parse error: {e}"))?;
  let pull_status = payload
    .get("status")
    .and_then(|v| v.as_str())
    .unwrap_or("unknown")
    .to_string();

  Ok(pull_status)
}

#[tauri::command]
async fn inference_delete_model(model_name: String) -> Result<(), String> {
  let url = ollama_url();
  let client = build_client()?;
  let res = client
    .delete(format!("{url}/api/delete"))
    .json(&serde_json::json!({ "name": model_name }))
    .send()
    .await
    .map_err(|e| format!("ollama delete failed: {e}"))?;

  if !res.status().is_success() {
    let body = res.text().await.unwrap_or_default();
    return Err(format!("ollama delete http {}: {}", res.status(), body));
  }
  Ok(())
}

#[tauri::command]
async fn inference_generate(req: InferenceRequest) -> Result<InferenceResponse, String> {
  let url = ollama_url();
  let client = Client::builder()
    .timeout(Duration::from_secs(120))
    .build()
    .map_err(|e| format!("http client error: {e}"))?;

  let model = req.model.unwrap_or_else(|| "gemma3:4b".to_string());
  let max_tokens = req.max_tokens.unwrap_or(512);
  let temperature = req.temperature.unwrap_or(0.7);

  let start = std::time::Instant::now();

  let body = serde_json::json!({
    "model": &model,
    "prompt": &req.prompt,
    "stream": false,
    "options": {
      "num_predict": max_tokens,
      "temperature": temperature,
    }
  });

  let res = client
    .post(format!("{url}/api/generate"))
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("ollama generate failed: {e}"))?;

  let status = res.status();
  if !status.is_success() {
    let err_body = res.text().await.unwrap_or_default();
    return Err(format!("ollama generate http {}: {}", status, err_body));
  }

  let payload: Value = res.json().await.map_err(|e| format!("parse error: {e}"))?;
  let text = payload
    .get("response")
    .and_then(|v| v.as_str())
    .unwrap_or_default()
    .to_string();

  let eval_count = payload
    .get("eval_count")
    .and_then(|v| v.as_u64())
    .unwrap_or(0) as u32;

  let elapsed = start.elapsed();
  let dur_ms = elapsed.as_millis() as u64;
  let tps = if dur_ms > 0 {
    (eval_count as f64 / dur_ms as f64) * 1000.0
  } else {
    0.0
  };

  Ok(InferenceResponse {
    text,
    model,
    tokens_generated: eval_count,
    duration_ms: dur_ms,
    tokens_per_second: tps,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      setup_tray(app.handle())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      load_config,
      save_config,
      set_secret,
      get_secret,
      clear_secret,
      device_start,
      device_poll,
      refresh_session,
      send_message,
      fetch_approvals,
      fetch_timeline,
      vote_approval,
      inference_check_ollama,
      inference_list_models,
      inference_pull_model,
      inference_delete_model,
      inference_generate,
      toggle_overlay,
      show_mini_terminal,
      position_overlay_default
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn main() {
  run();
}

// ═══════════════════════════════════════════════════════════════════════════
// D.2.6 — System tray menu
// ═══════════════════════════════════════════════════════════════════════════

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  let show_main = MenuItemBuilder::with_id("show_main", "Show Sven").build(app)?;
  let toggle_char = MenuItemBuilder::with_id("toggle_overlay", "Toggle Character").build(app)?;
  let quick_cmd = MenuItemBuilder::with_id("quick_command", "Quick Command").build(app)?;
  let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

  let menu = MenuBuilder::new(app)
    .item(&show_main)
    .item(&toggle_char)
    .item(&quick_cmd)
    .separator()
    .item(&quit)
    .build()?;

  let _tray = TrayIconBuilder::new()
    .tooltip("Sven Companion")
    .menu(&menu)
    .on_menu_event(|app, event| {
      match event.id().as_ref() {
        "show_main" => {
          if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_focus();
          }
        }
        "toggle_overlay" => {
          if let Some(win) = app.get_webview_window("overlay") {
            if win.is_visible().unwrap_or(false) {
              let _ = win.hide();
            } else {
              let _ = win.show();
              let _ = win.set_focus();
            }
          }
        }
        "quick_command" => {
          if let Some(win) = app.get_webview_window("mini-terminal") {
            let _ = win.show();
            let _ = win.set_focus();
            let _ = win.center();
          }
        }
        "quit" => {
          std::process::exit(0);
        }
        _ => {}
      }
    })
    .build(app)?;

  Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// D.2.1/D.2.7 — Overlay and mini-terminal window control commands
// ═══════════════════════════════════════════════════════════════════════════

#[tauri::command]
fn toggle_overlay(app: AppHandle) -> Result<bool, String> {
  let win = app
    .get_webview_window("overlay")
    .ok_or_else(|| "overlay window not found".to_string())?;
  let visible = win.is_visible().map_err(|e| format!("visibility check: {e}"))?;
  if visible {
    win.hide().map_err(|e| format!("hide overlay: {e}"))?;
  } else {
    win.show().map_err(|e| format!("show overlay: {e}"))?;
  }
  Ok(!visible)
}

#[tauri::command]
fn show_mini_terminal(app: AppHandle) -> Result<(), String> {
  let win = app
    .get_webview_window("mini-terminal")
    .ok_or_else(|| "mini-terminal window not found".to_string())?;
  win.show().map_err(|e| format!("show mini-terminal: {e}"))?;
  win.center().map_err(|e| format!("center mini-terminal: {e}"))?;
  win.set_focus().map_err(|e| format!("focus mini-terminal: {e}"))?;
  Ok(())
}

// D.3.1-D.3.4 — Cross-platform overlay positioning
#[tauri::command]
fn position_overlay_default(app: AppHandle) -> Result<(), String> {
  let win = app
    .get_webview_window("overlay")
    .ok_or_else(|| "overlay window not found".to_string())?;

  // Get primary monitor to position overlay at bottom-right above taskbar
  let monitor = win.primary_monitor().map_err(|e| format!("monitor: {e}"))?;
  if let Some(mon) = monitor {
    let size = mon.size();
    let pos = mon.position();
    // Position 20px from right edge, 80px from bottom (above taskbar/dock/panel)
    let x = pos.x as i32 + size.width as i32 - 140; // 120px window + 20px margin
    let y = pos.y as i32 + size.height as i32 - 240; // 160px window + 80px taskbar
    win
      .set_position(tauri::PhysicalPosition::new(x, y))
      .map_err(|e| format!("position overlay: {e}"))?;
  }
  win.show().map_err(|e| format!("show overlay: {e}"))?;
  Ok(())
}
