<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import EditableTable from '@/components/common/EditableTable.vue'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const router = useRouter()

const CORE_KEYS = ['编号', '国家', '平台', '货币']
const allKeys = computed(() => {
  const keys = new Set(CORE_KEYS)
  for (const row of store['国家平台']) {
    for (const k of Object.keys(row)) if (k) keys.add(k)
  }
  return [...keys]
})

const newColName = ref('')
const showAddCol = ref(false)
const expandedId = ref(null)
const editingCell = ref(null)

function addColumn() {
  const name = newColName.value.trim()
  if (!name || allKeys.value.includes(name)) return
  for (const row of store['国家平台']) if (!(name in row)) row[name] = ''
  newColName.value = ''
  showAddCol.value = false
}
function removeColumn(key) {
  if (CORE_KEYS.includes(key)) return
  for (const row of store['国家平台']) delete row[key]
}
function addRow() {
  const row = {}; for (const k of allKeys.value) row[k] = ''; row.启用 = '是'
  store['国家平台'].push(row)
}
function updateCell(id, key, value) {
  const row = store['国家平台'].find(r => r.编号 === id)
  if (row) row[key] = value
}
function deleteRow(id) {
  const idx = store['国家平台'].findIndex(r => r.编号 === id)
  if (idx !== -1) store['国家平台'].splice(idx, 1)
}
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

// ── 展开后的子数据 ──
const expandedFields = computed(() => expandedId.value ? store.getFieldsByCountry(expandedId.value) : [])
const expandedOptGroups = computed(() => expandedId.value ? store.getOptionGroupsByCountry(expandedId.value) : [])
const expandedTemplates = computed(() => expandedId.value ? store.getTemplatesByCountry(expandedId.value) : [])

const fieldCols = [
  { key: '字段键', label: '字段键', type: 'text' },
  { key: '字段名称', label: '名称', type: 'text' },
  { key: '类型', label: '类型', type: 'text' },
  { key: '层级', label: '层级', type: 'text' },
  { key: '输入输出', label: '输入/输出', type: 'text' },
  { key: '单位', label: '单位', type: 'text' },
  { key: '必填', label: '必填', type: 'boolean' },
  { key: '说明', label: '说明', type: 'text' },
]
const optCols = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '名称', label: '名称', type: 'text' },
  { key: '说明', label: '说明', type: 'text' },
]
const tplCols = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '名称', label: '名称', type: 'text' },
  { key: '启用', label: '启用', type: 'boolean' },
  { key: '说明', label: '说明', type: 'text' },
]

function onAddField() {
  store['计算字段'].push({ 字段键:'', 字段名称:'', 类型:'数字', 单位:'', 选项组编号:'', 所属国家平台:expandedId.value, 层级:'商品级', 输入输出:'输入', 必填:'否', 说明:'' })
}
function onUpField({ index, row }) {
  const idx = store['计算字段'].indexOf(expandedFields.value[index]); if (idx !== -1) store['计算字段'][idx] = row
}
function onDelField({ index }) {
  const idx = store['计算字段'].indexOf(expandedFields.value[index]); if (idx !== -1) store['计算字段'].splice(idx, 1)
}

function onAddOpt() {
  store['选项组'].push({ 编号:'', 名称:'', 所属国家平台:expandedId.value, 说明:'' })
}
function onUpOpt({ index, row }) {
  const idx = store['选项组'].indexOf(expandedOptGroups.value[index]); if (idx !== -1) store['选项组'][idx] = row
}
function onDelOpt({ index }) {
  const idx = store['选项组'].indexOf(expandedOptGroups.value[index]); if (idx !== -1) store['选项组'].splice(idx, 1)
}

