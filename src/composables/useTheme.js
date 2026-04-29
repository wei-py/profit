import { load } from '@tauri-apps/plugin-store'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'profit-theme'
/** @type {import('vue').Ref<string>} 当前主题值 */
const theme = ref('me')

/**
 * 应用主题到 DOM 属性。
 * @param {string} value - 主题名称
 */
function applyTheme(value) {
  theme.value = value
  document.documentElement.setAttribute('data-theme', value)
}

/** 从 Tauri Store 读取已保存的主题并应用。 */
async function initFromTauri() {
  try {
    const store = await load('settings.json', { autoSave: true })
    const saved = await store.get('theme')
    if (saved === 'me' || saved === 'me-dark') {
      applyTheme(saved)
    }
  }
  catch {
    // Tauri not available, use localStorage value already applied
  }
}

/**
 * 持久化主题到 localStorage 和 Tauri Store。
 * @param {string} value - 主题名称
 */
async function persistTheme(value) {
  localStorage.setItem(STORAGE_KEY, value)
  try {
    const store = await load('settings.json', { autoSave: true })
    await store.set('theme', value)
    await store.save()
  }
  catch {
    // Tauri not available
  }
}

export function useTheme() {
  /** 是否为深色模式 */
  const isDark = computed(() => theme.value === 'me-dark')

  /**
   * 初始化主题，从 localStorage 和 Tauri Store 读取。
   */
  async function init() {
    const local = localStorage.getItem(STORAGE_KEY)
    if (local === 'me' || local === 'me-dark') {
      applyTheme(local)
    }
    await initFromTauri()
  }

  /** 切换浅色/深色主题并持久化。 */
  async function toggleTheme() {
    const next = theme.value === 'me' ? 'me-dark' : 'me'
    applyTheme(next)
    await persistTheme(next)
  }

  return {
    theme,
    isDark,
    init,
    toggleTheme,
  }
}
