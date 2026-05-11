<script setup>
import { computed, ref, watch } from 'vue'
import { VueDraggableNext } from 'vue-draggable-next'
import ConfigColEditorModal from '@/components/country/ConfigColEditorModal.vue'
import CountryModal from '@/components/country/CountryModal.vue'
import FieldModal from '@/components/country/FieldModal.vue'
import OptionGroupModal from '@/components/country/OptionGroupModal.vue'
import TemplateModal from '@/components/country/TemplateModal.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()
const CORE_KEYS = ['编号', '国家', '平台', '货币', '货币符号', '汇率', '启用', '排序']

const allKeys = computed(() => {
  const keys = new Set(CORE_KEYS)
  for (const row of store['国家平台']) {
    for (const k of Object.keys(row)) {
      if (k)
        keys.add(k)
    }
  }
  return [...keys]
})
const newColName = ref('')
const showAddCol = ref(false)
const expandedId = ref(null)
const configColOrder = ref([])

const configColumns = computed(() => {
  if (!store['国家平台'].length)
    return []
  if (!configColOrder.value.length || configColOrder.value.length !== allKeys.value.length) {
    configColOrder.value = [...allKeys.value]
  }
  return configColOrder.value
})

function addColumn() {
  const n = newColName.value.trim()
  if (!n || allKeys.value.includes(n))
    return
  for (const r of store['国家平台']) {
    if (!(n in r))
      r[n] = ''
  }
  newColName.value = ''
  showAddCol.value = false
}
function removeColumn(k) {
  if (!CORE_KEYS.includes(k)) {
    for (const r of store['国家平台']) delete r[k]
  }
}
function addRow() {
  const r = {}
  for (const k of allKeys.value) r[k] = ''
  r.启用 = '是'
  store['国家平台'].push(r)
}
function deleteRow(id) {
  const i = store['国家平台'].findIndex(r => r.编号 === id)
  if (i !== -1)
    store['国家平台'].splice(i, 1)
}
function deleteField(idx) {
  const fields = store.getFieldsByCountry(cpId.value)
  const x = store['计算字段'].indexOf(fields[idx])
  if (x !== -1)
    store['计算字段'].splice(x, 1)
  localFields.value.splice(idx, 1)
}
function deleteOpt(idx) {
  const groups = store.getOptionGroupsByCountry(cpId.value)
  const g = groups[idx]
  store['选项组'] = store['选项组'].filter(r => r.编号 !== g.编号)
  store['选项值'] = store['选项值'].filter(r => r.所属分组 !== g.编号)
  localOptGroups.value.splice(idx, 1)
}
function deleteTpl(idx) {
  const templates = store.getTemplatesByCountry(cpId.value)
  const t = templates[idx]
  store['计算模板'] = store['计算模板'].filter(r => r.编号 !== t.编号)
  store['费用规则'] = store['费用规则'].filter(r => r.所属模板 !== t.编号)
  localTemplates.value.splice(idx, 1)
}
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

const cpId = computed(() => expandedId.value)

// ── Modal state ──
const showCountryModal = ref(false)
const editingCountryId = ref('')
const showFieldModal = ref(false)
const editingFieldIdx = ref(-1)
const showOptModal = ref(false)
const editingOptIdx = ref(-1)
const showTplModal = ref(false)
const editingTplIdx = ref(-1)
const showConfigColModal = ref(false)

function openEditCountry(row) {
  editingCountryId.value = row.编号
  showCountryModal.value = true
}
function openNewField() {
  editingFieldIdx.value = -1
  showFieldModal.value = true
}
function openEditField(idx) {
  editingFieldIdx.value = idx
  showFieldModal.value = true
}
function openNewOpt() {
  editingOptIdx.value = -1
  showOptModal.value = true
}
function openEditOpt(idx) {
  editingOptIdx.value = idx
  showOptModal.value = true
}
function openNewTpl() {
  editingTplIdx.value = -1
  showTplModal.value = true
}
function openEditTpl(idx) {
  editingTplIdx.value = idx
  showTplModal.value = true
}
function openConfigColEditor() {
  showConfigColModal.value = true
}

