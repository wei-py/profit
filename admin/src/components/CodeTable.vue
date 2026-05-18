<script setup>
import dayjs from "dayjs";
import { ref } from "vue";

const props = defineProps({
  codes: { type: Array, default: () => [] },
  loading: { default: false, type: Boolean },
});

const emit = defineEmits(["detail", "delete", "remark", "edit"]);

const confirmCode = ref("");

function statusBadge(status) {
  if (status === "active")
    return "badge-success";
  if (status === "revoked")
    return "badge-error";
  return "badge-warning";
}

function formatTime(t) {
  if (!t)
    return "永久";
  const s = String(t).replace(" ", "T") + (String(t).includes("Z") ? "" : "Z");
  return dayjs(s).format("YYYY-MM-DD HH:mm");
}

function handleDelete(code) {
  confirmCode.value = code;
}

function confirmDelete() {
  emit("delete", confirmCode.value);
  confirmCode.value = "";
}

function remarkPreview(text) {
  if (!text)
    return "";
  return text.length > 8 ? `${text.slice(0, 8)}...` : text;
}
</script>

<template>
  <!-- 桌面表格 -->
  <div class="hidden sm:block overflow-auto">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>激活码</th>
          <th>状态</th>
          <th>备注</th>
          <th>最大设备</th>
          <th>已用</th>
          <th>剩余</th>
          <th>创建时间</th>
          <th>过期时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in codes" :key="c.code">
          <td class="font-mono">{{ c.code }}</td>
          <td>
            <span class="badge badge-sm" :class="statusBadge(c.status)">
              {{ c.status }}
            </span>
          </td>
          <td
            @click="emit('remark', { code: c.code, remark: c.remark })"
            class="cursor-pointer text-base-content/60 text-xs hover:underline"
          >
            {{ remarkPreview(c.remark) }}
          </td>
          <td>{{ c.max_devices }}</td>
          <td>{{ c.used_cnt }}</td>
          <td>{{ c.remaining }}</td>
          <td class="text-xs">{{ formatTime(c.created_at) }}</td>
          <td class="text-xs">{{ formatTime(c.expires_at) }}</td>
          <td>
            <div class="flex gap-1">
              <button @click="emit('detail', c.code)" class="btn btn-xs btn-ghost">详情</button>
              <button @click="emit('edit', c)" class="btn btn-xs btn-ghost">编辑</button>
              <button @click="handleDelete(c.code)" class="btn btn-xs btn-ghost text-error">
                删除
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 移动端卡片 -->
  <div class="sm:hidden flex flex-col gap-2">
    <div v-for="c in codes" :key="c.code" class="bg-base-100 border border-base-300 card card-sm">
      <div class="card-body p-3">
        <div class="flex items-center justify-between">
          <span class="font-mono font-semibold text-sm">{{ c.code }}</span>
          <span class="badge badge-sm" :class="statusBadge(c.status)">{{ c.status }}</span>
        </div>
        <div
          v-if="c.remark"
          @click="emit('remark', { code: c.code, remark: c.remark })"
          class="text-xs text-base-content/50 truncate cursor-pointer hover:underline"
        >
          {{ c.remark }}
        </div>
        <div class="flex gap-3 text-xs">
          <span>设备 {{ c.used_cnt }}/{{ c.max_devices }}</span>
          <span>剩余 {{ c.remaining }}</span>
        </div>
        <div class="flex gap-3 text-xs text-base-content/50">
          <span>创建 {{ formatTime(c.created_at) }}</span>
        </div>
        <div class="text-xs text-base-content/50">
          <span>过期 {{ formatTime(c.expires_at) }}</span>
        </div>
        <div class="flex gap-1 mt-1">
          <button @click="emit('detail', c.code)" class="btn btn-xs btn-outline flex-1">
            详情
          </button>
          <button @click="emit('edit', c)" class="btn btn-xs btn-outline flex-1">编辑</button>
          <button @click="handleDelete(c.code)" class="btn btn-xs btn-outline text-error flex-1">
            删除
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认 -->
  <dialog v-if="confirmCode" class="modal modal-open">
    <div class="modal-box max-w-full sm:max-w-md">
      <h3 class="font-bold text-lg">确认删除</h3>
      <p class="py-2">
        确定要删除/撤销激活码 <span class="font-mono break-all">{{ confirmCode }}</span> 吗？
      </p>
      <div class="modal-action">
        <button @click="confirmCode = ''" class="btn btn-sm">取消</button>
        <button @click="confirmDelete" class="btn btn-sm btn-error">确认</button>
      </div>
    </div>
    <form class="modal-backdrop" method="dialog">
      <button @click="confirmCode = ''" />
    </form>
  </dialog>
</template>
