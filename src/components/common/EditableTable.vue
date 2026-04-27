<script setup>
import { ref } from 'vue'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  idKey: { type: String, default: 'id' },
  editable: { type: Boolean, default: true },
})

const emit = defineEmits(['add', 'update', 'delete'])

const editingRowId = ref(null)
const editData = ref({})

function getValue(row, col) {
  if (col.prop)
    return row[col.prop]
  return row[col.key]
}

function startEdit(row) {
  editingRowId.value = row[props.idKey]
  editData.value = { ...row }
}

function cancelEdit() {
  editingRowId.value = null
  editData.value = {}
}

function saveEdit() {
  emit('update', { ...editData.value })
  editingRowId.value = null
  editData.value = {}
}

function isEditing(row) {
  return editingRowId.value === row[props.idKey]
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">
            {{ col.label }}
          </th>
          <th v-if="editable" class="w-32">
            操作
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row[idKey]">
          <template v-if="isEditing(row)">
            <td v-for="col in columns" :key="col.key">
              <template v-if="col.type === 'select' && col.options">
                <select v-model="editData[col.prop || col.key]" class="select select-bordered select-sm w-full">
                  <option v-for="opt in col.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </template>
              <template v-else-if="col.type === 'boolean'">
                <input v-model="editData[col.prop || col.key]" type="checkbox" class="toggle toggle-sm">
              </template>
              <template v-else-if="col.type === 'number'">
                <input v-model.number="editData[col.prop || col.key]" type="number" class="input input-bordered input-sm w-full">
              </template>
              <template v-else-if="col.type === 'textarea'">
                <textarea v-model="editData[col.prop || col.key]" class="textarea textarea-bordered textarea-sm w-full" rows="2" />
              </template>
              <template v-else>
                <input v-model="editData[col.prop || col.key]" type="text" class="input input-bordered input-sm w-full">
              </template>
            </td>
            <td v-if="editable">
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs text-success" @click="saveEdit">
                  保存
                </button>
                <button class="btn btn-ghost btn-xs" @click="cancelEdit">
                  取消
                </button>
              </div>
            </td>
          </template>
          <template v-else>
            <td v-for="col in columns" :key="col.key">
              <template v-if="col.type === 'boolean'">
                <span :class="getValue(row, col) ? 'badge badge-success' : 'badge badge-ghost'">
                  {{ getValue(row, col) ? '是' : '否' }}
                </span>
              </template>
              <template v-else>
                {{ getValue(row, col) }}
              </template>
            </td>
            <td v-if="editable">
              <div class="flex gap-1">
                <button class="btn btn-ghost btn-xs" @click="startEdit(row)">
                  编辑
                </button>
                <button class="btn btn-ghost btn-xs text-error" @click="emit('delete', row)">
                  删除
                </button>
              </div>
            </td>
          </template>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length + (editable ? 1 : 0)" class="text-center text-base-content/50 py-6">
             暂无数据
          </td>
        </tr>
      </tbody>
    </table>
    <button v-if="editable" class="btn btn-ghost btn-sm mt-2" @click="emit('add')">
      + 新增一行
    </button>
  </div>
</template>
