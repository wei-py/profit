<script setup>
import dayjs from "dayjs";
import { ref } from "vue";

const props = defineProps({
  codes: { type: Array, default: () => [] },
  loading: { default: false, type: Boolean },
});

const emit = defineEmits(["detail", "delete"]);

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
  return dayjs(t).format("YYYY-MM-DD HH:mm");
}

function handleDelete(code) {
  confirmCode.value = code;
}

function confirmDelete() {
  emit("delete", confirmCode.value);
  confirmCode.value = "";
}
</script>

<template>
  <div class="overflow-auto">
    <table class="table table-sm">
      <thead>
        <tr>
          <th>激活码</th>
          <th>状态</th>
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
          <td>{{ c.max_devices }}</td>
          <td>{{ c.used }}</td>
          <td>{{ c.remaining }}</td>
          <td class="text-xs">{{ formatTime(c.created_at) }}</td>
          <td class="text-xs">{{ formatTime(c.expires_at) }}</td>
          <td>
            <div class="flex gap-1">
              <button @click="emit('detail', c.code)" class="btn btn-xs btn-ghost">
                详情
              </button>
              <button @click="handleDelete(c.code)" class="btn btn-xs btn-ghost text-error">
                删除
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 删除确认 -->
    <dialog v-if="confirmCode" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">确认删除</h3>
        <p class="py-2">确定要删除/撤销激活码 <span class="font-mono">{{ confirmCode }}</span> 吗？</p>
        <div class="modal-action">
          <button @click="confirmCode = ''" class="btn btn-sm">取消</button>
          <button @click="confirmDelete" class="btn btn-sm btn-error">确认</button>
        </div>
      </div>
      <form class="modal-backdrop" method="dialog">
        <button @click="confirmCode = ''" />
      </form>
    </dialog>
  </div>
</template>
