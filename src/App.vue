<script setup>
import { onMounted } from 'vue'
import { useFileIO } from '@/composables/useFileIO'
import { useTheme } from '@/composables/useTheme'

const { restoreLastPath } = useFileIO()
const { init: initTheme } = useTheme()

/**
 * 应用根组件。
 * 启动时恢复上次打开的配置并初始化主题。
 */
onMounted(async () => {
  await restoreLastPath()
  await initTheme()
})
</script>

<template>
  <router-view />
</template>
