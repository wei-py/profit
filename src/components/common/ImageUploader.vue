<script setup>
import { ref, watch } from "vue";
import { useImageHost } from "@/composables/useImageHost";

const props = defineProps({
  modelValue: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);

const { pickImages, addImages, removeLocalImage, getImageUrls, isURL } = useImageHost();

const loading = ref(false);
const previewUrls = ref([]);
const showUrlInput = ref(false);
const urlInput = ref("");

function parseImages(val) {
  if (!val || typeof val !== "string") return [];
  return val
    .split(",")
    .map((s) => s.trim())
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
    if (!sourcePaths.length) return;
    const newPaths = await addImages(sourcePaths);
    const current = parseImages(props.modelValue);
    const combined = [...current, ...newPaths];
    emit("update:modelValue", combined.join(","));
  } finally {
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
  if (!trimmed) return;
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
    <div v-if="previewUrls.length" class="flex gap-2 flex-wrap mb-2">
      <div v-for="(url, i) in previewUrls" :key="i" class="relative group">
        <img
          :src="url"
          class="w-20 h-20 object-cover rounded border border-base-300"
          @error="$event.target.style.display = 'none'"
        />
        <button
          class="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100 transition-opacity"
          @click="handleRemove(i)"
        >
          ✕
        </button>
      </div>
    </div>
    <div v-else class="text-sm text-base-content/50 mb-2">暂无图片</div>
    <div class="flex gap-2">
      <button class="btn btn-sm btn-outline" :disabled="loading" @click="handleAdd">
        <span v-if="loading" class="loading loading-spinner loading-xs mr-1" />
        添加本地图片
      </button>
      <button v-if="!showUrlInput" class="btn btn-sm btn-ghost" @click="handleAddUrl">
        添加图片链接
      </button>
      <div v-else class="flex items-center gap-1">
        <input
          v-model="urlInput"
          class="input input-bordered input-sm"
          placeholder="请输入图片 URL"
          @keydown.enter="confirmUrl"
          @keydown.escape="cancelUrl"
        />
        <button class="btn btn-sm btn-ghost" @click="confirmUrl">确认</button>
        <button class="btn btn-sm btn-ghost" @click="cancelUrl">取消</button>
      </div>
    </div>
  </div>
</template>
