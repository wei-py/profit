<script setup>
import { computed } from "vue";
import { vDraggable } from "vue-draggable-plus";
import OptionTreeSelect from "@/components/common/OptionTreeSelect.vue";

const props = defineProps({
  dragOpts: { required: true, type: Object },
  expandedIds: { required: true, type: Object },
  groupNode: { required: true, type: Object },
  inlineGroup: { default: false, type: Boolean },
  level: { default: 0, type: Number },
  yesNoOptions: { default: () => ["是", "否"], type: Array },
});

const emit = defineEmits([
  "add-child-item",
  "add-item",
  "delete-group",
  "delete-item",
  "toggle",
  "update-item-label",
]);

const groupExpanded = computed(() => props.expandedIds.has(props.groupNode.key));
const groupHasItems = computed(() => props.groupNode.items.length > 0);

function toggle(key) {
  emit("toggle", key);
}

function itemExpanded(itemNode) {
  return props.expandedIds.has(itemNode.key);
}

function itemHasChild(itemNode) {
  return !!itemNode.childGroup && itemNode.childGroup.items.length > 0;
}
</script>

<template>
  <li v-if="!inlineGroup" class="option-root-node select-none">
    <div
      class="group flex min-h-[33px] items-center gap-2 border-b border-base-300 bg-base-100 px-2 py-1 text-sm font-semibold hover:bg-base-200"
      :style="{ paddingLeft: `${level * 18 + 8}px` }"
    >
      <span
        class="option-root-drag-handle cursor-grab px-1 text-base-content/30"
        title="拖动排序"
      >☰</span>
      <button
        class="btn btn-ghost btn-xs h-6 min-h-6 w-6 px-0"
        :disabled="!groupHasItems"
        type="button"
        @click.stop="toggle(groupNode.key)"
      >
        {{ groupHasItems ? (groupExpanded ? "▾" : "▸") : "" }}
      </button>
      <input
        v-model="groupNode.group.名称"
        class="input input-bordered input-xs min-w-0 flex-1 font-semibold"
        placeholder="选项来源名称"
      >
      <button
        class="btn btn-ghost btn-xs shrink-0"
        type="button"
        @click="emit('add-item', groupNode)"
      >
        +选项
      </button>
      <button
        class="btn btn-ghost btn-xs shrink-0 text-error"
        type="button"
        @click="emit('delete-group', groupNode)"
      >
        删除
      </button>
    </div>

    <ul v-if="groupExpanded && groupHasItems" v-draggable="[groupNode.items, dragOpts]">
      <li v-for="itemNode in groupNode.items" :key="itemNode.key" class="option-item-node select-none">
        <div
          class="group flex min-h-[33px] items-center gap-2 border-b border-base-300 px-2 py-1 text-sm hover:bg-base-200"
          :style="{ paddingLeft: `${(level + 1) * 18 + 8}px` }"
        >
          <span
            class="option-item-drag-handle cursor-grab px-1 text-base-content/30"
            title="拖动排序"
          >☰</span>
          <button
            class="btn btn-ghost btn-xs h-6 min-h-6 w-6 px-0"
            :disabled="!itemHasChild(itemNode)"
            type="button"
            @click.stop="toggle(itemNode.key)"
          >
            {{ itemHasChild(itemNode) ? (itemExpanded(itemNode) ? "▾" : "▸") : "" }}
          </button>
          <input
            :value="itemNode.item.显示名 || itemNode.item.选项值"
            class="input input-bordered input-xs min-w-0 flex-1"
            placeholder="选项值"
            @input="emit('update-item-label', groupNode, itemNode, $event.target.value)"
          >
          <OptionTreeSelect
            v-model="itemNode.item.启用"
            :options="yesNoOptions"
            size="xs"
            :fullWidth="false"
            :wrapDisplay="false"
          />
          <button
            class="btn btn-ghost btn-xs shrink-0"
            title="新增子选项"
            type="button"
            @click="emit('add-child-item', groupNode, itemNode)"
          >
            +子级
          </button>
          <button
            class="btn btn-ghost btn-xs shrink-0 text-error"
            type="button"
            @click="emit('delete-item', groupNode, itemNode)"
          >
            删除
          </button>
        </div>

        <OptionTreeEditorNode
          v-if="itemNode.childGroup && itemExpanded(itemNode)"
          :dragOpts="dragOpts"
          :expandedIds="expandedIds"
          :groupNode="itemNode.childGroup"
          inline-group
          :level="level + 1"
          :yesNoOptions="yesNoOptions"
          @add-child-item="(...args) => emit('add-child-item', ...args)"
          @add-item="(...args) => emit('add-item', ...args)"
          @delete-group="(...args) => emit('delete-group', ...args)"
          @delete-item="(...args) => emit('delete-item', ...args)"
          @toggle="(...args) => emit('toggle', ...args)"
          @update-item-label="(...args) => emit('update-item-label', ...args)"
        />
      </li>
    </ul>
  </li>

  <ul v-else-if="groupHasItems" v-draggable="[groupNode.items, dragOpts]">
    <li v-for="itemNode in groupNode.items" :key="itemNode.key" class="option-item-node select-none">
      <div
        class="group flex min-h-[33px] items-center gap-2 border-b border-base-300 px-2 py-1 text-sm hover:bg-base-200"
        :style="{ paddingLeft: `${(level + 1) * 18 + 8}px` }"
      >
        <span
          class="option-item-drag-handle cursor-grab px-1 text-base-content/30"
          title="拖动排序"
        >☰</span>
        <button
          class="btn btn-ghost btn-xs h-6 min-h-6 w-6 px-0"
          :disabled="!itemHasChild(itemNode)"
          type="button"
          @click.stop="toggle(itemNode.key)"
        >
          {{ itemHasChild(itemNode) ? (itemExpanded(itemNode) ? "▾" : "▸") : "" }}
        </button>
        <input
          :value="itemNode.item.显示名 || itemNode.item.选项值"
          class="input input-bordered input-xs min-w-0 flex-1"
          placeholder="选项值"
          @input="emit('update-item-label', groupNode, itemNode, $event.target.value)"
        >
        <OptionTreeSelect
          v-model="itemNode.item.启用"
          :options="yesNoOptions"
          size="xs"
          :fullWidth="false"
          :wrapDisplay="false"
        />
        <button
          class="btn btn-ghost btn-xs shrink-0"
          title="新增子选项"
          type="button"
          @click="emit('add-child-item', groupNode, itemNode)"
        >
          +子级
        </button>
        <button
          class="btn btn-ghost btn-xs shrink-0 text-error"
          type="button"
          @click="emit('delete-item', groupNode, itemNode)"
        >
          删除
        </button>
      </div>

      <OptionTreeEditorNode
        v-if="itemNode.childGroup && itemExpanded(itemNode)"
        :dragOpts="dragOpts"
        :expandedIds="expandedIds"
        :groupNode="itemNode.childGroup"
        inline-group
        :level="level + 1"
        :yesNoOptions="yesNoOptions"
        @add-child-item="(...args) => emit('add-child-item', ...args)"
        @add-item="(...args) => emit('add-item', ...args)"
        @delete-group="(...args) => emit('delete-group', ...args)"
        @delete-item="(...args) => emit('delete-item', ...args)"
        @toggle="(...args) => emit('toggle', ...args)"
        @update-item-label="(...args) => emit('update-item-label', ...args)"
      />
    </li>
  </ul>
</template>
