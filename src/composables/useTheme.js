import { load } from '@tauri-apps/plugin-store'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'profit-theme'
const theme = ref('me')

function applyTheme(value) {
  theme.value = value
  document.documentElement.setAttribute('data-theme', value)
}

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
  const isDark = computed(() => theme.value === 'me-dark')

  async function init() {
    const local = localStorage.getItem(STORAGE_KEY)
    if (local === 'me' || local === 'me-dark') {
      applyTheme(local)
    }
    await initFromTauri()
  }

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
