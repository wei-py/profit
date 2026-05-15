<script setup>
import dayjs from "dayjs";
import { useAdminStore } from "@/stores/admin";

const emit = defineEmits(["close"]);
const store = useAdminStore();

const code = store.detail;
const devices = store.detailDevices;

function formatTime(t) {
  if (!t)
    return "-";
  return dayjs(t).format("YYYY-MM-DD HH:mm");
}

function statusBadge(status) {
  if (status === "active")
    return "badge-success";
  if (status === "revoked")
    return "badge-error";
  return "badge-warning";
}
</script>

<template>
  <dialog class="modal" open>
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg">激活码详情</h3>

      <div v-if="!code" class="flex justify-center py-4">
        <span class="loading loading-spinner" />
      </div>

      <div v-else class="mt-4">
        <!-- 基本信息 -->
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>激活码: <span class="font-mono">{{ code.code }}</span></div>
          <div>状态: <span class="badge badge-sm" :class="statusBadge(code.status)">{{ code.status }}</span></div>
          <div>最大设备: {{ code.max_devices }}</div>
          <div>已用: {{ code.used }} / 剩余: {{ code.remaining }}</div>
          <div>创建: {{ formatTime(code.created_at) }}</div>
          <div>过期: {{ code.expires_at ? formatTime(code.expires_at) : "永久" }}</div>
        </div>

        <!-- 设备列表 -->
        <div v-if="devices.length > 0" class="mt-4">
          <h4 class="font-bold text-sm mb-2">已绑定设备</h4>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>指纹</th>
                <th>绑定时间</th>
                <th>最后活跃</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in devices" :key="d.fingerprint">
                <td class="font-mono text-xs">{{ d.fingerprint }}</td>
                <td class="text-xs">{{ formatTime(d.bound_at) }}</td>
                <td class="text-xs">{{ formatTime(d.last_seen_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="mt-4 text-base-content/60 text-sm">
          尚无设备绑定
        </div>
      </div>

      <div class="modal-action">
        <button @click="emit('close')" class="btn btn-sm">关闭</button>
      </div>
    </div>
    <form class="modal-backdrop" method="dialog">
      <button @click="emit('close')" />
    </form>
  </dialog>
</template>
