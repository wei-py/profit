<script setup>
import { computed, reactive, ref } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const CORE_KEYS = ['编号', '国家', '平台', '货币', '货币符号', '汇率', '启用', '排序']

// ═══ 国家表格：动态列 ═══
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
function deleteRow(id) { const i = store['国家平台'].findIndex(r => r.编号 === id); if (i !== -1) store['国家平台'].splice(i, 1) }
function toggleExpand(id) { expandedId.value = expandedId.value === id ? null : id }

// ═══ 国家编辑弹窗 ═══
const showCountryModal = ref(false)
const countryForm = reactive({ 编号: '' })
const editingCountryId = ref('')

function openEditCountry(row) {
  editingCountryId.value = row.编号
  Object.assign(countryForm, JSON.parse(JSON.stringify(row)))
  showCountryModal.value = true
}
function saveCountry() {
  const idx = store['国家平台'].findIndex(r => r.编号 === editingCountryId.value)
  if (idx !== -1) store['国家平台'][idx] = { ...countryForm }
  showCountryModal.value = false
}

const cpId = computed(() => expandedId.value)

// ═══ 计算字段 弹窗 ═══
const showFieldModal = ref(false)
const fieldForm = reactive({})
const editingFieldIdx = ref(-1)
const expFields = computed(() => cpId.value ? store.getFieldsByCountry(cpId.value) : [])

function openNewField() {
  editingFieldIdx.value = -1
  Object.assign(fieldForm, { 字段键:'',字段名称:'',类型:'数字',单位:'',选项组编号:'',所属国家平台:cpId.value,层级:'商品级',输入输出:'输入',必填:'否',默认值:'',说明:'' })
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
  } else { store['计算字段'].push({ ...fieldForm }) }
  showFieldModal.value = false
}
function deleteField(idx) {
  const x = store['计算字段'].indexOf(expFields.value[idx])
  if (x !== -1) store['计算字段'].splice(x, 1)
}

// ═══ 选项组 弹窗 ═══
const showOptModal = ref(false)
const optForm = reactive({})
const editingOptIdx = ref(-1)
const optItemsLocal = ref([])
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
    const keep = store['选项值'].filter(r => r.所属分组 !== optForm.编号)
    store['选项值'] = [...keep, ...optItemsLocal.value]
  } else {
    store['选项组'].push({ ...optForm })
    store['选项值'] = [...store['选项值'], ...optItemsLocal.value]
  }
  showOptModal.value = false
}
function deleteOpt(idx) {
  const g = expOptGroups.value[idx]
  store['选项组'] = store['选项组'].filter(r => r.编号 !== g.编号)
  store['选项值'] = store['选项值'].filter(r => r.所属分组 !== g.编号)
}
function addOptItem() { optItemsLocal.value.push({ 所属分组:optForm.编号,选项值:'',显示名:'',排序:'',启用:'是',备注:'' }) }
function delOptItem(i) { optItemsLocal.value.splice(i, 1) }

// ═══ 模板 弹窗 ═══
const showTplModal = ref(false)
const tplForm = reactive({})
const editingTplIdx = ref(-1)
const tplRulesLocal = ref([])
const expTemplates = computed(() => cpId.value ? store.getTemplatesByCountry(cpId.value) : [])
const countryFieldKeys = computed(() => store.getFieldsByCountry(cpId.value).map(f => f.字段键))
const outputKeys = computed(() => store.getFieldsByCountry(cpId.value).filter(f => f.输入输出 === '输出').map(f => f.字段键))

