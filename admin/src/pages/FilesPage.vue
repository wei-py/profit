<script setup>
import { computed, onMounted, ref } from "vue";
import { createFolder, deleteFile, downloadFile, getFileDownloadUrl, listFiles, renameFile, toggleFilePublic, uploadFile } from "@/api/admin";

const breadcrumb = ref([]);
const items = ref([]);
const loading = ref(false);
const error = ref("");
const dropActive = ref(false);
const uploadInput = ref(null);

const showNewFolder = ref(false);
const newFolderName = ref("");

const editingId = ref(null);
const editName = ref("");

const conflictFile = ref(null);
const deleteTarget = ref(null);
const toast = ref("");

const currentParentId = computed(() => {
  if (breadcrumb.value.length === 0) {
    return null;
  }
  return breadcrumb.value[breadcrumb.value.length - 1].id;
});

onMounted(() => {
  fetchItems();
});

async function fetchItems() {
  loading.value = true;
  error.value = "";
  try {
    const resp = await listFiles(currentParentId.value);
    if (resp.success) {
      items.value = resp.items;
    }
    else {
      error.value = resp.error || "获取列表失败";
    }
  }
  catch (e) {
    error.value = e.message || "网络错误";
  }
  loading.value = false;
}

function enterFolder(item) {
  breadcrumb.value.push({ id: item.id, name: item.name });
  fetchItems();
}

function navigateToBreadcrumb(index) {
  breadcrumb.value = breadcrumb.value.slice(0, index + 1);
  fetchItems();
}

function formatSize(bytes) {
  if (!bytes) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(item) {
  if (item.type === "folder") {
    return "文件夹";
  }
  if (item.mime_type) {
    if (item.mime_type.startsWith("image/")) {
      return "图片";
    }
    if (item.mime_type.includes("pdf")) {
      return "PDF";
    }
    if (item.mime_type.includes("spreadsheet") || item.mime_type.includes("excel")) {
      return "Excel";
    }
    if (item.mime_type.startsWith("text/")) {
      return "文本";
    }
  }
  return "文件";
}

function timeLabel(t) {
  if (!t) {
    return "-";
  }
  return t.replace("T", " ").slice(0, 16);
}

function startNewFolder() {
  showNewFolder.value = true;
  newFolderName.value = "";
  setTimeout(() => {
    const el = document.getElementById("new-folder-input");
    if (el) {
      el.focus();
    }
  }, 50);
}

async function confirmNewFolder() {
  const name = newFolderName.value.trim();
  if (!name) {
    showNewFolder.value = false;
    return;
  }
  try {
    const resp = await createFolder(name, currentParentId.value);
    if (resp.success) {
      showNewFolder.value = false;
      await fetchItems();
    }
    else {
      error.value = resp.error || "创建失败";
    }
  }
  catch (e) {
    error.value = e.message || "网络错误";
  }
}

function cancelNewFolder() {
  showNewFolder.value = false;
  newFolderName.value = "";
}

function triggerUpload() {
  uploadInput.value?.click();
}

async function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) {
    return;
  }
  await doUpload(file);
  e.target.value = "";
}

async function doUpload(file, overwrite = false) {
  loading.value = true;
  error.value = "";
  try {
    const resp = await uploadFile(file, currentParentId.value, overwrite);
    if (resp.success) {
      await fetchItems();
    }
    else if (resp.conflict) {
      conflictFile.value = file;
    }
    else {
      error.value = resp.error || "上传失败";
    }
  }
  catch (e) {
    error.value = e.message || "网络错误";
  }
  loading.value = false;
}

async function confirmOverwrite() {
  const file = conflictFile.value;
  conflictFile.value = null;
  if (file) {
    await doUpload(file, true);
  }
}

function onDragOver(e) {
  e.preventDefault();
  dropActive.value = true;
}

function onDragLeave() {
  dropActive.value = false;
}

