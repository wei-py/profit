<script setup>
import { ref } from 'vue'

/**
 * @property {Array<object>} columns - 列定义 [{ key, prop, label, type?, options?, getType?, getOptions? }]
 * @property {Array<object>} rows - 行数据
 * @property {string} [idKey='id'] - 主键字段名
 * @property {boolean} [editable=true] - 是否可编辑
 */
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  idKey: { type: String, default: 'id' },
  editable: { type: Boolean, default: true },
})

/**
 * @event add - 新增一行
 * @event update - 更新行数据
 * @event delete - 删除行数据
 */
const emit = defineEmits(['add', 'update', 'delete'])

/** @type {import('vue').Ref<string|null>} 正在编辑的行 ID */
const editingRowId = ref(null)
/** @type {import('vue').Ref<object>} 编辑中的行数据副本 */
const editData = ref({})

/**
 * 获取单元格显示值。
 * @param {object} row - 行数据
 * @param {object} col - 列定义
 * @returns {*} 单元格值
 */
function getValue(row, col) {
  if (col.prop)
    return row[col.prop]
  return row[col.key]
}

/**
 * 获取单元格编辑时的输入类型。
 * @param {object} row - 行数据
 * @param {object} col - 列定义
 * @returns {string} 输入类型
 */
function getEffectiveType(row, col) {
  if (col.getType)
    return col.getType(row)
  return col.type || 'text'
}

/**
 * 获取单元格可选下拉选项。
 * @param {object} row - 行数据
 * @param {object} col - 列定义
 * @returns {Array<{ value: string, label: string }>} 选项列表
 */
function getEffectiveOptions(row, col) {
  if (col.getOptions)
    return col.getOptions(row) || []
  return col.options || []
}

/** 进入编辑模式。 */
function startEdit(row) {
  editingRowId.value = row[props.idKey]
  editData.value = { ...row }
}

/** 取消编辑模式。 */
function cancelEdit() {
  editingRowId.value = null
  editData.value = {}
}

/** 保存编辑内容并退出编辑模式。 */
function saveEdit() {
  emit('update', { ...editData.value })
  editingRowId.value = null
  editData.value = {}
}

/**
 * 判断指定行是否处于编辑状态。
 * @param {object} row - 行数据
 * @returns {boolean} 是否正在编辑
 */
function isEditing(row) {
  return editingRowId.value === row[props.idKey]
}
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex-1 overflow-y-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" class="sticky top-0 bg-base-100 z-10">
              {{ col.label }}
            </th>
            <th v-if="editable" class="w-32 sticky top-0 bg-base-100 z-10">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row[idKey]">
            <template v-if="isEditing(row)">
              <td v-for="col in columns" :key="col.key">
                <template v-if="getEffectiveType(editData, col) === 'select'">
                  <select v-model="editData[col.prop || col.key]" class="select select-bordered select-sm w-full">
                    <option value="" />
                    <option v-for="opt in getEffectiveOptions(editData, col)" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </template>
                <template v-else-if="getEffectiveType(editData, col) === 'boolean'">
                  <input v-model="editData[col.prop || col.key]" type="checkbox" class="toggle toggle-sm">
                </template>
                <template v-else-if="getEffectiveType(editData, col) === 'number'">
                  <input v-model.number="editData[col.prop || col.key]" type="number" class="input input-bordered input-sm w-full">
                </template>
                <template v-else-if="getEffectiveType(editData, col) === 'textarea'">
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
                <template v-else-if="getEffectiveType(row, col) === 'select'">
                  {{ getEffectiveOptions(row, col).find(o => o.value === getValue(row, col))?.label || getValue(row, col) }}
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
    </div>
    <button v-if="editable" class="btn btn-ghost btn-sm mt-2 flex-shrink-0" @click="emit('add')">
      + 新增一行
    </button>
  </div>
</template>