function openNewTpl() {
  editingTplIdx.value = -1
  Object.assign(tplForm, { 编号:'',名称:'',所属国家平台:cpId.value,启用:'是',说明:'' })
  tplRulesLocal.value = []
  showTplModal.value = true
}
function openEditTpl(idx) {
  editingTplIdx.value = idx
  Object.assign(tplForm, JSON.parse(JSON.stringify(expTemplates.value[idx])))
  tplRulesLocal.value = JSON.parse(JSON.stringify(store.getFeeRulesByTemplate(expTemplates.value[idx].编号)))
  showTplModal.value = true
}
function saveTpl() {
  if (editingTplIdx.value >= 0) {
    const x = store['计算模板'].indexOf(expTemplates.value[editingTplIdx.value])
    if (x !== -1) store['计算模板'][x] = { ...tplForm }
    const keepR = store['费用规则'].filter(r => r.所属模板 !== tplForm.编号)
    store['费用规则'] = [...keepR, ...tplRulesLocal.value]
  } else {
    store['计算模板'].push({ ...tplForm })
    store['费用规则'] = [...store['费用规则'], ...tplRulesLocal.value]
  }
  showTplModal.value = false
}
function deleteTpl(idx) {
  const t = expTemplates.value[idx]
  store['计算模板'] = store['计算模板'].filter(r => r.编号 !== t.编号)
  store['费用规则'] = store['费用规则'].filter(r => r.所属模板 !== t.编号)
}

// ═══ 规则编辑弹窗（动态条件列表） ═══
const showRuleSubModal = ref(false)
const ruleForm = reactive({})
const editingRuleIdx = ref(-1)
// 条件树：每个节点自带 op（与前一兄弟的连接关系）。第一个节点 op 为空。
// cond: { type:'cond', idx, op:'AND'|'OR'|'' }
// group: { type:'group', op:'AND'|'OR', children: [cond|group], linkOp:'AND'|'OR'|'' }  // op=组内关系, linkOp=与前一兄弟关系
const condPool = ref([])
const condTree = ref({ type: 'group', op: 'AND', children: [], linkOp: '' })

function initCondTree() {
  condPool.value = [{ 字段: '', 运算符: '', 值: '' }]
  condTree.value = { type: 'group', op: 'AND', children: [{ type: 'cond', idx: 0, op: '' }], linkOp: '' }
}
// 展平条件树 → [{type:'group'|'cond', node, depth, parent, idxInParent}]
function flattenTree(node, depth = 0, parent = null, idx = 0) {
  const items = [{ type: node.type === 'group' ? 'group-open' : 'cond', node, depth, parent, idx }]
  if (node.type === 'group') {
    for (let i = 0; i < node.children.length; i++) {
      items.push(...flattenTree(node.children[i], depth + 1, node, i))
    }
    items.push({ type: 'group-close', node, depth, parent, idx })
  }
  return items
}
const flatTree = computed(() => condTree.value ? flattenTree(condTree.value) : [])

function addCond(parentGroup, op) {
  const idx = condPool.value.length
  condPool.value.push({ 字段: '', 运算符: '', 值: '' })
  parentGroup.children.push({ type: 'cond', idx, op: op || 'AND' })
}
function addSubGroup(parentGroup) {
  const g = { type: 'group', op: 'AND', children: [], linkOp: 'AND' }
  parentGroup.children.push(g)
  addCond(g, 'AND')
}
function delNode(parentGroup, i) { parentGroup.children.splice(i, 1) }
function toggleGroupOp(node) { node.op = node.op === 'AND' ? 'OR' : 'AND' }
function toggleLinkOp(item) {
  if (item.type === 'cond') {
    item.node.op = item.node.op === 'AND' ? 'OR' : 'AND'
  } else if (item.type === 'group-open') {
    item.node.linkOp = item.node.linkOp === 'AND' ? 'OR' : 'AND'
  }
}

function serializeCondTree() {
  function dfs(node) {
    if (node.type === 'cond') return `C${node.idx}`
    const parts = []
    for (const ch of node.children) {
      let prefix = ''
      if (ch.type === 'cond' && ch.op) prefix = ch.op[0] // A or O
      else if (ch.type === 'group' && ch.linkOp) prefix = ch.linkOp[0]
      parts.push(prefix + dfs(ch))
    }
    return `G${node.op[0]}[${parts.join(',')}]`
  }
  const form = { ...ruleForm }
  form.条件结构 = dfs(condTree.value)

  for (let i = 1; i <= 4; i++) {
    const c = condPool.value[i - 1]
    form['条件' + i + '字段'] = c ? c.字段 : ''
    form['条件' + i + '运算符'] = c ? c.运算符 : ''
    form['条件' + i + '值'] = c ? c.值 : ''
    form['条件' + i + '值2'] = ''
  }
  form.条件数据 = JSON.stringify({ pool: condPool.value, tree: condTree.value })
  return form
}

