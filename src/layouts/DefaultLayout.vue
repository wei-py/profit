<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTheme } from "@/composables/useTheme";
import { useTour } from "@/composables/useTour";

const router = useRouter();
const route = useRoute();
const { isDark, toggleTheme } = useTheme();
const { startTour } = useTour();
const appVersion = __APP_VERSION__;

const tabs = [
  {
    label: "配置",
    path: "/country",
  },
  {
    label: "商品",
    path: "/list",
  },
  // {
  //   label: "测试",
  //   path: "/test",
  // },
];

const activeTab = computed(() => {
  return tabs.find(tab => route.path.startsWith(tab.path))?.path || tabs[0].path;
});

const activeTourType = computed(() => (activeTab.value === "/country" ? "country" : "list"));

function goTab(path) {
  if (!path.length) {
    return;
  }
  router.push(path);
}
</script>

<template>
  <div class="bg-base-200 flex flex-col h-screen">
    <!-- 顶部栏 -->
    <header
      class="bg-base-100 border-b border-base-300 flex shrink-0 h-12 items-center justify-between px-4"
    >
      <div class="flex gap-1 items-center">
        <span class="font-bold mr-4 text-lg">利润工具</span>
        <div class="flex gap-1 items-center" data-tour="app-tabs">
          <button
            @click="goTab(t.path)"
            v-for="t in tabs"
            :key="t.path"
            class="btn btn-sm"
            :class="activeTab === t.path ? 'btn-primary' : 'btn-ghost'"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
      <div class="flex gap-1 items-center">
        <button
          @click="toggleTheme()"
          class="btn btn-circle btn-ghost btn-sm"
          data-tour="theme-toggle"
          :title="isDark ? '浅色' : '深色'"
        >
          <svg
            v-if="isDark"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          <svg
            v-else
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </button>
        <div class="dropdown dropdown-end" data-tour="app-help">
          <button class="btn btn-circle btn-ghost btn-sm" tabindex="0" title="帮助">?</button>
          <ul
            class="bg-base-100 border dropdown-content menu mt-1 p-2 rounded-box shadow w-52 z-50"
            tabindex="0"
          >
            <li>
              <button @click="startTour(activeTourType)">当前页面引导</button>
            </li>
            <li>
              <button @click="startTour('overview')">应用概览</button>
            </li>
            <li>
              <button @click="startTour('country')">配置页引导</button>
            </li>
            <li>
              <button @click="startTour('list')">商品页引导</button>
            </li>
            <li class="menu-title text-xs opacity-50">v{{ appVersion }}</li>
          </ul>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1 overflow-auto">
      <div class="h-full px-4 py-3">
        <router-view />
      </div>
    </main>
  </div>
</template>
