use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[cfg(debug_assertions)]
const API_BASE: &str = "http://localhost:8787";
#[cfg(not(debug_assertions))]
const API_BASE: &str = "https://profit-admin.xu-wei.space";

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivateRequest {
    pub code: String,
    pub fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivateResponse {
    pub success: bool,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub max_devices: Option<u32>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

/// 生成设备指纹：hostname + OS 的 SHA256
pub fn device_fingerprint() -> String {
    let host = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_default();
    let os = std::env::consts::OS;
    let raw = format!("{}|{}|profit", host, os);
    let hash = Sha256::digest(raw.as_bytes());
    format!("{:x}", hash)
}

/// POST /api/activate
pub async fn activate(code: String, fingerprint: String) -> Result<ActivateResponse, String> {
    let client = reqwest::Client::new();
    let body = ActivateRequest {
        code,
        fingerprint,
    };

    let resp = client
        .post(format!("{}/api/activate", API_BASE))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let data: ActivateResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(data)
}

/// POST /api/validate
pub async fn validate(code: String, fingerprint: String) -> Result<ActivateResponse, String> {
    let client = reqwest::Client::new();
    let body = ActivateRequest {
        code,
        fingerprint,
    };

    let resp = client
        .post(format!("{}/api/validate", API_BASE))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let data: ActivateResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(data)
}
