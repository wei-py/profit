<script setup>
import { computed, reactive, ref } from 'vue'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const CORE_KEYS = ['编号', '国家', '平台', '货币']

// ── 国家表格 ──
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

const cpId = computed(() => expandedId.value)

// ══════════════════════════════════════════════════════════
// 计算字段 弹窗
// ══════════════════════════════════════════════════════════
const showFieldModal = ref(false)
const fieldForm = reactive({})
const editingFieldIdx = ref(-1)

const expFields = computed(() => cpId.value ? store.getFieldsByCountry(cpId.value) : [])

function openNewField() {
  editingFieldIdx.value = -1
  Object.assign(fieldForm, { 字段键:'',字段名称:'',类型:'数字',单位:'',选项组编号:'',所属国家平台:cpId.value,层级:'商品级',输入输出:'输入',必填:'否',说明:'' })
  showFieldModal.value = true
}
function openEditField(idx) {
  editingFieldIdx.value = idx
  Object.assign(fieldForm, JSON.parse(JSON.stringify(expFields.value[idx])))
  showFieldModal.value = true
}
function saveField() {
  if (editingFieldIdx.value >= 0) {
    const x = store['计算字段'].indexOf(expFields.value[editingFieldIdx.value])
    if (x !== -1) store['计算字段'][x] = { ...fieldForm }
  } else {
    store['计算字段'].push({ ...fieldForm })
  }
  showFieldModal.value = false
}
function deleteField(idx) {
  const x = store['计算字段'].indexOf(expFields.value[idx])
  if (x !== -1) store['计算字段'].splice(x, 1)
}

// ══════════════════════════════════════════════════════════
// 选项组 弹窗
// ══════════════════════════════════════════════════════════
const showOptModal = ref(false)
const optForm = reactive({})
const editingOptIdx = ref(-1)
const optItemsLocal = ref([]) // 弹窗内编辑的选项值

const expOptGroups = computed(() => cpId.value ? store.getOptionGroupsByCountry(cpId.value) : [])

function openNewOpt() {
  editingOptIdx.value = -1
  Object.assign(optForm, { 编号:'',名称:'',所属国家平台:cpId.value,说明:'' })
  optItemsLocal.value = []
  showOptModal.value = true
}
function openEditOpt(idx) {
  editingOptIdx.value = idx
  const g = expOptGroups.value[idx]
  Object.assign(optForm, JSON.parse(JSON.stringify(g)))
  optItemsLocal.value = JSON.parse(JSON.stringify(store.getOptionItemsByGroup(g.编号)))
  showOptModal.value = true
}
function saveOpt() {
  if (editingOptIdx.value >= 0) {
    const x = store['选项组'].indexOf(expOptGroups.value[editingOptIdx.value])
    if (x !== -1) store['选项组'][x] = { ...optForm }
    // 替换选项值
    const gid = optForm.编号
    const keep = []
    for (const r of store['选项值']) { if (r.所属分组 !== gid) keep.push(r) }
    store['选项值'] = [...keep, ...optItemsLocal.value]
  } else {
    store['选项组'].push({ ...optForm })
    store['选项值'] = [...store['选项值'], ...optItemsLocal.value]
  }
  showOptModal.value = false
}
function deleteOpt(idx) {
  const g = expOptGroups.value[idx]
  const x = store['选项组'].indexOf(g)
  if (x !== -1) store['选项组'].splice(x, 1)
  store['选项值'] = store['选项值'].filter(r => r.所属分组 !== g.编号)
}
function addOptItem() {
  optItemsLocal.value.push({ 所属分组:optForm.编号,选项值:'',显示名:'',排序:'',启用:'是',备注:'' })
}
function delOptItem(i) { optItemsLocal.value.splice(i, 1) }

// ══════════════════════════════════════════════════════════
// 模板 弹窗
// ══════════════════════════════════════════════════════════
const showTplModal = ref(false)
const tplForm = reactive({})
const editingTplIdx = ref(-1)
const tplRulesLocal = ref([])
const tplParamsLocal = ref([])

const expTemplates = computed(() => cpId.value ? store.getTemplatesByCountry(cpId.value) : [])
const countryFieldKeys = computed(() => store.getFieldsByCountry(cpId.value).map(f => f.字段键))
const outputKeys = computed(() => store.getFieldsByCountry(cpId.value).filter(f => f.输入输出 === '输出').map(f => f.字段键))

