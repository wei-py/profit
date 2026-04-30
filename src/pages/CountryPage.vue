<script setup>
import { computed, reactive, ref } from 'vue'
import EditableTable from '@/components/common/EditableTable.vue'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const CORE_KEYS = ['编号', '国家', '平台', '货币']

// ── 国家表格：动态列 ──
const allKeys = computed(() => {
  const keys = new Set(CORE_KEYS)
  for (const row of store['国家平台']) for (const k of Object.keys(row)) if (k) keys.add(k)
  return [...keys]
})
const newColName = ref('')
const showAddCol = ref(false)
const expandedId = ref(null)
const editingCell = ref(null)

function addColumn() {
  const n = newColName.value.trim()
  if (!n || allKeys.value.includes(n)) return
  for (const r of store['国家平台']) if (!(n in r)) r[n] = ''
  newColName.value = ''; showAddCol.value = false
}
function removeColumn(k) { if (!CORE_KEYS.includes(k)) for (const r of store['国家平台']) delete r[k] }
function addRow() { const r = {}; for (const k of allKeys.value) r[k] = ''; r.启用 = '是'; store['国家平台'].push(r) }
function updateCell(id, k, v) { const r = store['国家平台'].find(r => r.编号 === id); if (r) r[k] = v }
function deleteRow(id) { const i = store['国家平台'].findIndex(r => r.编号 === id); if (i !== -1) store['国家平台'].splice(i, 1) }
function toggleExpand(id) { expandedId.value = expandedId.value === id ? null : id }

// ── 展开后数据 ──
const cpId = computed(() => expandedId.value)
const expFields = computed(() => cpId.value ? store.getFieldsByCountry(cpId.value) : [])
const expOptGroups = computed(() => cpId.value ? store.getOptionGroupsByCountry(cpId.value) : [])
const expTemplates = computed(() => cpId.value ? store.getTemplatesByCountry(cpId.value) : [])
const countryFields = computed(() => store.getFieldsByCountry(cpId.value))

// ── 计算字段 ──
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
function addF() { store['计算字段'].push({ 字段键:'',字段名称:'',类型:'数字',单位:'',选项组编号:'',所属国家平台:cpId.value,层级:'商品级',输入输出:'输入',必填:'否',说明:'' }) }
function upF({ i, row }) { const x = store['计算字段'].indexOf(expFields.value[i]); if (x !== -1) store['计算字段'][x] = row }
function delF({ i }) { const x = store['计算字段'].indexOf(expFields.value[i]); if (x !== -1) store['计算字段'].splice(x, 1) }

// ── 选项组 + 选项值 ──
const expandedGroupId = ref(null)
const optGroupCols = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '名称', label: '名称', type: 'text' },
  { key: '说明', label: '说明', type: 'text' },
]
const optItemCols = [
  { key: '选项值', label: '选项值', type: 'text' },
  { key: '显示名', label: '显示名', type: 'text' },
  { key: '排序', label: '排序', type: 'number' },
  { key: '启用', label: '启用', type: 'boolean' },
  { key: '备注', label: '备注', type: 'text' },
]
function addG() { store['选项组'].push({ 编号:'',名称:'',所属国家平台:cpId.value,说明:'' }) }
function upG({ i, row }) { const x = store['选项组'].indexOf(expOptGroups.value[i]); if (x !== -1) store['选项组'][x] = row }
function delG({ i }) { const x = store['选项组'].indexOf(expOptGroups.value[i]); if (x !== -1) store['选项组'].splice(x, 1) }
function getItems(gid) { return store.getOptionItemsByGroup(gid) }
function addI(gid) { store['选项值'].push({ 所属分组:gid, 选项值:'', 显示名:'', 排序:'', 启用:'是', 备注:'' }) }
function upI(gid, i, row) {
  const items = getItems(gid); const x = store['选项值'].indexOf(items[i])
  if (x !== -1) store['选项值'][x] = row
}
function delI(gid, i) {
  const items = getItems(gid); const x = store['选项值'].indexOf(items[i])
  if (x !== -1) store['选项值'].splice(x, 1)
}