// 从 rule 反序列化条件树
function deserializeCondTree(r) {
  // 优先从 条件数据 JSON 加载完整树
  if (r.条件数据) {
    try {
      const d = JSON.parse(r.条件数据)
      condPool.value = d.pool || []
      condTree.value = d.tree || { type: 'group', op: 'AND', children: [{ type: 'cond', idx: 0, op: '' }], linkOp: '' }
      return
    } catch { /* fall through */ }
  }
  // 向后兼容：从条件1-4列构建
  condPool.value = []
  for (let i = 1; i <= 4; i++) {
    condPool.value.push({ 字段: r['条件' + i + '字段'] || '', 运算符: r['条件' + i + '运算符'] || '', 值: r['条件' + i + '值'] || '' })
  }
  condTree.value = { type: 'group', op: 'AND', children: [], linkOp: '' }
  for (let i = 0; i < condPool.value.length; i++) {
    if (condPool.value[i].字段) condTree.value.children.push({ type: 'cond', idx: i, op: i > 0 ? 'AND' : '' })
  }
  if (!condTree.value.children.length) condTree.value.children.push({ type: 'cond', idx: 0, op: '' })
}

function parseCondStruct(s) {
  // "0,1|2,3" → group(OR) with group(AND)[0,1] and group(AND)[2,3]
  function parse(seg) {
    if (!seg.includes('|') && !seg.includes(',')) {
      return { type: 'cond', idx: Number(seg.trim()) }
    }
    if (seg.includes('|')) {
      return { type: 'group', op: 'OR', children: seg.split('|').map(s => parse(s.trim())) }
    }
    return { type: 'group', op: 'AND', children: seg.split(',').map(s => parse(s.trim())) }
  }
  return parse(s)
}

function openNewRule() {
  editingRuleIdx.value = -1
  Object.assign(ruleForm, { 编号:'',所属模板:tplForm.编号,输出字段键:'',费用名称:'',计算顺序:'',启用:'是',计算方式:'',查表名称:'',匹配方式:'',输入映射:'',输出列:'',百分比基数:'',百分比值:'',百分比来源字段:'',固定金额:'',加总字段:'',公式:'',累加:'否',说明:'',条件结构:'' })
  initCondTree()
  showRuleSubModal.value = true
}
function openEditRule(idx) {
  editingRuleIdx.value = idx
  Object.assign(ruleForm, JSON.parse(JSON.stringify(tplRulesLocal.value[idx])))
  deserializeCondTree(tplRulesLocal.value[idx])
  showRuleSubModal.value = true
}
function saveRule() {
  const form = serializeCondTree()
  if (editingRuleIdx.value >= 0) tplRulesLocal.value[editingRuleIdx.value] = form
  else tplRulesLocal.value.push(form)
  showRuleSubModal.value = false
}
function deleteRuleFromSub() { if (editingRuleIdx.value >= 0) tplRulesLocal.value.splice(editingRuleIdx.value, 1); showRuleSubModal.value = false }
function deleteRuleInline(i) { tplRulesLocal.value.splice(i, 1) }

// ── 弹窗教学引导 ──
function startTour(steps) {
  const d = driver({ showProgress: true, animate: true, prevBtnText: '上一步', nextBtnText: '下一步', doneBtnText: '知道了', closeBtnText: '✕' })
  d.setSteps(steps)
  d.drive()
}

const countryEditSteps = [
  { popover: { title: '编辑国家', description: '修改国家平台的基本信息。编号、国家、平台、货币等核心字段。自定义列也可以在这里编辑。' } },
]

