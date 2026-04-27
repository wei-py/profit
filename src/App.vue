<script setup>
import { onMounted } from 'vue'
import { useFileIO } from '@/composables/useFileIO'
import { useTheme } from '@/composables/useTheme'

const { restoreLastPath } = useFileIO()
const { init: initTheme } = useTheme()

onMounted(async () => {
  await restoreLastPath()
  await initTheme()
})
</script>

<template>
  <router-view />
</template>