function openNewTpl() {
  editingTplIdx.value = -1
  Object.assign(tplForm, { 编号:'',名称:'',所属国家平台:cpId.value,启用:'是',说明:'' })
  tplRulesLocal.value = []
  tplParamsLocal.value = []
  showTplModal.value = true
}
function openEditTpl(idx) {
  editingTplIdx.value = idx
  const t = expTemplates.value[idx]
  Object.assign(tplForm, JSON.parse(JSON.stringify(t)))
  tplRulesLocal.value = JSON.parse(JSON.stringify(store.getFeeRulesByTemplate(t.编号)))
  tplParamsLocal.value = JSON.parse(JSON.stringify(store.getTemplateParams(t.编号)))
  showTplModal.value = true
}
function saveTpl() {
  if (editingTplIdx.value >= 0) {
    const x = store['计算模板'].indexOf(expTemplates.value[editingTplIdx.value])
    if (x !== -1) store['计算模板'][x] = { ...tplForm }
    const tid = tplForm.编号
    const keepR = []; for (const r of store['费用规则']) { if (r.所属模板 !== tid) keepR.push(r) }
    store['费用规则'] = [...keepR, ...tplRulesLocal.value]
    const keepP = []; for (const p of store['模板参数']) { if (p.模板编号 !== tid) keepP.push(p) }
    store['模板参数'] = [...keepP, ...tplParamsLocal.value]
  } else {
    store['计算模板'].push({ ...tplForm })
    store['费用规则'] = [...store['费用规则'], ...tplRulesLocal.value]
    store['模板参数'] = [...store['模板参数'], ...tplParamsLocal.value]
  }
  showTplModal.value = false
}
function deleteTpl(idx) {
  const t = expTemplates.value[idx]
  const x = store['计算模板'].indexOf(t)
  if (x !== -1) store['计算模板'].splice(x, 1)
  store['费用规则'] = store['费用规则'].filter(r => r.所属模板 !== t.编号)
  store['模板参数'] = store['模板参数'].filter(p => p.模板编号 !== t.编号)
}

// ── 模板内 规则/参数 CRUD ──
const showRuleSubModal = ref(false)
const ruleForm = reactive({})
const editingRuleIdx = ref(-1)

function openNewRule() {
  editingRuleIdx.value = -1
  Object.assign(ruleForm, { 编号:'',所属模板:tplForm.编号,输出字段键:'',费用名称:'',计算顺序:'',启用:'是',条件1字段:'',条件1运算符:'',条件1值:'',条件1值2:'',条件2字段:'',条件2运算符:'',条件2值:'',条件2值2:'',计算方式:'',查表名称:'',匹配方式:'',输入映射:'',输出列:'',百分比基数:'',百分比值:'',百分比来源字段:'',固定金额:'',加总字段:'',公式:'',累加:'否',说明:'' })
  showRuleSubModal.value = true
}
function openEditRule(idx) {
  editingRuleIdx.value = idx
  Object.assign(ruleForm, JSON.parse(JSON.stringify(tplRulesLocal.value[idx])))
  showRuleSubModal.value = true
}
function saveRule() {
  if (editingRuleIdx.value >= 0) tplRulesLocal.value[editingRuleIdx.value] = { ...ruleForm }
  else tplRulesLocal.value.push({ ...ruleForm })
  showRuleSubModal.value = false
}
function deleteRuleFromSub() {
  if (editingRuleIdx.value >= 0) tplRulesLocal.value.splice(editingRuleIdx.value, 1)
  showRuleSubModal.value = false
}
function deleteRuleInline(i) { tplRulesLocal.value.splice(i, 1) }

function addParam() { tplParamsLocal.value.push({ 模板编号:tplForm.编号,字段键:'',默认值:'',必填:'否' }) }
function delParam(i) { tplParamsLocal.value.splice(i, 1) }