const fieldEditSteps = [
  { popover: { title: '字段编辑', description: '定义计算字段。字段键是唯一标识（中文），用于规则中的条件、公式引用。层级决定该字段在新建商品时的显示位置。' } },
  { element: '[data-tour="field-type"]', popover: { title: '字段类型', description: '下拉=选择框（需关联选项组），布尔=是/否，数字和文本=输入框。' } },
  { element: '[data-tour="field-level"]', popover: { title: '字段层级', description: '商品级=所有SKU共享（如刊登类型），SKU级=每个变体独立（如售价、重量）。' } },
  { element: '[data-tour="field-default"]', popover: { title: '默认值', description: '新建商品时自动填入的值。布尔字段选是/否，下拉字段选选项值，其他字段直接输入。' } },
]

const optionEditSteps = [
  { popover: { title: '编辑选项组', description: '选项组为下拉字段提供可选值。编号建议带国家前缀（如 br_刊登类型）。' } },
  { element: '[data-tour="opt-items"]', popover: { title: '选项值', description: '选项值=存储值（code），显示名=用户看到的文本。启用=否则该选项不出现在下拉框中。' } },
]

const templateEditSteps = [
  { popover: { title: '编辑模板', description: '计算模板定义一套费用计算方案，包含多条费用规则和查表数据。一个模板归属一个国家平台。' } },
  { element: '[data-tour="tpl-rules"]', popover: { title: '费用规则', description: '按计算顺序执行。点击规则行可编辑详细条件与计算方式。同行多个条件默认AND，多行同输出字段默认OR。' } },
  { element: '[data-tour="tpl-lookups"]', popover: { title: '查表数据', description: '新建或编辑费率表。规则中的"查表"计算方式会引用这些表。可自由增删行列，改表名。' } },
]

const ruleEditSteps = [
  { popover: { title: '编辑规则', description: '每条规则执行一个计算步骤。输出字段键指定结果写入哪个字段。计算方式决定如何算出结果。' } },
  { element: '[data-tour="rule-conds"]', popover: { title: '条件树', description: '组内条件按AND/OR组合。＋AND/＋OR添加条件（带上连接关系）。＋子组创建嵌套条件组。点击条件间的AND/OR标签可切换。' } },
  { element: '[data-tour="rule-calc"]', popover: { title: '计算配置', description: '查表=从费率表取值。百分比=基数×比率（可用固定百分比值或引用前面的结果作为动态费率）。加总=累加多个字段。公式=算术表达式。' } },
]

const lookupEditSteps = [
  { popover: { title: '查表编辑', description: '编辑费率表数据。表名可修改（同步更新所有规则中的引用）。＋行列增删行列。列头✕可删除整列。' } },
]

function condSummary(r) {
  const a = [1, 2].map(i => r['条件' + i + '字段'] ? `${r['条件' + i + '字段']} ${r['条件' + i + '运算符']||''} ${r['条件' + i + '值']}` : '').filter(Boolean).join(' AND ')
  const b = [3, 4].map(i => r['条件' + i + '字段'] ? `${r['条件' + i + '字段']} ${r['条件' + i + '运算符']||''} ${r['条件' + i + '值']}` : '').filter(Boolean).join(' AND ')
  if (a && b) return `(${a}) OR (${b})`
  return a || b || '—'
}

// ═══ 查表数据弹窗 ═══
const showLookupModal = ref(false)
const lookupTableName = ref('')
const lookupTableNewName = ref('')
const lookupRowsLocal = ref([])

// 扫描当前模板规则引用的所有查表名称
const allLookupNames = computed(() => Object.keys(store.lookupTables))
const newLookupName = ref('')
const showNewLookupInput = ref(false)

