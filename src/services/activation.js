import { invoke } from '@tauri-apps/api/core'

/** 获取当前设备指纹 */
export function getFingerprint() {
  return invoke('get_fingerprint')
}

/** 首次激活：验证激活码并绑定设备 */
export function activateCode(code) {
  return invoke('activate', { code })
}

/** 静默校验：已有绑定的设备定期验证 */
export function validateCode(code) {
  return invoke('validate', { code })
}
