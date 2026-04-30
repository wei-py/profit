import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { load } from '@tauri-apps/plugin-store'
import { ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useListStore } from '@/stores/list'

/** @type {import('vue').Ref<boolean>} store 是否已初始化 */
const storeInitialized = ref(false)
/** @type {object | null} Tauri Store 实例缓存 */
let storeInstance = null

/**
 * 获取（懒初始化）Tauri Store 实例。
 * @returns {Promise<object>} Store 实例
 */
async function getStore() {
  if (!storeInstance) {
    storeInstance = await load('settings.json', { autoSave: true })
  }
  return storeInstance
}

export function useFileIO() {
  const configStore = useConfigStore()
  const listStore = useListStore()

  /**
   * 从持久化存储恢复上次打开的配置路径并加载文件。
   * @returns {Promise<void>}
   */
  async function restoreLastPath() {
    try {
      const store = await getStore()
      const path = await store.get('lastConfigPath')
      if (path) {
        try {
          const bytes = await readFile(path)
          configStore.loadFromBuffer(bytes, path)
        }
        catch (e) {
          console.error('restoreLastPath: failed to read file', path, e)
          configStore.setFilePath(path)
        }
      }
    }
    catch (e) {
      console.error('restoreLastPath: store unavailable', e)
    }
  }

  /**
   * 将当前配置路径保存到持久化存储。
   * @param {string} path - 文件路径
   * @returns {Promise<void>}
   */
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

  /**
   * 打开系统文件对话框选择配置 Excel 并加载。
   * @returns {Promise<{ success: boolean, error?: string }>} 操作结果
   */
  async function openConfigExcel() {
    try {
      const selected = await open({
        title: '打开配置 Excel',
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        multiple: false,
      })

      if (!selected)
        return { success: false }

      const filePath = typeof selected === 'string' ? selected : selected.path
      const bytes = await readFile(filePath)
      await configStore.loadFromBuffer(bytes, filePath)
      await saveLastPath(filePath)
      return { success: true }
    }
    catch (e) {
      console.error('openConfigExcel failed:', e)
      return { success: false, error: String(e) }
    }
  }

  /**
   * 保存配置 Excel，若未设置路径则弹出保存对话框。
   * @returns {Promise<{ success: boolean, error?: string }>} 操作结果
   */
  async function saveConfigExcel() {
    if (!configStore.loaded)
      return { success: false, error: '没有已加载的配置' }

    try {
      let path = configStore.filePath
      if (!path) {
        const selected = await save({
          title: '保存配置 Excel',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        })
        if (!selected)
          return { success: false }
        path = selected
      }

      const buffer = configStore.getExportBuffer()
      await writeFile(path, buffer)
      configStore.setFilePath(path)
      await saveLastPath(path)
      return { success: true }
    }
    catch (e) {
      console.error('saveConfigExcel failed:', e)
      return { success: false, error: String(e) }
    }
  }

  /**
   * 打开系统文件对话框选择列表 Excel 并加载。
   * @returns {Promise<boolean>} 是否成功
   */
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

  /**
   * 保存列表 Excel，若未设置路径则弹出保存对话框。
   * @param {Array} [headers] - 列头映射
   * @returns {Promise<boolean>} 是否成功
   */
  async function saveListExcel() {
    let path = listStore.filePath
    if (!path) {
      const selected = await save({
        title: '保存商品列表',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (!selected) return false
      path = typeof selected === 'string' ? selected : selected.path
      listStore.filePath = path
    }
    const buffer = listStore.getExportBuffer()
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
