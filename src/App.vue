<script setup>
import { onMounted } from 'vue'
import { useFileIO } from '@/composables/useFileIO'

const { restoreLastPath } = useFileIO()

onMounted(async () => {
  await restoreLastPath()
})
</script>

<template>
  <router-view />
</template>