async function onDrop(e) {
  e.preventDefault();
  dropActive.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    await doUpload(file);
  }
}

function startRename(item) {
  editingId.value = item.id;
  editName.value = item.name;
  setTimeout(() => {
    const el = document.getElementById(`rename-input-${item.id}`);
    if (el) {
      el.focus();
      el.select();
    }
  }, 50);
}

async function confirmRename() {
  const id = editingId.value;
  const name = editName.value.trim();
  editingId.value = null;
  if (!id || !name) {
    return;
  }
  try {
    const resp = await renameFile(id, name);
    if (resp.success) {
      await fetchItems();
    }
    else {
      error.value = resp.error || "重命名失败";
    }
  }
  catch (e) {
    error.value = e.message || "网络错误";
  }
}

function cancelRename() {
  editingId.value = null;
  editName.value = "";
}

function handleRenameKey(e) {
  if (e.key === "Enter") {
    confirmRename();
  }
  if (e.key === "Escape") {
    cancelRename();
  }
}

async function handleTogglePublic(item) {
  try {
    const resp = await toggleFilePublic(item.id);
    if (resp.success) {
      item.is_public = resp.is_public ? 1 : 0;
      item._publicUrl = resp.url;
    }
    else {
      error.value = resp.error || "操作失败";
    }
  }
  catch (e) {
    error.value = e.message || "网络错误";
  }
}

function copyLink(item) {
  const url = item._publicUrl || getFileDownloadUrl(item.r2_key);
  navigator.clipboard.writeText(url).then(() => {
    toast.value = "链接已复制";
    setTimeout(() => {
      toast.value = "";
    }, 2000);
  }).catch(() => {
    error.value = "复制失败";
  });
}

async function handleDownload(item) {
  if (item.is_public && item.r2_key) {
    window.open(getFileDownloadUrl(item.r2_key), "_blank");
    return;
  }
  const resp = await downloadFile(item.id, item.name);
  if (!resp.success) {
    error.value = resp.error || "下载失败";
  }
}

function handleDelete(item) {
  deleteTarget.value = item;
}

async function confirmDelete() {
  const item = deleteTarget.value;
  deleteTarget.value = null;
  if (!item) {
    return;
  }
  try {
    const resp = await deleteFile(item.id);
    if (resp.success) {
      await fetchItems();
    }
    else {
      error.value = resp.error || "删除失败";
    }
  }
  catch (e) {
    error.value = e.message || "网络错误";
  }
}
</script>

