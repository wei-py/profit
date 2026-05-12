<script setup>
import { ref, watch } from "vue";
import { useImageHost } from "@/composables/useImageHost";

const props = defineProps({
  modelValue: {
    default: "",
    type: String,
  },
});

const emit = defineEmits(["update:modelValue"]);

const { addImages, getImageUrls, isURL, pickImages, removeLocalImage } = useImageHost();

const loading = ref(false);
const previewUrls = ref([]);
const showUrlInput = ref(false);
const urlInput = ref("");

function parseImages(val) {
  if (!val || typeof val !== "string")
    return [];
  return val
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

async function refreshPreviews() {
  previewUrls.value = await getImageUrls(props.modelValue);
}

watch(
  () => props.modelValue,
  () => {
    refreshPreviews();
  },
  { immediate: true },
);

async function handleAdd() {
  loading.value = true;
  try {
    const sourcePaths = await pickImages();
    if (!sourcePaths.length)
      return;
    const newPaths = await addImages(sourcePaths);
    const current = parseImages(props.modelValue);
    const combined = [...current, ...newPaths];
    emit("update:modelValue", combined.join(","));
  }
  finally {
    loading.value = false;
  }
}

async function handleRemove(index) {
  const current = parseImages(props.modelValue);
  const removed = current[index];
  if (removed && !isURL(removed)) {
    await removeLocalImage(removed);
  }
  const next = current.filter((_, i) => i !== index);
  emit("update:modelValue", next.join(","));
}

function handleAddUrl() {
  showUrlInput.value = true;
}

function confirmUrl() {
  const trimmed = urlInput.value.trim();
  if (!trimmed)
    return;
  const current = parseImages(props.modelValue);
  emit("update:modelValue", [...current, trimmed].join(","));
  cancelUrl();
}

function cancelUrl() {
  showUrlInput.value = false;
  urlInput.value = "";
}
</script>

<template>
  <div>
    <div v-if="previewUrls.length" class="flex flex-wrap gap-2 mb-2">
      <div v-for="(url, i) in previewUrls" :key="i" class="group relative">
        <img
          @error="$event.target.style.display = 'none'"
          class="border border-base-300 h-20 object-cover rounded w-20"
          :src="url"
        >
        <button
          @click="handleRemove(i)"
          class="-right-2 -top-2 absolute btn btn-circle btn-error btn-xs group-hover:opacity-100 opacity-0 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
    <div v-else class="mb-2 text-base-content/50 text-sm">暂无图片</div>
    <div class="flex gap-2">
      <button @click="handleAdd" class="btn btn-outline btn-sm" :disabled="loading">
        <span v-if="loading" class="loading loading-spinner loading-xs mr-1" />
        添加本地图片
      </button>
      <button v-if="!showUrlInput" @click="handleAddUrl" class="btn btn-ghost btn-sm">
        添加图片链接
      </button>
      <div v-else class="flex gap-1 items-center">
        <input
          v-model="urlInput"
          @keydown.enter="confirmUrl"
          @keydown.escape="cancelUrl"
          class="input input-bordered input-sm"
          placeholder="请输入图片 URL"
        >
        <button @click="confirmUrl" class="btn btn-ghost btn-sm">确认</button>
        <button @click="cancelUrl" class="btn btn-ghost btn-sm">取消</button>
      </div>
    </div>
  </div>
</template>