function openLookup(name) {
  lookupTableName.value = name
  lookupTableNewName.value = name
  lookupRowsLocal.value = JSON.parse(JSON.stringify(store.lookupTables[name] || []))
  showLookupModal.value = true
}
function openNewLookup() {
  const name = newLookupName.value.trim()
  if (!name) { showNewLookupInput.value = true; return }
  store.lookupTables = { ...store.lookupTables, [name]: [] }
  newLookupName.value = ''
  showNewLookupInput.value = false
}
function saveLookup() {
  const oldName = lookupTableName.value
  const newName = lookupTableNewName.value.trim()
  if (!newName) return
  // rename: 更新 lookupTables key 及规则中的引用
  if (oldName !== newName) {
    store.lookupTables = { ...store.lookupTables, [newName]: lookupRowsLocal.value }
    delete store.lookupTables[oldName]
    // 更新所有引用
    for (const r of store['费用规则']) { if (r.查表名称 === oldName) r.查表名称 = newName }
    for (const r of tplRulesLocal.value) { if (r.查表名称 === oldName) r.查表名称 = newName }
  } else {
    store.lookupTables = { ...store.lookupTables, [newName]: lookupRowsLocal.value }
  }
  showLookupModal.value = false
}
function deleteLookup(name) {
  if (!confirm(`删除查表「${name}」？`)) return
  delete store.lookupTables[name]
  store.lookupTables = { ...store.lookupTables }
  // 清空引用
  for (const r of store['费用规则']) { if (r.查表名称 === name) r.查表名称 = '' }
  for (const r of tplRulesLocal.value) { if (r.查表名称 === name) r.查表名称 = '' }
}
function addLookupRow() {
  if (!lookupRowsLocal.value.length) { lookupRowsLocal.value.push({}); return }
  const row = {}; for (const k of Object.keys(lookupRowsLocal.value[0])) row[k] = ''
  lookupRowsLocal.value.push(row)
}
const newLookupCol = ref('')

