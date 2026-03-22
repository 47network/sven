use anyhow::{anyhow, Context};
use keyring::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, time::Duration};
use tauri::{AppHandle, Manager};
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
      gateway_url: "http://127.0.0.1:3001".into(),
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
fn set_secret(key: String, value: String) -> Result<(), String> {
  let entry = keyring_entry(&key)?;
  entry.set_password(&value).map_err(|e| format!("keyring write error: {e}"))
}

#[tauri::command]
fn get_secret(key: String) -> Result<Option<String>, String> {
  let entry = keyring_entry(&key)?;
  match entry.get_password() {
    Ok(v) => Ok(Some(v)),
    Err(_) => Ok(None),
  }
}

#[tauri::command]
fn clear_secret(key: String) -> Result<(), String> {
  let entry = keyring_entry(&key)?;
  let _ = entry.delete_credential();
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      vote_approval
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn main() {
  run();
}