function onAddTpl() {
  store['计算模板'].push({ 编号:'', 名称:'', 所属国家平台:expandedId.value, 启用:'是', 说明:'' })
}
function onUpTpl({ index, row }) {
  const idx = store['计算模板'].indexOf(expandedTemplates.value[index]); if (idx !== -1) store['计算模板'][idx] = row
}
function onDelTpl({ index }) {
  const idx = store['计算模板'].indexOf(expandedTemplates.value[index]); if (idx !== -1) store['计算模板'].splice(idx, 1)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">国家平台</h1>
      <div class="flex gap-2">
        <button v-if="!showAddCol" class="btn btn-ghost btn-sm" @click="showAddCol = true">＋ 添加列</button>
        <div v-else class="flex gap-1 items-center">
          <input v-model="newColName" class="input input-bordered input-sm w-32" placeholder="列名" @keyup.enter="addColumn" />
          <button class="btn btn-xs btn-primary" @click="addColumn">确定</button>
          <button class="btn btn-xs btn-ghost" @click="showAddCol = false">取消</button>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto space-y-4">
      <div class="card card-sm bg-base-100 border border-base-300">
        <div class="card-body p-3">
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th class="w-8"></th>
                  <th v-for="k in allKeys" :key="k" class="relative group">
                    {{ k }}
                    <button v-if="!CORE_KEYS.includes(k)" class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error absolute -top-1 -right-1" @click="removeColumn(k)">✕</button>
                  </th>
                  <th class="w-12"></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="row in store['国家平台']" :key="row.编号 || Math.random()">
                  <tr class="hover" :class="{ 'bg-base-200': expandedId === row.编号 }">
                    <td>
                      <button class="btn btn-ghost btn-xs" @click="toggleExpand(row.编号)">{{ expandedId === row.编号 ? '▼' : '▶' }}</button>
                    </td>
                    <td v-for="k in allKeys" :key="k" @click="editingCell = { id: row.编号, key: k }">
                      <span v-if="editingCell?.id !== row.编号 || editingCell?.key !== k" class="cursor-text min-w-[2rem] inline-block">
                        {{ k === '启用' ? (row[k] === '是' || row[k] === 'TRUE' ? '是' : '否') : (row[k] || '—') }}
                      </span>
                      <input v-else :value="row[k]" class="input input-bordered input-xs w-full" @blur="editingCell = null; updateCell(row.编号, k, $event.target.value)" @keyup.enter="editingCell = null; updateCell(row.编号, k, $event.target.value)" />
                    </td>
                    <td><button class="btn btn-ghost btn-xs text-error" @click="deleteRow(row.编号)">🗑️</button></td>
                  </tr>
                  <tr v-if="expandedId === row.编号">
                    <td :colspan="allKeys.length + 2" class="p-0">
                      <div class="p-4 space-y-4 bg-base-200/50">
                        <details open class="bg-base-100 rounded p-3">
                          <summary class="font-semibold cursor-pointer">计算字段（{{ expandedFields.length }} 个）</summary>
                          <div class="mt-2">
                            <EditableTable :columns="fieldCols" :rows="expandedFields" id-key="字段键" @add="onAddField" @update="onUpField" @delete="onDelField" />
                          </div>
                        </details>
                        <details class="bg-base-100 rounded p-3">
                          <summary class="font-semibold cursor-pointer">选项组（{{ expandedOptGroups.length }} 个）<button class="btn btn-ghost btn-xs ml-2" @click.stop="router.push('/option')">🔗 选项值</button></summary>
                          <div class="mt-2">
                            <EditableTable :columns="optCols" :rows="expandedOptGroups" id-key="编号" @add="onAddOpt" @update="onUpOpt" @delete="onDelOpt" />
                          </div>
                        </details>
                        <details class="bg-base-100 rounded p-3">
                          <summary class="font-semibold cursor-pointer">计算模板（{{ expandedTemplates.length }} 个）<button class="btn btn-ghost btn-xs ml-2" @click.stop="router.push('/template')">🔗 费用规则</button></summary>
                          <div class="mt-2">
                            <EditableTable :columns="tplCols" :rows="expandedTemplates" id-key="编号" @add="onAddTpl" @update="onUpTpl" @delete="onDelTpl" />
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <button class="btn btn-ghost btn-sm mt-2" @click="addRow">＋ 添加国家</button>
        </div>
      </div>
    </div>
  </div>
</template>