function condSummary(r) {
  const p = []
  if (r.条件1字段) p.push(`${r.条件1字段} ${r.条件1运算符||''} ${r.条件1值}`)
  if (r.条件2字段) p.push(`AND ${r.条件2字段} ${r.条件2运算符||''} ${r.条件2值}`)
  return p.join(' ') || '—'
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
                  <th v-for="k in allKeys" :key="k" class="relative group">{{ k }}
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
                      <span v-if="editingCell?.id !== row.编号 || editingCell?.key !== k" class="cursor-text min-w-[2rem] inline-block">{{ k === '启用' ? (row[k] === '是' || row[k] === 'TRUE' ? '是' : '否') : (row[k] || '—') }}</span>
                      <input v-else :value="row[k]" class="input input-bordered input-xs w-full" @blur="editingCell = null; updateCell(row.编号, k, $event.target.value)" @keyup.enter="editingCell = null; updateCell(row.编号, k, $event.target.value)" />
                    </td>
                    <td><button class="btn btn-ghost btn-xs text-error" @click="deleteRow(row.编号)">🗑️</button></td>
                  </tr>
                  <tr v-if="expandedId === row.编号">
                    <td :colspan="allKeys.length + 2" class="p-4 bg-base-200/50">
                      <div class="grid grid-cols-3 gap-4">

                        <!-- 计算字段 -->
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">计算字段（{{ expFields.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewField">＋</button>
                            </div>
                            <div v-if="!expFields.length" class="text-xs text-base-content/40">暂无</div>
                            <div v-for="(f, i) in expFields" :key="f.字段键 || i" class="flex items-center justify-between py-1 border-b border-base-200 text-xs">
                              <span class="cursor-pointer hover:text-primary" @click="openEditField(i)">{{ f.字段键 || '(新字段)' }} <span class="text-base-content/40">{{ f.层级 }}·{{ f.输入输出 }}</span></span>
                              <button class="btn btn-ghost btn-xs text-error" @click="deleteField(i)">🗑️</button>
                            </div>
                          </div>
                        </div>

                        <!-- 选项组 -->
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">选项组（{{ expOptGroups.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewOpt">＋</button>
                            </div>
                            <div v-if="!expOptGroups.length" class="text-xs text-base-content/40">暂无</div>
                            <div v-for="(g, i) in expOptGroups" :key="g.编号 || i" class="flex items-center justify-between py-1 border-b border-base-200 text-xs">
                              <span class="cursor-pointer hover:text-primary" @click="openEditOpt(i)">{{ g.名称 || '(新)' }} <span class="text-base-content/40">{{ g.编号 }}</span></span>
                              <button class="btn btn-ghost btn-xs text-error" @click="deleteOpt(i)">🗑️</button>
                            </div>
                          </div>
                        </div>

                        <!-- 计算模板 -->
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">计算模板（{{ expTemplates.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewTpl">＋</button>
                            </div>
                            <div v-if="!expTemplates.length" class="text-xs text-base-content/40">暂无</div>
                            <div v-for="(t, i) in expTemplates" :key="t.编号 || i" class="flex items-center justify-between py-1 border-b border-base-200 text-xs">
                              <span class="cursor-pointer hover:text-primary" @click="openEditTpl(i)">{{ t.名称 || '(新)' }} <span class="badge badge-xs">{{ t.启用 === '是' ? '启用' : '—' }}</span></span>
                              <button class="btn btn-ghost btn-xs text-error" @click="deleteTpl(i)">🗑️</button>
                            </div>
                          </div>
                        </div>

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

    <!-- ═══ 计算字段弹窗 ═══ -->
    <dialog :open="showFieldModal" class="modal">
      <div class="modal-box max-w-lg">
        <h3 class="text-lg font-bold mb-4">{{ editingFieldIdx >= 0 ? '编辑字段' : '新建字段' }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label py-0 text-xs">字段键</label><input v-model="fieldForm.字段键" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">字段名称</label><input v-model="fieldForm.字段名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">类型</label><select v-model="fieldForm.类型" class="select select-bordered select-sm w-full"><option>数字</option><option>文本</option><option>下拉</option><option>布尔</option></select></div>
          <div><label class="label py-0 text-xs">层级</label><select v-model="fieldForm.层级" class="select select-bordered select-sm w-full"><option>商品级</option><option>SKU级</option></select></div>
          <div><label class="label py-0 text-xs">输入/输出</label><select v-model="fieldForm.输入输出" class="select select-bordered select-sm w-full"><option>输入</option><option>输出</option></select></div>
          <div><label class="label py-0 text-xs">单位</label><input v-model="fieldForm.单位" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">选项组编号</label><input v-model="fieldForm.选项组编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">必填</label><select v-model="fieldForm.必填" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select></div>
        </div>
        <div class="mt-2"><label class="label py-0 text-xs">说明</label><input v-model="fieldForm.说明" class="input input-bordered input-sm w-full"></div>
        <div class="modal-action">
          <button v-if="editingFieldIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteField(editingFieldIdx); showFieldModal = false">删除</button>
          <button class="btn btn-ghost btn-sm" @click="showFieldModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveField">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showFieldModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 选项组弹窗（含选项值） ═══ -->
    <dialog :open="showOptModal" class="modal">
      <div class="modal-box max-w-2xl max-h-[85vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">{{ editingOptIdx >= 0 ? '编辑选项组' : '新建选项组' }}</h3>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div><label class="label py-0 text-xs">编号</label><input v-model="optForm.编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">名称</label><input v-model="optForm.名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">说明</label><input v-model="optForm.说明" class="input input-bordered input-sm w-full"></div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">选项值（{{ optItemsLocal.length }}）</span>
            <button class="btn btn-xs btn-primary" @click="addOptItem">＋</button>
          </div>
          <table v-if="optItemsLocal.length" class="table table-xs">
            <thead><tr><th>选项值</th><th>显示名</th><th>排序</th><th>启用</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(item, i) in optItemsLocal" :key="i">
                <td><input v-model="item.选项值" class="input input-bordered input-xs w-20"></td>
                <td><input v-model="item.显示名" class="input input-bordered input-xs w-24"></td>
                <td><input v-model="item.排序" class="input input-bordered input-xs w-12"></td>
                <td><select v-model="item.启用" class="select select-bordered select-xs w-16"><option>是</option><option>否</option></select></td>
                <td><button class="btn btn-ghost btn-xs text-error" @click="delOptItem(i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-action">
          <button v-if="editingOptIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteOpt(editingOptIdx); showOptModal = false">删除</button>
          <button class="btn btn-ghost btn-sm" @click="showOptModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveOpt">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showOptModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 模板弹窗（含费用规则 + 模板参数） ═══ -->
    <dialog :open="showTplModal" class="modal">
      <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">{{ editingTplIdx >= 0 ? '编辑模板' : '新建模板' }}</h3>
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div><label class="label py-0 text-xs">编号</label><input v-model="tplForm.编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">名称</label><input v-model="tplForm.名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">启用</label><select v-model="tplForm.启用" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select></div>
          <div><label class="label py-0 text-xs">说明</label><input v-model="tplForm.说明" class="input input-bordered input-sm w-full"></div>
        </div>

        <!-- 费用规则 -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">费用规则（{{ tplRulesLocal.length }} 条）</span>
            <button class="btn btn-xs btn-primary" @click="openNewRule">＋ 新建规则</button>
          </div>
          <table v-if="tplRulesLocal.length" class="table table-xs">
            <thead><tr><th>编号</th><th>输出到</th><th>计算方式</th><th>条件</th><th>顺序</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in tplRulesLocal" :key="r.编号 || i" class="hover cursor-pointer" @click="openEditRule(i)">
                <td class="font-mono text-xs">{{ r.编号 }}</td>
                <td>{{ r.输出字段键 }}</td>
                <td><span class="badge badge-xs">{{ r.计算方式 }}</span></td>
                <td class="text-xs text-base-content/60">{{ condSummary(r) }}</td>
                <td>{{ r.计算顺序 }}</td>
                <td><button class="btn btn-ghost btn-xs text-error" @click.stop="deleteRuleInline(i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="text-xs text-base-content/40">暂无规则</div>
        </div>

        <!-- 模板参数 -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">模板参数（{{ tplParamsLocal.length }}）</span>
            <button class="btn btn-xs btn-primary" @click="addParam">＋</button>
          </div>
          <table v-if="tplParamsLocal.length" class="table table-xs">
            <thead><tr><th>字段键</th><th>默认值</th><th>必填</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in tplParamsLocal" :key="i">
                <td><input v-model="p.字段键" class="input input-bordered input-xs w-24" list="paramKeys"></td>
                <td><input v-model="p.默认值" class="input input-bordered input-xs w-24"></td>
                <td><select v-model="p.必填" class="select select-bordered select-xs w-16"><option>是</option><option>否</option></select></td>
                <td><button class="btn btn-ghost btn-xs text-error" @click="delParam(i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <datalist id="paramKeys"><option v-for="k in countryFieldKeys" :key="k" :value="k" /></datalist>
        </div>

        <div class="modal-action">
          <button v-if="editingTplIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteTpl(editingTplIdx); showTplModal = false">删除</button>
          <button class="btn btn-ghost btn-sm" @click="showTplModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveTpl">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showTplModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 费用规则子弹窗 ═══ -->
    <dialog :open="showRuleSubModal" class="modal">
      <div class="modal-box w-11/12 max-w-3xl max-h-[85vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">{{ editingRuleIdx >= 0 ? '编辑规则' : '新建规则' }}</h3>
        <div class="grid grid-cols-4 gap-2 mb-4">
          <div><label class="label py-0 text-xs">编号</label><input v-model="ruleForm.编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">费用名称</label><input v-model="ruleForm.费用名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">顺序</label><input v-model="ruleForm.计算顺序" type="number" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">启用</label><select v-model="ruleForm.启用" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select></div>
        </div>
        <div class="mb-3"><label class="label py-0 text-xs">输出字段键</label><input v-model="ruleForm.输出字段键" class="input input-bordered input-sm w-full" list="rOutputKeys"><datalist id="rOutputKeys"><option v-for="k in outputKeys" :key="k" :value="k" /></datalist></div>

        <fieldset class="fieldset p-3 bg-base-200 rounded mb-3">
          <legend class="font-semibold text-sm">条件（同行=AND，多行同输出字段键=OR）</legend>
          <div class="grid grid-cols-4 gap-2 mb-2">
            <div><label class="label py-0 text-xs">条件1字段</label><input v-model="ruleForm.条件1字段" class="input input-bordered input-sm w-full" list="rFieldKeys"></div>
            <div><label class="label py-0 text-xs">运算符</label><select v-model="ruleForm.条件1运算符" class="select select-bordered select-sm w-full"><option value="">—</option><option>等于</option><option>不等于</option><option>大于</option><option>大于等于</option><option>小于</option><option>小于等于</option></select></div>
            <div><label class="label py-0 text-xs">值</label><input v-model="ruleForm.条件1值" class="input input-bordered input-sm w-full"></div>
            <div><label class="label py-0 text-xs">值2</label><input v-model="ruleForm.条件1值2" class="input input-bordered input-sm w-full"></div>
          </div>
          <div class="text-xs mb-1">{{ ruleForm.条件2字段 ? 'AND' : '+ AND 条件2' }}</div>
          <div class="grid grid-cols-4 gap-2">
            <input v-model="ruleForm.条件2字段" class="input input-bordered input-sm" list="rFieldKeys" placeholder="字段">
            <select v-model="ruleForm.条件2运算符" class="select select-bordered select-sm"><option value="">—</option><option>等于</option><option>不等于</option><option>大于</option><option>大于等于</option><option>小于</option><option>小于等于</option></select>
            <input v-model="ruleForm.条件2值" class="input input-bordered input-sm" placeholder="值">
            <input v-model="ruleForm.条件2值2" class="input input-bordered input-sm" placeholder="值2">
          </div>
          <datalist id="rFieldKeys"><option v-for="k in countryFieldKeys" :key="k" :value="k" /></datalist>
        </fieldset>

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
              <div><label class="label py-0 text-xs">基数</label><input v-model="ruleForm.百分比基数" class="input input-bordered input-sm w-full" list="rFieldKeys"></div>
              <div><label class="label py-0 text-xs">固定%值</label><input v-model="ruleForm.百分比值" class="input input-bordered input-sm w-full"></div>
              <div><label class="label py-0 text-xs">动态来源</label><input v-model="ruleForm.百分比来源字段" class="input input-bordered input-sm w-full" list="rFieldKeys"></div>
            </div>
          </template>
          <template v-if="ruleForm.计算方式 === '固定值'"><div><label class="label py-0 text-xs">固定金额</label><input v-model="ruleForm.固定金额" class="input input-bordered input-sm w-32"></div></template>
          <template v-if="ruleForm.计算方式 === '加总'"><div><label class="label py-0 text-xs">加总字段（逗号分隔）</label><input v-model="ruleForm.加总字段" class="input input-bordered input-sm w-full" list="rFieldKeys"></div></template>
          <template v-if="ruleForm.计算方式 === '公式'"><div><label class="label py-0 text-xs">公式</label><input v-model="ruleForm.公式" class="input input-bordered input-sm w-full font-mono"></div></template>
        </fieldset>

        <div class="mb-4"><label class="label py-0 text-xs">说明</label><input v-model="ruleForm.说明" class="input input-bordered input-sm w-full"></div>

        <div class="modal-action">
          <button v-if="editingRuleIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteRuleFromSub">删除</button>
          <button class="btn btn-ghost btn-sm" @click="showRuleSubModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveRule">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showRuleSubModal = false"><button>关闭</button></form>
    </dialog>
  </div>
</template>
