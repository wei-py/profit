<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useTour } from '@/composables/useTour'

const router = useRouter()
const route = useRoute()

const { isDark, toggleTheme } = useTheme()
const { startTour } = useTour()

/** 各页面的 tooltip 描述映射 */
const tooltipMap = {
  preset: '预设管理：创建和管理利润计算预设，定义参数列表',
  option: '选项分组：为选择型字段提供下拉选项，如颜色、尺寸',
  template: '规则模板：配置条件树与动作，管理查找表',
  create: '新建记录：选择预设填写参数，一键计算利润',
  list: '记录列表：查看、编辑和删除已保存的记录',
}

/** 当前页面对应的 tooltip 文本 */
const pageTooltip = computed(() => {
  const name = typeof route.name === 'string' ? route.name : ''
  return tooltipMap[name] || '利润工具：管理产品利润计算的配置与记录'
})

/**
 * 获取当前路由对应的引导页面名称。
 * @returns {string} 页面引导 key
 */
function getTourPageName() {
  const name = typeof route.name === 'string' ? route.name : ''
  return name === '/' ? 'preset' : name
}

/** 侧边栏导航项定义 */
const navItems = [
  { path: '/preset', label: '预设', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { path: '/option', label: '选项', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  { path: '/template', label: '模板', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/create', label: '新建', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/list', label: '列表', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
]

/** @type {import('vue').Ref<boolean>} 侧边栏是否折叠 */
const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="flex h-screen bg-base-200">
    <aside class="flex flex-col bg-base-100 border-r border-base-300 transition-all duration-300" :class="sidebarCollapsed ? 'w-16' : 'w-56'">
      <div class="flex items-center h-14 px-4 border-b border-base-300">
        <button class="btn btn-ghost btn-sm btn-square" data-tour="sidebar-collapse" @click="sidebarCollapsed = !sidebarCollapsed">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span v-if="!sidebarCollapsed" class="ml-2 font-semibold text-lg">利润工具</span>
      </div>
      <nav class="flex-1 py-2" data-tour="sidebar-nav">
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
      <div class="py-2 border-t border-base-300">
        <button class="btn btn-ghost w-full justify-start rounded-none" data-tour="theme-toggle" @click="toggleTheme()">
          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="ml-2">{{ isDark ? '浅色' : '深色' }}</span>
        </button>
        <div class="dropdown dropdown-top mt-1 w-full">
          <button tabindex="0" role="button" class="btn btn-ghost w-full justify-start rounded-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span v-if="!sidebarCollapsed" class="ml-2">帮助</span>
          </button>
          <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[9999] w-52 p-2 shadow border border-base-300">
            <li>
              <button @click="startTour(getTourPageName())">
                当前页面引导
              </button>
            </li>
            <li>
              <button @click="startTour('overview')">
                应用概览
              </button>
            </li>
          </ul>
        </div>
      </div>
    </aside>
    <main class="flex-1 overflow-hidden">
      <div class="py-3 px-6 h-full">
        <router-view />
      </div>
    </main>

    <div class="tooltip tooltip-left fixed bottom-4 right-4 z-50" :data-tip="pageTooltip">
      <button class="btn btn-circle btn-primary btn-sm text-lg font-bold">
        ?
      </button>
    </div>
  </div>
</template>