// ── Drag list local refs (computed → local ref pattern) ──
const expFieldsSource = computed(() => (cpId.value ? store.getFieldsByCountry(cpId.value) : []))
const localFields = ref([])
watch(
  expFieldsSource,
  (v) => {
    localFields.value = [...v]
  },
  { immediate: true },
)
function onFieldsDragEnd() {
  const other = store['计算字段'].filter(f => f.所属国家平台 !== cpId.value)
  store['计算字段'] = [...other, ...localFields.value]
}

const expOptGroupsSource = computed(() =>
  cpId.value ? store.getOptionGroupsByCountry(cpId.value) : [],
)
const localOptGroups = ref([])
watch(
  expOptGroupsSource,
  (v) => {
    localOptGroups.value = [...v]
  },
  { immediate: true },
)
function onOptGroupsDragEnd() {
  const other = store['选项组'].filter(g => g.所属国家平台 !== cpId.value)
  store['选项组'] = [...other, ...localOptGroups.value]
}

const expTemplatesSource = computed(() =>
  cpId.value ? store.getTemplatesByCountry(cpId.value) : [],
)
const localTemplates = ref([])
watch(
  expTemplatesSource,
  (v) => {
    localTemplates.value = [...v]
  },
  { immediate: true },
)
function onTemplatesDragEnd() {
  const other = store['计算模板'].filter(t => t.所属国家平台 !== cpId.value)
  store['计算模板'] = [...other, ...localTemplates.value]
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        配置
      </h1>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="openConfigExcel">
          打开配置
        </button>
        <button class="btn btn-outline btn-sm" @click="saveConfigExcel">
          保存配置
        </button>
        <button class="btn btn-ghost btn-sm" @click="openConfigColEditor">
          ⚙️ 编辑列
        </button>
        <button v-if="!showAddCol" class="btn btn-ghost btn-sm" @click="showAddCol = true">
          ＋ 添加列
        </button>
        <div v-else class="flex gap-1 items-center">
          <input
            v-model="newColName"
            class="input input-bordered input-sm w-32"
            placeholder="列名"
            @keyup.enter="addColumn"
          >
          <button class="btn btn-xs btn-primary" @click="addColumn">
            确定
          </button>
          <button class="btn btn-xs btn-ghost" @click="showAddCol = false">
            取消
          </button>
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
                  <th class="w-8" />
                  <th v-for="k in configColumns" :key="k" class="relative group">
                    {{ k }}
                    <button
                      v-if="!CORE_KEYS.includes(k)"
                      class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error absolute -top-1 -right-1"
                      @click="removeColumn(k)"
                    >
                      ✕
                    </button>
                  </th>
                  <th class="w-24">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(row, ri) in store['国家平台']" :key="row.编号 || ri">
                  <tr class="hover" :class="{ 'bg-base-200': expandedId === row.编号 }">
                    <td>
                      <button class="btn btn-ghost btn-xs" @click="toggleExpand(row.编号)">
                        {{ expandedId === row.编号 ? "▼" : "▶" }}
                      </button>
                    </td>
                    <td
                      v-for="k in configColumns"
                      :key="k"
                      class="cursor-pointer"
                      @click="toggleExpand(row.编号)"
                    >
                      {{
                        k === "启用"
                          ? row[k] === "是" || row[k] === "TRUE"
                            ? "是"
                            : "否"
                          : row[k] || "—"
                      }}
                    </td>
                    <td class="flex items-center gap-1">
                      <button class="btn btn-ghost btn-xs" @click="openEditCountry(row)">
                        ✏️
                      </button>
                      <button class="btn btn-ghost btn-xs text-error" @click="deleteRow(row.编号)">
                        ✕
                      </button>
                    </td>
                  </tr>
                  <tr v-if="expandedId === row.编号">
                    <td :colspan="configColumns.length + 2" class="p-4 bg-base-200/50">
                      <div class="grid grid-cols-3 gap-4">
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">字段（{{ localFields.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewField">
                                ＋
                              </button>
                            </div>
                            <div v-if="!localFields.length" class="text-xs text-base-content/40">
                              暂无
                            </div>
                            <VueDraggableNext
                              v-else
                              :list="localFields"
                              :animation="200"
                              handle=".drag-handle"
                              ghost-class="bg-base-300"
                              :item-key="(f) => f.字段键 || f.编号 || String(i)"
                              @end="onFieldsDragEnd"
                            >
                              <div
                                v-for="(f, i) in localFields"
                                :key="f.字段键 || i"
                                class="flex items-center justify-between py-1 border-b border-base-200 text-xs"
                              >
                                <span class="flex items-center gap-2">
                                  <span
                                    class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center px-1.5 py-0.5 select-none"
                                    title="拖拽排序"
                                  >☰</span>
                                  <span
                                    class="cursor-pointer hover:text-primary"
                                    @click="openEditField(i)"
                                  >{{ f.字段键 || "(新)" }}
                                    <span class="text-base-content/40">{{ f.层级 }}·{{ f.输入输出 }}</span></span>
                                </span>
                                <button
                                  class="btn btn-ghost btn-xs text-error"
                                  @click="deleteField(i)"
                                >
                                  ✕
                                </button>
                              </div>
                            </VueDraggableNext>
                          </div>
                        </div>
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">选项组（{{ localOptGroups.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewOpt">
                                ＋
                              </button>
                            </div>
                            <div v-if="!localOptGroups.length" class="text-xs text-base-content/40">
                              暂无
                            </div>
                            <VueDraggableNext
                              v-else
                              :list="localOptGroups"
                              :animation="200"
                              handle=".drag-handle"
                              ghost-class="bg-base-300"
                              item-key="编号"
                              @end="onOptGroupsDragEnd"
                            >
                              <div
                                v-for="(g, i) in localOptGroups"
                                :key="g.编号 || i"
                                class="flex items-center justify-between py-1 border-b border-base-200 text-xs"
                              >
                                <span class="flex items-center gap-2">
                                  <span
                                    class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center px-1.5 py-0.5 select-none"
                                    title="拖拽排序"
                                  >☰</span>
                                  <span
                                    class="cursor-pointer hover:text-primary"
                                    @click="openEditOpt(i)"
                                  >{{ g.名称 || "(新)" }}
                                    <span class="text-base-content/40">{{ g.编号 }}</span></span>
                                </span>
                                <button
                                  class="btn btn-ghost btn-xs text-error"
                                  @click="deleteOpt(i)"
                                >
                                  ✕
                                </button>
                              </div>
                            </VueDraggableNext>
                          </div>
                        </div>
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">模板（{{ localTemplates.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewTpl">
                                ＋
                              </button>
                            </div>
                            <div v-if="!localTemplates.length" class="text-xs text-base-content/40">
                              暂无
                            </div>
                            <VueDraggableNext
                              v-else
                              :list="localTemplates"
                              :animation="200"
                              handle=".drag-handle"
                              ghost-class="bg-base-300"
                              item-key="编号"
                              @end="onTemplatesDragEnd"
                            >
                              <div
                                v-for="(t, i) in localTemplates"
                                :key="t.编号 || i"
                                class="flex items-center justify-between py-1 border-b border-base-200 text-xs"
                              >
                                <span class="flex items-center gap-2">
                                  <span
                                    class="drag-handle cursor-grab text-base-content/30 hover:text-base-content flex items-center px-1.5 py-0.5 select-none"
                                    title="拖拽排序"
                                  >☰</span>
                                  <span
                                    class="cursor-pointer hover:text-primary"
                                    @click="openEditTpl(i)"
                                  >{{ t.名称 || "(新)" }}
                                    <span class="badge badge-xs">{{
                                      t.启用 === "是" ? "启用" : "—"
                                    }}</span></span>
                                </span>
                                <button
                                  class="btn btn-ghost btn-xs text-error"
                                  @click="deleteTpl(i)"
                                >
                                  ✕
                                </button>
                              </div>
                            </VueDraggableNext>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <button class="btn btn-ghost btn-sm mt-2" @click="addRow">
            ＋ 添加国家
          </button>
        </div>
      </div>
    </div>

    <CountryModal
      :open="showCountryModal"
      :country-id="editingCountryId"
      :all-keys="allKeys"
      @close="showCountryModal = false"
    />
    <FieldModal
      :open="showFieldModal"
      :field-idx="editingFieldIdx"
      :cp-id="cpId"
      @close="showFieldModal = false"
    />
    <OptionGroupModal
      :open="showOptModal"
      :group-idx="editingOptIdx"
      :cp-id="cpId"
      @close="showOptModal = false"
    />
    <TemplateModal
      :open="showTplModal"
      :template-idx="editingTplIdx"
      :cp-id="cpId"
      @close="showTplModal = false"
    />
    <ConfigColEditorModal :open="showConfigColModal" @close="showConfigColModal = false" />
  </div>
</template>