<template>
  <div
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
    class="h-full px-4 py-3 flex flex-col gap-3"
  >
    <!-- 面包屑 -->
    <div class="flex items-center gap-1 text-xs sm:text-sm overflow-x-auto">
      <button
        @click="navigateToBreadcrumb(-1)"
        class="btn btn-xs btn-ghost whitespace-nowrap"
      >
        📂 根目录
      </button>
      <template v-for="(crumb, i) in breadcrumb" :key="crumb.id">
        <span class="text-base-content/40">/</span>
        <button
          v-if="i < breadcrumb.length - 1"
          @click="navigateToBreadcrumb(i)"
          class="btn btn-xs btn-ghost whitespace-nowrap"
        >
          {{ crumb.name }}
        </button>
        <span v-else class="font-bold text-xs sm:text-sm whitespace-nowrap">{{ crumb.name }}</span>
      </template>
    </div>

    <!-- 操作栏 -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="flex gap-1 items-center flex-wrap">
        <button
          @click="startNewFolder"
          class="btn btn-xs sm:btn-sm btn-primary"
        >
          📁 新建文件夹
        </button>
        <button
          @click="triggerUpload"
          class="btn btn-xs sm:btn-sm btn-ghost"
        >
          ⬆ 上传文件
        </button>
        <input
          @change="handleFileSelect"
          ref="uploadInput"
          class="hidden"
          type="file"
        >
        <span class="text-xs text-base-content/50 ml-2">共 {{ items.length }} 项</span>
      </div>
      <button
        @click="fetchItems"
        class="btn btn-xs sm:btn-sm btn-ghost"
      >
        刷新
      </button>
    </div>

    <!-- 新建文件夹输入 -->
    <div v-if="showNewFolder" class="flex items-center gap-2">
      <input
        v-model="newFolderName"
        @keydown.enter="confirmNewFolder"
        @keydown.escape="cancelNewFolder"
        id="new-folder-input"
        class="input input-sm input-bordered"
        placeholder="文件夹名称"
      >
      <button
        @click="confirmNewFolder"
        class="btn btn-sm btn-primary"
      >
        确认
      </button>
      <button
        @click="cancelNewFolder"
        class="btn btn-sm btn-ghost"
      >
        取消
      </button>
    </div>

    <!-- 错误 -->
    <div v-if="error" class="alert alert-error">
      <span>{{ error }}</span>
      <button
        @click="error = ''"
        class="btn btn-xs btn-ghost"
      >
        ✕
      </button>
    </div>

    <!-- 加载 -->
    <div v-if="loading" class="flex justify-center py-10">
      <span class="loading loading-lg loading-spinner" />
    </div>

    <!-- 拖拽覆盖层 -->
    <div
      v-if="dropActive"
      class="bg-base-200/80 border-2 border-dashed border-primary flex h-40 items-center justify-center rounded-box text-base-content/50"
    >
      释放文件以上传
    </div>

    <!-- 文件表格 (桌面) -->
    <div v-if="!loading && items.length > 0" class="hidden sm:block overflow-auto flex-1">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>大小</th>
            <th>公开</th>
            <th>修改时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <!-- 名称 -->
            <td>
              <div
                v-if="item.type === 'folder'"
                @click="enterFolder(item)"
                class="cursor-pointer hover:underline"
              >
                📁 {{ item.name }}
              </div>
              <template v-else>
                <span v-if="editingId !== item.id">📄 {{ item.name }}</span>
                <div v-else class="flex items-center gap-1">
                  <input
                    v-model="editName"
                    @blur="confirmRename"
                    @keydown="handleRenameKey"
                    :id="`rename-input-${item.id}`"
                    class="input input-xs input-bordered"
                  >
                </div>
              </template>
            </td>
            <!-- 类型 -->
            <td class="text-xs text-base-content/60">{{ typeLabel(item) }}</td>
            <!-- 大小 -->
            <td class="text-xs text-base-content/60">
              {{ item.type === 'folder' ? '-' : formatSize(item.size) }}
            </td>
            <!-- 公开 -->
            <td>
              <div v-if="item.type === 'folder'" class="text-base-content/30 text-xs">
                -
              </div>
              <div v-else class="flex items-center gap-1">
                <input
                  @change="handleTogglePublic(item)"
                  :checked="item.is_public === 1"
                  class="toggle toggle-sm"
                  type="checkbox"
                >
                <button
                  v-if="item.is_public === 1"
                  @click="copyLink(item)"
                  class="btn btn-xs btn-ghost btn-circle"
                  title="复制链接"
                >
                  🔗
                </button>
              </div>
            </td>
            <!-- 修改时间 -->
            <td class="text-xs text-base-content/50">{{ timeLabel(item.updated_at) }}</td>
            <!-- 操作 -->
            <td>
              <div class="flex gap-1">
                <button
                  v-if="item.type === 'folder'"
                  @click="enterFolder(item)"
                  class="btn btn-xs btn-ghost"
                >
                  打开
                </button>
                <button
                  v-else
                  @click="handleDownload(item)"
                  class="btn btn-xs btn-ghost"
                >
                  下载
                </button>
                <button
                  @click="startRename(item)"
                  class="btn btn-xs btn-ghost"
                >
                  改名
                </button>
                <button
                  @click="handleDelete(item)"
                  class="btn btn-xs btn-ghost text-error"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 文件卡片 (移动端) -->
    <div v-if="!loading && items.length > 0" class="sm:hidden flex flex-col gap-2 overflow-auto flex-1">
      <div v-for="item in items" :key="item.id" class="bg-base-100 border border-base-300 card card-sm">
        <div class="card-body p-3">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-sm truncate mr-2">{{ item.name }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-base-content/50">
            <span>{{ typeLabel(item) }}</span>
            <span v-if="item.type !== 'folder'">· {{ formatSize(item.size) }}</span>
          </div>
          <div class="text-xs text-base-content/50">
            修改: {{ timeLabel(item.updated_at) }}
          </div>
          <div class="flex gap-1 mt-1">
            <template v-if="item.type === 'folder'">
              <button @click="enterFolder(item)" class="btn btn-xs btn-outline flex-1">打开</button>
            </template>
            <template v-else>
              <button @click="handleDownload(item)" class="btn btn-xs btn-outline flex-1">下载</button>
            </template>
            <button
              v-if="editingId !== item.id"
              @click="startRename(item)"
              class="btn btn-xs btn-ghost"
            >改名</button>
            <div v-else class="flex items-center gap-1">
              <input
                v-model="editName"
                @blur="confirmRename"
                @keydown="handleRenameKey"
                :id="`rename-input-${item.id}`"
                class="input input-xs input-bordered w-24"
              >
            </div>
            <button @click="handleDelete(item)" class="btn btn-xs btn-ghost text-error">删除</button>
          </div>
          <div v-if="item.type !== 'folder'" class="flex items-center gap-1 mt-1 text-xs">
            <input
              @change="handleTogglePublic(item)"
              :checked="item.is_public === 1"
              class="toggle toggle-xs"
              type="checkbox"
            >
            <span class="text-base-content/50">公开</span>
            <button
              v-if="item.is_public === 1"
              @click="copyLink(item)"
              class="btn btn-xs btn-ghost btn-circle"
              title="复制链接"
            >
              🔗
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="!loading && items.length === 0 && !error"
      class="bg-base-200/50 border-2 border-dashed border-base-300 flex flex-col flex-1 items-center justify-center rounded-box text-base-content/40 gap-2"
    >
      <div class="text-4xl">📂</div>
      <div>暂无文件，拖拽文件到此处或点击上传</div>
    </div>

    <!-- 同名覆盖确认 -->
    <dialog v-if="conflictFile" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">文件已存在</h3>
        <p class="py-2">
          同名文件 <span class="font-mono">{{ conflictFile.name }}</span> 已存在，是否覆盖？
        </p>
        <div class="modal-action">
          <button
            @click="conflictFile = null"
            class="btn btn-sm"
          >
            取消
          </button>
          <button
            @click="confirmOverwrite"
            class="btn btn-sm btn-warning"
          >
            覆盖
          </button>
        </div>
      </div>
      <form class="modal-backdrop" method="dialog">
        <button @click="conflictFile = null" />
      </form>
    </dialog>

    <!-- 删除确认 -->
    <dialog v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">确认删除</h3>
        <p class="py-2">
          确定要删除
          <span class="font-mono">{{ deleteTarget.name }}</span>
          <template v-if="deleteTarget.type === 'folder'"> 及其中的所有文件</template>
          吗？此操作不可恢复。
        </p>
        <div class="modal-action">
          <button
            @click="deleteTarget = null"
            class="btn btn-sm"
          >
            取消
          </button>
          <button
            @click="confirmDelete"
            class="btn btn-sm btn-error"
          >
            确认删除
          </button>
        </div>
      </div>
      <form class="modal-backdrop" method="dialog">
        <button @click="deleteTarget = null" />
      </form>
    </dialog>

    <!-- Toast -->
    <div v-if="toast" class="toast toast-top toast-end">
      <div class="alert alert-success">
        <span>{{ toast }}</span>
      </div>
    </div>
  </div>
</template>