// ── 模板 + 费用规则 ──
const expandedTplId = ref(null)
const templateCols = [
  { key: '编号', label: '编号', type: 'text' },
  { key: '名称', label: '名称', type: 'text' },
  { key: '启用', label: '启用', type: 'boolean' },
  { key: '说明', label: '说明', type: 'text' },
]
function addT() { store['计算模板'].push({ 编号:'',名称:'',所属国家平台:cpId.value,启用:'是',说明:'' }) }
function upT({ i, row }) { const x = store['计算模板'].indexOf(expTemplates.value[i]); if (x !== -1) store['计算模板'][x] = row }
function delT({ i }) { const x = store['计算模板'].indexOf(expTemplates.value[i]); if (x !== -1) store['计算模板'].splice(x, 1) }
function getRules(tid) { return store.getFeeRulesByTemplate(tid) }
function getParams(tid) { return store.getTemplateParams(tid) }

// ── 规则弹窗 ──
const showRuleModal = ref(false)
const editingRuleIdx = ref(-1)
const editingRuleTplId = ref('')
const ruleForm = reactive({})
const fieldKeys = computed(() => countryFields.value.map(f => f.字段键))
const outputKeys = computed(() => countryFields.value.filter(f => f.输入输出 === '输出').map(f => f.字段键))

function condSummary(r) {
  const p = []
  if (r.条件1字段) p.push(`${r.条件1字段} ${r.条件1运算符||''} ${r.条件1值}`)
  if (r.条件2字段) p.push(`AND ${r.条件2字段} ${r.条件2运算符||''} ${r.条件2值}`)
  return p.join(' ') || '—'
}

function openNewRule(tplId) {
  editingRuleTplId.value = tplId; editingRuleIdx.value = -1
  Object.assign(ruleForm, { 编号:'',所属模板:tplId,输出字段键:'',费用名称:'',计算顺序:'',启用:'是',条件1字段:'',条件1运算符:'',条件1值:'',条件1值2:'',条件2字段:'',条件2运算符:'',条件2值:'',条件2值2:'',计算方式:'',查表名称:'',匹配方式:'',输入映射:'',输出列:'',百分比基数:'',百分比值:'',百分比来源字段:'',固定金额:'',加总字段:'',公式:'',累加:'否',说明:'' })
  showRuleModal.value = true
}
function openEditRule(tplId, idx, rule) {
  editingRuleTplId.value = tplId; editingRuleIdx.value = idx
  Object.assign(ruleForm, JSON.parse(JSON.stringify(rule)))
  showRuleModal.value = true
}
function saveRule() {
  const rules = getRules(editingRuleTplId.value)
  if (editingRuleIdx.value >= 0) {
    const realIdx = store['费用规则'].indexOf(rules[editingRuleIdx.value])
    if (realIdx !== -1) store['费用规则'][realIdx] = { ...ruleForm }
  } else {
    store['费用规则'].push({ ...ruleForm })
  }
  showRuleModal.value = false
}
function deleteRuleFromModal() {
  const rules = getRules(editingRuleTplId.value)
  if (editingRuleIdx.value >= 0) {
    const realIdx = store['费用规则'].indexOf(rules[editingRuleIdx.value])
    if (realIdx !== -1) store['费用规则'].splice(realIdx, 1)
  }
  showRuleModal.value = false
}
function deleteRuleInline(tplId, i) {
  const rules = getRules(tplId)
  const x = store['费用规则'].indexOf(rules[i])
  if (x !== -1) store['费用规则'].splice(x, 1)
}

