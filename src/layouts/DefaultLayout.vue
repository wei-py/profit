<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const navItems = [
  { path: '/preset', label: '预设', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { path: '/option', label: '选项', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { path: '/template', label: '模板', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/create', label: '新建', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/list', label: '列表', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
]

const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="flex h-screen bg-base-200">
    <aside class="flex flex-col bg-base-100 border-r border-base-300 transition-all duration-300" :class="sidebarCollapsed ? 'w-16' : 'w-56'">
      <div class="flex items-center h-14 px-4 border-b border-base-300">
        <button class="btn btn-ghost btn-sm btn-square" @click="sidebarCollapsed = !sidebarCollapsed">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span v-if="!sidebarCollapsed" class="ml-2 font-semibold text-lg">利润工具</span>
      </div>
      <nav class="flex-1 py-2">
        <ul class="menu menu-vertical w-full">
          <li v-for="item in navItems" :key="item.path">
            <button
              :class="{ 'menu-active': route.path === item.path }"
              @click="router.push(item.path)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
              </svg>
              <span v-if="!sidebarCollapsed">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>
    <main class="flex-1 overflow-auto">
      <div class="p-6">
        <router-view />
      </div>
    </main>
  </div>
</template>
