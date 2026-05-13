<script setup lang="ts">
import { ref } from "vue";
import { vDraggable } from "vue-draggable-plus";

const list = ref([
  { id: 1, name: "任务 A" },
  { id: 2, name: "任务 B" },
  { id: 3, name: "任务 C" },
]);

function onStart() {
  console.log("start");
}

function onUpdate() {
  console.log("update", list.value);
}

function onEnd() {
  console.log("end", list.value);
}
</script>

<template>
  <div class="page">
    <div
      v-draggable="[
        list,
        {
          animation: 150,
          handle: '.drag-handle',
          ghostClass: 'ghost',
          forceFallback: true,
          onStart,
          onUpdate,
          onEnd,
        },
      ]"
      class="list"
    >
      <div v-for="item in list" :key="item.id" class="item">
        <span class="drag-handle">☰</span>
        <span>{{ item.name }}</span>
      </div>
    </div>

    <pre>{{ list }}</pre>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
}

.list {
  width: 320px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  user-select: none;
}

.drag-handle {
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.ghost {
  opacity: 0.5;
}
</style>