function delLookupRow(i) { lookupRowsLocal.value.splice(i, 1) }
function addLookupCol() {
  const col = newLookupCol.value.trim()
  if (!col) return
  for (const row of lookupRowsLocal.value) { if (!(col in row)) row[col] = '' }
  lookupRowsLocal.value = [...lookupRowsLocal.value]
  newLookupCol.value = ''
}
function delLookupCol(col) {
  for (const row of lookupRowsLocal.value) delete row[col]
  lookupRowsLocal.value = [...lookupRowsLocal.value]
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
                  <th class="w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(row, ri) in store['国家平台']" :key="row.编号 || ri">
                  <tr class="hover" :class="{ 'bg-base-200': expandedId === row.编号 }">
                    <td><button class="btn btn-ghost btn-xs" @click="toggleExpand(row.编号)">{{ expandedId === row.编号 ? '▼' : '▶' }}</button></td>
                    <td v-for="k in allKeys" :key="k" class="cursor-pointer" @click="toggleExpand(row.编号)">
                      {{ k === '启用' ? (row[k] === '是' || row[k] === 'TRUE' ? '是' : '否') : (row[k] || '—') }}
                    </td>
                    <td>
                      <button class="btn btn-ghost btn-xs" @click="openEditCountry(row)">✏️</button>
                      <button class="btn btn-ghost btn-xs text-error" @click="deleteRow(row.编号)">🗑️</button>
                    </td>
                  </tr>
                  <tr v-if="expandedId === row.编号">
                    <td :colspan="allKeys.length + 2" class="p-4 bg-base-200/50">
                      <div class="grid grid-cols-3 gap-4">
                        <!-- 计算字段 -->
                        <div class="card card-sm bg-base-100">
                          <div class="card-body p-3">
                            <div class="flex justify-between items-center mb-2">
                              <span class="font-semibold text-sm">字段（{{ expFields.length }}）</span>
                              <button class="btn btn-xs btn-primary" @click="openNewField">＋</button>
                            </div>
                            <div v-if="!expFields.length" class="text-xs text-base-content/40">暂无</div>
                            <div v-for="(f, i) in expFields" :key="f.字段键 || i" class="flex items-center justify-between py-1 border-b border-base-200 text-xs">
                              <span class="cursor-pointer hover:text-primary" @click="openEditField(i)">{{ f.字段键 || '(新)' }} <span class="text-base-content/40">{{ f.层级 }}·{{ f.输入输出 }}</span></span>
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
                              <span class="font-semibold text-sm">模板（{{ expTemplates.length }}）</span>
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

    <!-- ═══ 国家编辑弹窗 ═══ -->
    <dialog :open="showCountryModal" class="modal">
      <div class="modal-box max-w-lg">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">编辑国家</h3><button class="btn btn-ghost btn-sm btn-circle" @click="startTour(countryEditSteps)">?</button></div>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="k in allKeys" :key="k">
            <label class="label py-0 text-xs">{{ k }}</label>
            <input v-if="k !== '启用'" v-model="countryForm[k]" class="input input-bordered input-sm w-full">
            <select v-else v-model="countryForm.启用" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showCountryModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveCountry">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showCountryModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 字段弹窗 ═══ -->
    <dialog :open="showFieldModal" class="modal">
      <div class="modal-box max-w-lg">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">{{ editingFieldIdx >= 0 ? '编辑字段' : '新建字段' }}</h3><button class="btn btn-ghost btn-sm btn-circle" @click="startTour(fieldEditSteps)">?</button></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label py-0 text-xs">字段键</label><input v-model="fieldForm.字段键" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">字段名称</label><input v-model="fieldForm.字段名称" class="input input-bordered input-sm w-full"></div>
          <div data-tour="field-type"><label class="label py-0 text-xs">类型</label><select v-model="fieldForm.类型" class="select select-bordered select-sm w-full"><option>数字</option><option>文本</option><option>下拉</option><option>布尔</option></select></div>
          <div data-tour="field-level"><label class="label py-0 text-xs">层级</label><select v-model="fieldForm.层级" class="select select-bordered select-sm w-full"><option>商品级</option><option>SKU级</option></select></div>
          <div><label class="label py-0 text-xs">输入/输出</label><select v-model="fieldForm.输入输出" class="select select-bordered select-sm w-full"><option>输入</option><option>输出</option></select></div>
          <div><label class="label py-0 text-xs">单位</label><input v-model="fieldForm.单位" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">选项组编号</label><input v-model="fieldForm.选项组编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">必填</label><select v-model="fieldForm.必填" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select></div>
        </div>
        <div class="mt-2" data-tour="field-default">
          <label class="label py-0 text-xs">默认值</label>
          <select v-if="fieldForm.类型 === '布尔'" v-model="fieldForm.默认值" class="select select-bordered select-sm w-full">
            <option value="">—</option><option>是</option><option>否</option>
          </select>
          <select v-else-if="fieldForm.类型 === '下拉' && fieldForm.选项组编号" v-model="fieldForm.默认值" class="select select-bordered select-sm w-full">
            <option value="">—</option>
            <option v-for="item in store.getOptionItemsByGroup(fieldForm.选项组编号)" :key="item.选项值" :value="item.选项值">{{ item.显示名 }} ({{ item.选项值 }})</option>
          </select>
          <input v-else v-model="fieldForm.默认值" class="input input-bordered input-sm w-full" placeholder="默认值">
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

    <!-- ═══ 选项组弹窗 ═══ -->
    <dialog :open="showOptModal" class="modal">
      <div class="modal-box max-w-2xl max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">{{ editingOptIdx >= 0 ? '编辑选项组' : '新建选项组' }}</h3><button class="btn btn-ghost btn-sm btn-circle" @click="startTour(optionEditSteps)">?</button></div>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div><label class="label py-0 text-xs">编号</label><input v-model="optForm.编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">名称</label><input v-model="optForm.名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">说明</label><input v-model="optForm.说明" class="input input-bordered input-sm w-full"></div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold" data-tour="opt-items">选项值（{{ optItemsLocal.length }}）</span>
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

    <!-- ═══ 模板弹窗 ═══ -->
    <dialog :open="showTplModal" class="modal">
      <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">{{ editingTplIdx >= 0 ? '编辑模板' : '新建模板' }}</h3><button class="btn btn-ghost btn-sm btn-circle" @click="startTour(templateEditSteps)">?</button></div>
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
            <button class="btn btn-xs btn-primary" @click="openNewRule">＋</button>
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

        <!-- 查表数据 -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold">查表数据（{{ allLookupNames.length }} 个）</span>
            <div class="flex gap-1 items-center">
              <input v-if="showNewLookupInput" v-model="newLookupName" class="input input-bordered input-xs w-32" placeholder="表名" @keyup.enter="openNewLookup" />
              <button class="btn btn-xs btn-primary" @click="openNewLookup">＋ 新建表</button>
            </div>
          </div>
          <div v-for="name in allLookupNames" :key="name" class="flex items-center gap-2 py-1">
            <span class="text-xs font-mono">{{ name }}</span>
            <button class="btn btn-ghost btn-xs" @click="openLookup(name)">📊 编辑</button>
            <button class="btn btn-ghost btn-xs text-error" @click="deleteLookup(name)">🗑️</button>
          </div>
          <div v-if="!allLookupNames.length" class="text-xs text-base-content/40">无</div>
        </div>

        <div class="modal-action">
          <button v-if="editingTplIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteTpl(editingTplIdx); showTplModal = false">删除模板</button>
          <button class="btn btn-ghost btn-sm" @click="showTplModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveTpl">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showTplModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 规则编辑弹窗（动态条件） ═══ -->
    <dialog :open="showRuleSubModal" class="modal">
      <div class="modal-box w-11/12 max-w-3xl max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">{{ editingRuleIdx >= 0 ? '编辑规则' : '新建规则' }}</h3><button class="btn btn-ghost btn-sm btn-circle" @click="startTour(ruleEditSteps)">?</button></div>
        <div class="grid grid-cols-4 gap-2 mb-4">
          <div><label class="label py-0 text-xs">编号</label><input v-model="ruleForm.编号" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">费用名称</label><input v-model="ruleForm.费用名称" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">顺序</label><input v-model="ruleForm.计算顺序" type="number" class="input input-bordered input-sm w-full"></div>
          <div><label class="label py-0 text-xs">启用</label><select v-model="ruleForm.启用" class="select select-bordered select-sm w-full"><option>是</option><option>否</option></select></div>
        </div>
        <div class="mb-3"><label class="label py-0 text-xs">输出字段键</label><input v-model="ruleForm.输出字段键" class="input input-bordered input-sm w-full" list="rOutputKeys"><datalist id="rOutputKeys"><option v-for="k in outputKeys" :key="k" :value="k" /></datalist></div>

        <!-- 条件树 — 无限嵌套 -->
        <fieldset class="fieldset p-3 bg-base-200 rounded mb-3">
          <legend class="font-semibold text-sm">条件</legend>
          <template v-for="(item, i) in flatTree" :key="i">
            <!-- 组头 -->
            <div v-if="item.type === 'group-open'" :style="{ marginLeft: item.depth * 16 + 'px' }" class="flex items-center gap-2 mb-1 mt-1">
              <button v-if="item.depth > 0" class="btn btn-xs" @click="toggleGroupOp(item.node)">{{ item.node.op }}</button>
              <button class="btn btn-xs btn-ghost" @click="addCond(item.node, 'AND')">＋ AND</button>
              <button class="btn btn-xs btn-ghost" @click="addCond(item.node, 'OR')">＋ OR</button>
              <button class="btn btn-xs btn-ghost" @click="addSubGroup(item.node)">＋子组</button>
              <button v-if="item.depth > 0" class="btn btn-ghost btn-xs text-error" @click="delNode(item.parent, item.idx)">✕</button>
            </div>
            <!-- 条件 -->
            <div v-else-if="item.type === 'cond'" :style="{ marginLeft: item.depth * 16 + 'px' }" class="flex items-center gap-2 mb-1">
              <button v-if="item.idx > 0" class="btn btn-xs btn-ghost font-bold text-primary w-8" @click="toggleLinkOp(item)">{{ item.node.op }}</button>
              <span v-else class="w-8"></span>
              <input v-model="condPool[item.node.idx].字段" class="input input-bordered input-xs flex-1" list="rFieldKeys" placeholder="字段">
              <select v-model="condPool[item.node.idx].运算符" class="select select-bordered select-xs w-24"><option value="">—</option><option>等于</option><option>不等于</option><option>大于</option><option>大于等于</option><option>小于</option><option>小于等于</option></select>
              <input v-model="condPool[item.node.idx].值" class="input input-bordered input-xs w-20" placeholder="值">
              <button class="btn btn-ghost btn-xs text-error" @click="delNode(item.parent, item.idx)">✕</button>
            </div>
          </template>
        </fieldset>
        <datalist id="rFieldKeys"><option v-for="k in countryFieldKeys" :key="k" :value="k" /></datalist>

        <!-- 计算配置 -->
        <fieldset class="fieldset mb-3">
          <legend class="font-semibold text-sm">计算配置</legend>
          <select v-model="ruleForm.计算方式" class="select select-bordered select-sm mb-2"><option value="">— 选择 —</option><option>查表</option><option>百分比</option><option>固定值</option><option>加总</option><option>公式</option></select>
          <template v-if="ruleForm.计算方式 === '查表'">
            <div class="grid grid-cols-2 gap-2">
              <div><label class="label py-0 text-xs">查表名称</label><select v-model="ruleForm.查表名称" class="select select-bordered select-sm w-full"><option value="">—</option><option v-for="n in allLookupNames" :key="n" :value="n">{{ n }}</option></select></div>
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
          <button v-if="editingRuleIdx >= 0" class="btn btn-error btn-sm btn-outline" @click="deleteRuleFromSub">删除规则</button>
          <button class="btn btn-ghost btn-sm" @click="showRuleSubModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveRule">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showRuleSubModal = false"><button>关闭</button></form>
    </dialog>

    <!-- ═══ 查表数据弹窗 ═══ -->
    <dialog :open="showLookupModal" class="modal">
      <div class="modal-box w-11/12 max-w-4xl max-h-[85vh] overflow-y-auto">
        <div class="flex items-center gap-2 mb-4"><h3 class="text-lg font-bold">查表：</h3><input v-model="lookupTableNewName" class="input input-bordered input-sm w-48 font-mono"><button class="btn btn-ghost btn-sm btn-circle ml-auto" @click="startTour(lookupEditSteps)">?</button></div>
        <div class="flex gap-2 mb-3">
          <button class="btn btn-xs btn-ghost" @click="addLookupRow">＋ 行</button>
          <button class="btn btn-xs btn-ghost" @click="addLookupCol">＋ 列</button>
          <input v-model="newLookupCol" class="input input-bordered input-xs w-24" placeholder="列名" @keyup.enter="addLookupCol">
        </div>
        <div class="overflow-x-auto" v-if="lookupRowsLocal.length">
          <table class="table table-xs">
            <thead>
              <tr>
                <th v-for="k in Object.keys(lookupRowsLocal[0] || {})" :key="k" class="relative group">{{ k }}
                  <button class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 text-error absolute -top-1 -right-1" @click="delLookupCol(k)">✕</button>
                </th>
                <th class="w-12"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in lookupRowsLocal" :key="i">
                <td v-for="k in Object.keys(lookupRowsLocal[0] || {})" :key="k">
                  <input v-model="row[k]" class="input input-bordered input-xs w-full">
                </td>
                <td><button class="btn btn-ghost btn-xs text-error" @click="delLookupRow(i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-xs text-base-content/40 mb-4">空表，点击「＋ 行」或「＋ 列」开始</div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showLookupModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="saveLookup">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showLookupModal = false"><button>关闭</button></form>
    </dialog>
  </div>
</template>
