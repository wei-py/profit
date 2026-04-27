import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { load } from '@tauri-apps/plugin-store'
import { ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useListStore } from '@/stores/list'

const storeInitialized = ref(false)
let storeInstance = null

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load('settings.json', { autoSave: true })
  }
  return storeInstance
}

export function useFileIO() {
  const configStore = useConfigStore()
  const listStore = useListStore()

  async function restoreLastPath() {
    try {
      const store = await getStore()
      const path = await store.get('lastConfigPath')
      if (path) {
        try {
          const bytes = await readFile(path)
          configStore.loadFromBuffer(bytes, path)
        }
        catch {
          configStore.setFilePath(path)
        }
      }
    }
    catch {
      // ignore if store not available
    }
  }

  async function saveLastPath(path) {
    try {
      const store = await getStore()
      await store.set('lastConfigPath', path)
      await store.save()
    }
    catch {
      // ignore
    }
  }

  async function openConfigExcel() {
    const selected = await open({
      title: '打开配置 Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      multiple: false,
    })

    if (!selected)
      return false

    const path = typeof selected === 'string' ? selected : selected.path
    const bytes = await readFile(path)
    configStore.loadFromBuffer(bytes, path)
    await saveLastPath(path)
    return true
  }

  async function saveConfigExcel() {
    if (!configStore.loaded)
      return false

    let path = configStore.filePath
    if (!path) {
      const selected = await save({
        title: '保存配置 Excel',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (!selected)
        return false
      path = selected
    }

    const buffer = configStore.getExportBuffer()
    await writeFile(path, buffer)
    configStore.setFilePath(path)
    await saveLastPath(path)
    return true
  }

  async function openListExcel() {
    const selected = await open({
      title: '打开列表 Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      multiple: false,
    })

    if (!selected)
      return false

    const path = typeof selected === 'string' ? selected : selected.path
    const bytes = await readFile(path)
    listStore.loadFromBuffer(bytes, path)
    return true
  }

  async function saveListExcel(headers) {
    let path = listStore.filePath
    if (!path) {
      const selected = await save({
        title: '保存列表 Excel',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (!selected)
        return false
      path = selected
    }

    const buffer = listStore.getExportBuffer(headers)
    await writeFile(path, buffer)
    return true
  }

  return {
    restoreLastPath,
    openConfigExcel,
    saveConfigExcel,
    openListExcel,
    saveListExcel,
    storeInitialized,
  }
}
