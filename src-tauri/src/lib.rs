mod activation;
mod excel_images;

use activation::device_fingerprint;
use excel_images::extract_images_base64;
use std::fs;

#[tauri::command]
fn read_xlsx_images(path: String) -> Result<Vec<serde_json::Value>, String> {
    let bytes = fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;
    extract_images_base64(&bytes)
}

#[tauri::command]
fn get_fingerprint() -> String {
    device_fingerprint()
}

#[tauri::command]
async fn activate(code: String) -> Result<activation::ActivateResponse, String> {
    let fp = device_fingerprint();
    activation::activate(code, fp).await
}

#[tauri::command]
fn get_platform() -> String {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "darwin-aarch64".into(),
        ("macos", _) => "darwin-x86_64".into(),
        ("windows", _) => "windows-x86_64".into(),
        ("linux", _) => "linux-x86_64".into(),
        (os, arch) => format!("{}-{}", os, arch),
    }
}

#[tauri::command]
async fn validate(code: String) -> Result<activation::ActivateResponse, String> {
    let fp = device_fingerprint();
    activation::validate(code, fp).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![read_xlsx_images, get_fingerprint, activate, validate, get_platform])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