// ── 模板参数 ──
const paramCols = [
  { key: '字段键', label: '字段键', type: 'text' },
  { key: '默认值', label: '默认值', type: 'text' },
  { key: '必填', label: '必填', type: 'boolean' },
]
function addP(tid) { store['模板参数'].push({ 模板编号:tid,字段键:'',默认值:'',必填:'否' }) }
function upP(tid, i, row) {
  const p = getParams(tid); const x = store['模板参数'].indexOf(p[i])
  if (x !== -1) store['模板参数'][x] = row
}
function delP(tid, i) {
  const p = getParams(tid); const x = store['模板参数'].indexOf(p[i])
  if (x !== -1) store['模板参数'].splice(x, 1)
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
                <template v-for="(row, ri) in store['国家平台']" :key="row.编号 || ri">
                  <tr class="hover" :class="{ 'bg-base-200': expandedId === row.编号 }">
                    <td><button class="btn btn-ghost btn-xs" @click="toggleExpand(row.编号)">{{ expandedId === row.编号 ? '▼' : '▶' }}</button></td>
                    <td v-for="k in allKeys" :key="k" @click="editingCell = { id: row.编号, key: k }">
                      <span v-if="editingCell?.id !== row.编号 || editingCell?.key !== k" class="cursor-text min-w-[2rem] inline-block">
                        {{ k === '启用' ? (row[k] === '是' || row[k] === 'TRUE' ? '是' : '否') : (row[k] || '—') }}
                      </span>
                      <input v-else :value="row[k]" class="input input-bordered input-xs w-full"
                        @blur="editingCell = null; updateCell(row.编号, k, $event.target.value)"
                        @keyup.enter="editingCell = null; updateCell(row.编号, k, $event.target.value)" />
                    </td>
                    <td><button class="btn btn-ghost btn-xs text-error" @click="deleteRow(row.编号)">🗑️</button></td>
                  </tr>
                  <!-- 展开子管理 -->
                  <tr v-if="expandedId === row.编号">
                    <td :colspan="allKeys.length + 2" class="p-0">
                      <div class="p-4 space-y-4 bg-base-200/50">

                        <!-- 1. 计算字段 -->
                        <details open class="bg-base-100 rounded p-3">
                          <summary class="font-semibold cursor-pointer">计算字段（{{ expFields.length }}）</summary>
                          <div class="mt-2"><EditableTable :columns="fieldCols" :rows="expFields" id-key="字段键" @add="addF" @update="(e) => upF({ i: e.index, row: e.row })" @delete="(e) => delF({ i: e.index })" /></div>
                        </details>

                        <!-- 2. 选项组 + 选项值 -->
                        <details class="bg-base-100 rounded p-3">
                          <summary class="font-semibold cursor-pointer">选项组（{{ expOptGroups.length }}）</summary>
                          <div class="mt-2 space-y-2">
                            <EditableTable :columns="optGroupCols" :rows="expOptGroups" id-key="编号" @add="addG" @update="(e) => upG({ i: e.index, row: e.row })" @delete="(e) => delG({ i: e.index })" />
                            <div v-for="g in expOptGroups" :key="g.编号" class="ml-4 p-2 bg-base-200 rounded">
                              <div class="flex items-center gap-2 mb-1">
                                <button class="btn btn-ghost btn-xs" @click="expandedGroupId = expandedGroupId === g.编号 ? null : g.编号">
                                  {{ expandedGroupId === g.编号 ? '▼' : '▶' }}
                                </button>
                                <span class="text-sm font-semibold">{{ g.名称 }}（{{ g.编号 }}）</span>
                                <span class="text-xs text-base-content/50">{{ g.说明 }}</span>
                              </div>
                              <div v-if="expandedGroupId === g.编号">
                                <EditableTable :columns="optItemCols" :rows="getItems(g.编号)" id-key="选项值"
                                  @add="addI(g.编号)" @update="(e) => upI(g.编号, e.index, e.row)" @delete="(e) => delI(g.编号, e.index)" />
                              </div>
                            </div>
                          </div>
                        </details>

                        <!-- 3. 模板 + 费用规则 -->
                        <details class="bg-base-100 rounded p-3">
                          <summary class="font-semibold cursor-pointer">计算模板（{{ expTemplates.length }}）</summary>
                          <div class="mt-2 space-y-3">
                            <EditableTable :columns="templateCols" :rows="expTemplates" id-key="编号" @add="addT" @update="(e) => upT({ i: e.index, row: e.row })" @delete="(e) => delT({ i: e.index })" />
                            <div v-for="t in expTemplates" :key="t.编号" class="ml-4 p-2 bg-base-200 rounded">
                              <div class="flex items-center gap-2 mb-1">
                                <button class="btn btn-ghost btn-xs" @click="expandedTplId = expandedTplId === t.编号 ? null : t.编号">
                                  {{ expandedTplId === t.编号 ? '▼' : '▶' }}
                                </button>
                                <span class="text-sm font-semibold">{{ t.名称 }}（{{ t.编号 }}）</span>
                                <span class="badge badge-xs">{{ t.启用 === '是' ? '启用' : '禁用' }}</span>
                              </div>
                              <div v-if="expandedTplId === t.编号" class="space-y-2">
                                <!-- 费用规则 -->
                                <div>
                                  <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-semibold">费用规则（{{ getRules(t.编号).length }} 条）</span>
                                    <button class="btn btn-xs btn-primary" @click="openNewRule(t.编号)">＋ 新建规则</button>
                                  </div>
                                  <table v-if="getRules(t.编号).length" class="table table-xs">
                                    <thead><tr><th>编号</th><th>输出到</th><th>计算方式</th><th>条件</th><th>顺序</th><th></th></tr></thead>
                                    <tbody>
                                      <tr v-for="(r, i) in getRules(t.编号)" :key="r.编号 || i" class="hover cursor-pointer" @click="openEditRule(t.编号, i, r)">
                                        <td class="font-mono text-xs">{{ r.编号 }}</td>
                                        <td>{{ r.输出字段键 }}</td>
                                        <td><span class="badge badge-xs">{{ r.计算方式 }}</span></td>
                                        <td class="text-xs text-base-content/60">{{ condSummary(r) }}</td>
                                        <td>{{ r.计算顺序 }}</td>
                                        <td><button class="btn btn-ghost btn-xs text-error" @click.stop="deleteRuleInline(t.编号, i)">🗑️</button></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                                <!-- 模板参数 -->
                                <div>
                                  <span class="text-xs font-semibold">模板参数</span>
                                  <div class="mt-1"><EditableTable :columns="paramCols" :rows="getParams(t.编号)" id-key="字段键"
                                    @add="addP(t.编号)" @update="(e) => upP(t.编号, e.index, e.row)" @delete="(e) => delP(t.编号, e.index)" /></div>
                                </div>
                              </div>
                            </div>
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

    <!-- 费用规则弹窗 -->
    <dialog :open="showRuleModal" class="modal">
      <div class="modal-box w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">{{ editingRuleIdx >= 0 ? '编辑规则' : '新建规则' }}</h3>
        <!-- 基本信息 -->
        <div class="grid grid-cols-4 gap-2 mb-4">
          <div><label class="label py-0 text-xs">编号</label><input v-model="ruleForm.编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">费用名称</label><input v-model="ruleForm.费用名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">顺序</label><input v-model="ruleForm.计算顺序" type="number" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">启用</label><select v-model="ruleForm.启用" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select></div>
        </div>
        <div class="form-control mb-3">
          <label class="label py-0 text-xs">输出字段键</label>
          <input v-model="ruleForm.输出字段键" class="input input-bordered input-sm" list="ruleOutputKeys">
          <datalist id="ruleOutputKeys"><option v-for="k in outputKeys" :key="k" :value="k" /></datalist>
        </div>
        <!-- 条件 -->
        <fieldset class="fieldset p-3 bg-base-200 rounded mb-3">
          <legend class="font-semibold text-sm">条件（同行 AND，跨行同输出字段键 = OR）</legend>
          <div class="grid grid-cols-4 gap-2 mb-2">
            <div><label class="label py-0 text-xs">条件1字段</label><input v-model="ruleForm.条件1字段" class="input input-bordered input-sm w-full" list="ruleFieldKeys"></div>
            <div><label class="label py-0 text-xs">运算符</label><select v-model="ruleForm.条件1运算符" class="select select-bordered select-sm w-full"><option value="">—</option><option>等于</option><option>不等于</option><option>大于</option><option>大于等于</option><option>小于</option><option>小于等于</option></select></div>
            <div><label class="label py-0 text-xs">值</label><input v-model="ruleForm.条件1值" class="input input-bordered input-sm w-full"></div>
            <div><label class="label py-0 text-xs">值2</label><input v-model="ruleForm.条件1值2" class="input input-bordered input-sm w-full"></div>
          </div>
          <div class="text-xs mb-1">+ AND 条件2</div>
          <div class="grid grid-cols-4 gap-2">
            <input v-model="ruleForm.条件2字段" class="input input-bordered input-sm" list="ruleFieldKeys" placeholder="字段">
            <select v-model="ruleForm.条件2运算符" class="select select-bordered select-sm"><option value="">—</option><option>等于</option><option>不等于</option><option>大于</option><option>大于等于</option><option>小于</option><option>小于等于</option></select>
            <input v-model="ruleForm.条件2值" class="input input-bordered input-sm" placeholder="值">
            <input v-model="ruleForm.条件2值2" class="input input-bordered input-sm" placeholder="值2">
          </div>
          <datalist id="ruleFieldKeys"><option v-for="k in fieldKeys" :key="k" :value="k" /></datalist>
        </fieldset>
        <!-- 计算 -->
        <fieldset class="fieldset mb-3">
          <legend class="font-semibold text-sm">计算配置</legend>
          <select v-model="ruleForm.计算方式" class="select select-bordered select-sm mb-2"><option value="">— 选择 —</option><option>查表</option><option>百分比</option><option>固定值</option><option>加总</option><option>公式</option></select>
          <template v-if="ruleForm.计算方式 === '查表'">
            <div class="grid grid-cols-2 gap-2">
              <div><label class="label py-0 text-xs">查表名称</label><input v-model="ruleForm.查表名称" class="input input-bordered input-sm w-full"></div>
              <div><label class="label py-0 text-xs">匹配方式</label><select v-model="ruleForm.匹配方式" class="select select-bordered select-sm w-full"><option value="">—</option><option>精确</option><option>区间</option></select></div>
              <div><label class="label py-0 text-xs">输入映射</label><input v-model="ruleForm.输入映射" class="input input-bordered input-sm w-full"></div>
              <div><label class="label py-0 text-xs">输出列</label><input v-model="ruleForm.输出列" class="input input-bordered input-sm w-full"></div>
            </div>
          </template>
          <template v-if="ruleForm.计算方式 === '百分比'">
            <div class="grid grid-cols-3 gap-2">
              <div><label class="label py-0 text-xs">基数</label><input v-model="ruleForm.百分比基数" class="input input-bordered input-sm w-full" list="ruleFieldKeys"></div>
              <div><label class="label py-0 text-xs">固定%值</label><input v-model="ruleForm.百分比值" class="input input-bordered input-sm w-full"></div>
              <div><label class="label py-0 text-xs">动态来源字段</label><input v-model="ruleForm.百分比来源字段" class="input input-bordered input-sm w-full" list="ruleFieldKeys"></div>
            </div>
          </template>
          <template v-if="ruleForm.计算方式 === '固定值'"><div><label class="label py-0 text-xs">固定金额</label><input v-model="ruleForm.固定金额" class="input input-bordered input-sm w-32"></div></template>
          <template v-if="ruleForm.计算方式 === '加总'"><div><label class="label py-0 text-xs">加总字段</label><input v-model="ruleForm.加总字段" class="input input-bordered input-sm w-full" list="ruleFieldKeys"></div></template>
          <template v-if="ruleForm.计算方式 === '公式'"><div><label class="label py-0 text-xs">公式</label><input v-model="ruleForm.公式" class="input input-bordered input-sm w-full font-mono"></div></template>
        </fieldset>
        <div class="form-control mb-4"><label class="label py-0 text-xs">说明</label><input v-model="ruleForm.说明" class="input input-bordered input-sm w-full"></div>
        <div class="modal-action">
          <button v-if="editingRuleIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteRuleFromModal">删除</button>
          <button class="btn btn-ghost btn-sm" @click="showRuleModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveRule">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showRuleModal = false"><button>关闭</button></form>
    </dialog>
  </div>
</template>
