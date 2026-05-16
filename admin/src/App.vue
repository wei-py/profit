<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const isDark = ref(document.documentElement.getAttribute("data-theme") === "me-dark");

function toggleTheme() {
  isDark.value = !isDark.value;
  const next = isDark.value ? "me-dark" : "lofi";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("profit-theme", next);
}

function tabClass(name) {
  return route.name === name ? "btn-primary" : "btn-ghost";
}
</script>

<template>
  <div class="bg-base-200 flex flex-col h-screen">
    <header
      v-if="route.name !== 'login'"
      class="bg-base-100 border-b border-base-300 flex shrink-0 items-center justify-between px-2 sm:px-4 h-10 sm:h-12"
    >
      <div class="flex gap-0.5 sm:gap-1 items-center">
        <button
          @click="router.push('/')"
          class="btn btn-xs sm:btn-sm"
          :class="tabClass('dashboard')"
        >
          激活码
        </button>
        <button
          @click="router.push('/files')"
          class="btn btn-xs sm:btn-sm"
          :class="tabClass('files')"
        >
          文件
        </button>
      </div>
      <div class="flex gap-1 items-center">
        <button
          @click="toggleTheme()"
          class="btn btn-circle btn-ghost btn-xs sm:btn-sm"
          :title="isDark ? '浅色' : '深色'"
        >
          <svg
            v-if="isDark"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
          >
            <path
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </button>
      </div>
    </header>
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
