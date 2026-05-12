<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useTour } from '@/composables/useTour'

const router = useRouter()
const route = useRoute()
const { isDark, toggleTheme } = useTheme()
const { startTour } = useTour()

const tabs = [
  { path: '/country', label: '配置' },
  { path: '/list', label: '商品' },
]

const activeTab = computed(() => {
  if (route.path.startsWith('/list'))
    return '/list'
  return '/country'
})

function goTab(path) {
  router.push(path)
}
</script>

<template>
  <div class="flex flex-col h-screen bg-base-200">
    <!-- 顶部栏 -->
    <header
      class="flex items-center justify-between h-12 px-4 bg-base-100 border-b border-base-300 flex-shrink-0"
    >
      <div class="flex items-center gap-1">
        <span class="font-bold text-lg mr-4">利润工具</span>
        <button
          v-for="t in tabs"
          :key="t.path"
          class="btn btn-sm"
          :class="activeTab === t.path ? 'btn-primary' : 'btn-ghost'"
          @click="goTab(t.path)"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="btn btn-ghost btn-sm btn-circle"
          :title="isDark ? '浅色' : '深色'"
          @click="toggleTheme()"
        >
          <svg
            v-if="isDark"
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </button>
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-sm btn-circle">
            ?
          </button>
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow border mt-1"
          >
            <li>
              <button @click="startTour('overview')">
                应用概览
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1 overflow-hidden">
      <div class="py-3 px-4 h-full">
        <router-view />
      </div>
    </main>
  </div>
</template>
