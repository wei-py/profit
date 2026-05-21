<script setup>
import { ref } from "vue";

const props = defineProps({
  showJump: { default: false, type: Boolean },
  showTotal: { default: false, type: Boolean },
  total: { default: undefined, type: Number },
  totalPages: { required: true, type: Number },
});

const currentPage = defineModel("currentPage", { required: true, type: Number });
const pageSize = defineModel("pageSize", { required: true, type: Number });

const jumpInput = ref("");

function normalizePageSize() {
  pageSize.value = Math.max(1, Number(pageSize.value) || 1);
}

function prevPage() {
  if (currentPage.value > 1)
    currentPage.value--;
}

function nextPage() {
  if (currentPage.value < props.totalPages)
    currentPage.value++;
}

function doJump() {
  const n = Number(jumpInput.value);
  if (n >= 1 && n <= props.totalPages) {
    currentPage.value = n;
    jumpInput.value = "";
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs">
    <span v-if="showTotal && total !== undefined" class="whitespace-nowrap">共 {{ total }} 行</span>

    <div class="join">
      <input
        v-model.number="pageSize"
        @blur="normalizePageSize"
        @keyup.enter="normalizePageSize"
        class="input input-bordered input-xs join-item w-16"
        min="1"
        type="number"
      >
      <span class="join-item flex items-center border border-base-300 bg-base-100 px-2">条/页</span>
    </div>

    <div class="join">
      <button
        @click="prevPage"
        class="btn btn-ghost btn-xs join-item"
        :disabled="currentPage <= 1"
      >
        ◀
      </button>
      <span class="join-item flex items-center border border-base-300 bg-base-100 px-3">
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button
        @click="nextPage"
        class="btn btn-ghost btn-xs join-item"
        :disabled="currentPage >= totalPages"
      >
        ▶
      </button>
    </div>

    <div v-if="showJump" class="join">
      <input
        v-model="jumpInput"
        @keyup.enter="doJump"
        class="input input-bordered input-xs join-item w-14"
        placeholder="页"
        type="number"
      >
      <button @click="doJump" class="btn btn-ghost btn-xs join-item">跳转</button>
    </div>
  </div>
</template>
