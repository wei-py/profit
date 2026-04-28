<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ActionEditor from '@/components/common/ActionEditor.vue'
import TreeView from '@/components/common/TreeView.vue'
import { useFileIO } from '@/composables/useFileIO'
import { useConfigStore } from '@/stores/config'

const configStore = useConfigStore()
const { openConfigExcel, saveConfigExcel } = useFileIO()

const showNoConfig = computed(() => !configStore.loaded)

const selectedRuleSetId = ref('')
const selectedRuleId = ref('')

const selectedTab = ref('rules')
const selectedLookupTableId = ref('')

const CACHE_RULESET_KEY = 'profit-selected-rule-set-id'
const CACHE_RULE_KEY = 'profit-selected-rule-id'
const CACHE_TAB_KEY = 'profit-selected-tab'
const CACHE_LOOKUP_KEY = 'profit-selected-lookup-table-id'

onMounted(() => {
  if (!configStore.loaded)
    return
  const cachedRuleSetId = localStorage.getItem(CACHE_RULESET_KEY)
  if (cachedRuleSetId && configStore.config.ruleSets.some(rs => rs.ruleSetId === cachedRuleSetId)) {
    selectedRuleSetId.value = cachedRuleSetId
  }
  const cachedRuleId = localStorage.getItem(CACHE_RULE_KEY)
  if (cachedRuleId && configStore.config.rules.some(r => r.ruleId === cachedRuleId)) {
    selectedRuleId.value = cachedRuleId
  }
  const cachedTab = localStorage.getItem(CACHE_TAB_KEY)
  if (cachedTab === 'rules' || cachedTab === 'lookups') {
    selectedTab.value = cachedTab
  }
  const cachedLookupId = localStorage.getItem(CACHE_LOOKUP_KEY)
  if (cachedLookupId && configStore.config.lookupTables.some(t => t.tableId === cachedLookupId)) {
    selectedLookupTableId.value = cachedLookupId
  }
})

watch(selectedRuleSetId, (val) => {
  localStorage.setItem(CACHE_RULESET_KEY, val)
})
watch(selectedRuleId, (val) => {
  localStorage.setItem(CACHE_RULE_KEY, val)
})
watch(selectedTab, (val) => {
  localStorage.setItem(CACHE_TAB_KEY, val)
})
watch(selectedLookupTableId, (val) => {
  localStorage.setItem(CACHE_LOOKUP_KEY, val)
})

const showRuleModal = ref(false)
const editingRule = ref(null)
const ruleForm = ref({
  ruleId: '',
  ruleSetId: '',
  priority: 100,
  enabled: true,
  rootGroupId: '',
  description: '',
})
const ruleErrors = ref([])

const showGroupModal = ref(false)
const editingGroup = ref(null)
const groupForm = ref({ groupId: '', ruleId: '', parentGroupId: '', logic: 'and', sort: 1, description: '' })

const showConditionModal = ref(false)
const editingCondition = ref(null)
const conditionForm = ref({
  conditionId: '',
  groupId: '',
  fieldKey: '',
  operator: 'eq',
  valueType: 'literal',
  value: '',
  valueEnd: '',
  sort: 1,
  description: '',
})

const showActionModal = ref(false)
const editingAction = ref(null)
const actionForm = ref({
  actionId: '',
  ruleId: '',
  sort: 1,
  actionType: 'set',
  targetField: '',
  configJson: {},
})

const showLookupModal = ref(false)
const editingLookup = ref(null)
const lookupForm = ref({
  tableId: '',
  tableName: '',
  matchMode: 'exact',
  sheetName: '',
  description: '',
})

const ruleSetRules = computed(() =>
  configStore.getRulesByRuleSet(selectedRuleSetId.value),
)

const selectedRule = computed(() =>
  configStore.config.rules.find(r => r.ruleId === selectedRuleId.value),
)

const selectedLookupTable = computed(() =>
  configStore.config.lookupTables.find(t => t.tableId === selectedLookupTableId.value),
)

function actionTypeLabel(type) {
  const map = {
    set: '赋值',
    lookup: '查表',
    branch: '分支',
  }
  return map[type] || type
}

function matchModeLabel(mode) {
  const map = {
    exact: '精确匹配',
    range: '区间匹配',
  }
  return map[mode] || mode
}

function openNewRule() {
  editingRule.value = null
  ruleForm.value = {
    ruleId: `rule_${Date.now()}`,
    ruleSetId: selectedRuleSetId.value,
    priority: 100,
    enabled: true,
    rootGroupId: '',
    description: '',
  }
  ruleErrors.value = []
  showRuleModal.value = true
}

function openEditRule(rule) {
  editingRule.value = rule
  ruleForm.value = { ...rule }
  showRuleModal.value = true
}

function saveRule() {
  if (!ruleForm.value.ruleId)
    return

  if (editingRule.value) {
    Object.assign(editingRule.value, ruleForm.value)
    const idx = configStore.config.rules.findIndex(r => r.ruleId === editingRule.value.ruleId)
    if (idx !== -1) {
      configStore.config.rules[idx] = editingRule.value
    }
  }
  else {
    const newRule = {
      ...ruleForm.value,
      conditionGroups: [],
      allConditions: [],
      conditionTree: [],
      actions: [],
    }
    configStore.config.rules.push(newRule)
    selectedRuleId.value = newRule.ruleId
  }
  showRuleModal.value = false
}

function deleteRule(rule) {
  configStore.config.rules = configStore.config.rules.filter(r => r.ruleId !== rule.ruleId)
  if (selectedRuleId.value === rule.ruleId)
    selectedRuleId.value = ''
}

function openNewGroup(parent) {
  editingGroup.value = null
  groupForm.value = {
    groupId: `grp_${Date.now()}`,
    ruleId: selectedRuleId.value,
    parentGroupId: parent ? parent.id : selectedRule.value?.rootGroupId || '',
    logic: 'and',
    sort: 1,
    description: '',
  }
  showGroupModal.value = true
}

function openEditGroup(group) {
  editingGroup.value = group
  groupForm.value = { ...group }
  showGroupModal.value = true
}

function saveGroup() {
  if (!selectedRule.value)
    return
  if (editingGroup.value) {
    Object.assign(editingGroup.value, groupForm.value)
  }
  else {
    selectedRule.value.conditionGroups.push({
      group_id: groupForm.value.groupId,
      rule_id: groupForm.value.ruleId,
      parent_group_id: groupForm.value.parentGroupId || '',
      logic: groupForm.value.logic,
      sort: groupForm.value.sort,
      description: groupForm.value.description,
    })
  }
  rebuildConditionTree()
  showGroupModal.value = false
}

function deleteGroup(group) {
  if (!selectedRule.value)
    return
  selectedRule.value.conditionGroups = selectedRule.value.conditionGroups.filter(
    g => g.group_id !== group.id && !isDescendant(group.id),
  )
  selectedRule.value.allConditions = selectedRule.value.allConditions.filter(
    _c => !isDescendantCondition(group.id),
  )
  rebuildConditionTree()

  function isDescendant(gid) {
    const children = selectedRule.value.conditionGroups.filter(c => c.parent_group_id === gid)
    for (const child of children) {
      isDescendant(child.group_id)
    }
    selectedRule.value.conditionGroups = selectedRule.value.conditionGroups.filter(c => c.group_id !== gid)
  }

  function isDescendantCondition(gid) {
    const cGroups = selectedRule.value.conditionGroups.filter(g => g.parent_group_id === gid)
    for (const cg of cGroups) {
      isDescendantCondition(cg.group_id)
    }
    const idx = selectedRule.value.allConditions.findIndex(c => c.group_id === gid)
    if (idx !== -1)
      selectedRule.value.allConditions.splice(idx, 1)
  }
}

function openEditCondition(cond) {
  editingCondition.value = cond
  conditionForm.value = {
    conditionId: cond.id,
    groupId: cond.groupId,
    fieldKey: cond.fieldKey,
    operator: cond.operator,
    valueType: cond.valueType || 'literal',
    value: cond.value,
    valueEnd: cond.valueEnd || '',
    sort: cond.sort,
    description: cond.description || '',
  }
  showConditionModal.value = true
}

function saveCondition() {
  if (!selectedRule.value)
    return
  const flat = {
    condition_id: conditionForm.value.conditionId,
    group_id: conditionForm.value.groupId,
    field_key: conditionForm.value.fieldKey,
    operator: conditionForm.value.operator,
    value_type: conditionForm.value.valueType,
    value: conditionForm.value.value,
    value_end: conditionForm.value.valueEnd,
    sort: conditionForm.value.sort,
    description: conditionForm.value.description,
  }

  if (editingCondition.value) {
    const idx = selectedRule.value.allConditions.findIndex(c => c.condition_id === editingCondition.value.id)
    if (idx !== -1)
      selectedRule.value.allConditions[idx] = flat
  }
  else {
    selectedRule.value.allConditions.push(flat)
  }
  rebuildConditionTree()
  showConditionModal.value = false
}

function deleteCondition(cond) {
  if (!selectedRule.value)
    return
  selectedRule.value.allConditions = selectedRule.value.allConditions.filter(
    c => c.condition_id !== cond.id,
  )
  rebuildConditionTree()
}

function rebuildConditionTree() {
  if (!selectedRule.value)
    return
  selectedRule.value.conditionTree = buildTreeFromGroups(
    selectedRule.value.conditionGroups,
    selectedRule.value.allConditions,
  )
}

function buildTreeFromGroups(groups, conditions) {
  const groupMap = new Map()
  const condMap = new Map()

  for (const g of groups) {
    groupMap.set(String(g.group_id), {
      id: String(g.group_id),
      ruleId: String(g.rule_id),
      parentGroupId: g.parent_group_id ? String(g.parent_group_id) : null,
      logic: (g.logic || 'and').toLowerCase(),
      sort: Number(g.sort) || 0,
      conditions: [],
      children: [],
    })
  }

  for (const c of conditions) {
    const key = String(c.condition_id)
    condMap.set(key, {
      id: key,
      groupId: String(c.group_id),
      fieldKey: c.field_key,
      operator: (c.operator || 'eq').toLowerCase(),
      valueType: c.value_type || 'literal',
      value: c.value,
      valueEnd: c.value_end || undefined,
      sort: Number(c.sort) || 0,
    })
  }

  const roots = []
  for (const g of groups) {
    const node = groupMap.get(String(g.group_id))
    if (!node)
      continue
    for (const c of conditions) {
      if (String(c.group_id) === node.id) {
        node.conditions.push(condMap.get(String(c.condition_id)))
      }
    }
    node.conditions.sort((a, b) => a.sort - b.sort)
    if (node.parentGroupId && groupMap.has(node.parentGroupId)) {
      groupMap.get(node.parentGroupId).children.push(node)
    }
    else {
      roots.push(node)
    }
  }

  for (const g of groupMap.values()) {
    g.children.sort((a, b) => a.sort - b.sort)
  }
  return roots
}

function openNewAction() {
  editingAction.value = null
  actionForm.value = {
    actionId: `act_${Date.now()}`,
    ruleId: selectedRuleId.value,
    sort: 1,
    actionType: 'set',
    targetField: '',
    configJson: {},
  }
  showActionModal.value = true
}

function openEditAction(action) {
  editingAction.value = action
  actionForm.value = { ...action }
  showActionModal.value = true
}

function saveAction() {
  if (!selectedRule.value)
    return
  const flat = {
    ...actionForm.value,
    configJson: actionForm.value.configJson,
  }
  if (editingAction.value) {
    const idx = selectedRule.value.actions.findIndex(a => a.actionId === editingAction.value.actionId)
    if (idx !== -1)
      selectedRule.value.actions[idx] = flat
  }
  else {
    selectedRule.value.actions.push(flat)
  }
  selectedRule.value.actions.sort((a, b) => a.sort - b.sort)
  showActionModal.value = false
}

function deleteAction(action) {
  if (!selectedRule.value)
    return
  selectedRule.value.actions = selectedRule.value.actions.filter(a => a.actionId !== action.actionId)
}

function openNewLookup() {
  editingLookup.value = null
  lookupForm.value = {
    tableId: `table_${Date.now()}`,
    tableName: '',
    matchMode: 'exact',
    sheetName: '',
    description: '',
  }
  showLookupModal.value = true
}

function openEditLookup(table) {
  editingLookup.value = table
  lookupForm.value = { ...table }
  showLookupModal.value = true
}

function saveLookup() {
  if (editingLookup.value) {
    Object.assign(editingLookup.value, lookupForm.value)
  }
  else {
    configStore.config.lookupTables.push({
      ...lookupForm.value,
      rows: [],
    })
    selectedLookupTableId.value = lookupForm.value.tableId
  }
  showLookupModal.value = false
}

function deleteLookup(table) {
  configStore.config.lookupTables = configStore.config.lookupTables.filter(t => t.tableId !== table.tableId)
  if (selectedLookupTableId.value === table.tableId)
    selectedLookupTableId.value = ''
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">
        模板
      </h1>
      <div class="flex gap-2">
        <button v-if="showNoConfig" class="btn btn-primary btn-sm" @click="openConfigExcel">
          打开配置
        </button>
        <button v-else class="btn btn-ghost btn-sm" @click="saveConfigExcel">
          保存配置
        </button>
      </div>
    </div>

    <div v-if="showNoConfig" class="text-center py-20 text-base-content/50">
      <p class="mb-4">
        请先打开配置 Excel 文件以开始使用。
      </p>
      <button class="btn btn-primary" @click="openConfigExcel">
        打开配置 Excel
      </button>
    </div>

    <div v-else class="flex gap-6">
      <div class="w-64 flex-shrink-0 space-y-4">
        <div class="card bg-base-100 border border-base-300" data-tour="template-ruleset-list">
          <div class="card-body p-3">
            <h3 class="font-medium text-sm mb-1">
              规则集
            </h3>
            <ul class="menu menu-vertical gap-0.5 w-full">
              <li v-for="rs in configStore.config.ruleSets" :key="rs.ruleSetId">
                <button
                  :class="{ active: selectedRuleSetId === rs.ruleSetId }"
                  @click="selectedRuleSetId = rs.ruleSetId; selectedRuleId = ''"
                >
                  {{ rs.name }}
                </button>
              </li>
              <li v-if="configStore.config.ruleSets.length === 0">
                <span class="text-base-content/50 text-xs">暂无规则集</span>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="selectedRuleSetId" class="card bg-base-100 border border-base-300" data-tour="template-rule-list">
          <div class="card-body p-3">
            <div class="flex justify-between items-center mb-1">
              <h3 class="font-medium text-sm">
                规则
              </h3>
              <button class="btn btn-ghost btn-xs" @click="openNewRule">
                +
              </button>
            </div>
            <ul class="menu menu-vertical gap-0.5 w-full">
              <li v-for="r in ruleSetRules" :key="r.ruleId">
                <button
                  :class="{ active: selectedRuleId === r.ruleId }"
                  @click="selectedRuleId = r.ruleId"
                >
                  <span class="text-xs">{{ r.description || r.ruleId }}</span>
                </button>
              </li>
              <li v-if="ruleSetRules.length === 0">
                <span class="text-base-content/50 text-xs">暂无规则</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <div v-if="!selectedRule" class="card bg-base-100 border border-base-300">
          <div class="card-body text-center py-20 text-base-content/50">
            请选择规则集和规则。
          </div>
        </div>

        <div v-else>
          <div data-tour="template-rule-detail" class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold">
                {{ selectedRule.description || selectedRule.ruleId }}
              </h2>
              <p class="text-sm text-base-content/60">
                优先级：{{ selectedRule.priority }} | 启用：{{ selectedRule.enabled ? '是' : '否' }}
              </p>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-sm" @click="openEditRule(selectedRule)">
                编辑规则
              </button>
              <button class="btn btn-ghost btn-sm text-error" @click="deleteRule(selectedRule)">
                删除
              </button>
            </div>
          </div>

          <div class="tabs tabs-bordered mb-4" data-tour="template-tabs">
            <button
              class="tab"
              :class="{ 'tab-active': selectedTab === 'rules' }"
              @click="selectedTab = 'rules'"
            >
              条件与动作
            </button>
            <button
              class="tab"
              :class="{ 'tab-active': selectedTab === 'lookups' }"
              @click="selectedTab = 'lookups'"
            >
              查找表
            </button>
          </div>

          <div v-if="selectedTab === 'rules'" class="space-y-6">
            <div class="card bg-base-100 border border-base-300" data-tour="template-condition-tree">
              <div class="card-body">
                <div class="flex justify-between items-center mb-3">
                  <h3 class="font-medium">
                    条件树
                  </h3>
                  <button class="btn btn-ghost btn-xs" @click="openNewGroup(null)">
                    + 根分组
                  </button>
                </div>
                <div data-tour="template-condition-detail">
                  <TreeView
                    :tree="buildTreeFromGroups(selectedRule.conditionGroups, selectedRule.allConditions)"
                    :editable="true"
                    @edit-group="openEditGroup"
                    @edit-condition="openEditCondition"
                    @add-child="openNewGroup"
                    @delete-group="deleteGroup"
                    @delete-condition="deleteCondition"
                  />
                </div>
              </div>
            </div>

            <div class="card bg-base-100 border border-base-300" data-tour="template-action-list">
              <div class="card-body">
                <div class="flex justify-between items-center mb-3">
                  <h3 class="font-medium">
                    动作
                  </h3>
                  <button class="btn btn-ghost btn-xs" @click="openNewAction">
                    + 新建动作
                  </button>
                </div>
                <div v-if="selectedRule.actions.length === 0" class="text-base-content/50 text-sm py-2">
                  暂无动作
                </div>
                <div v-else class="space-y-3" data-tour="template-action-detail">
                  <div v-for="action in selectedRule.actions" :key="action.actionId">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="badge badge-outline">{{ actionTypeLabel(action.actionType) }}</span>
                      <span class="text-sm">{{ action.targetField }}</span>
                      <span class="text-xs text-base-content/50">排序：{{ action.sort }}</span>
                      <div class="flex-1" />
                      <button class="btn btn-ghost btn-xs" @click="openEditAction(action)">
                        编辑
                      </button>
                      <button class="btn btn-ghost btn-xs text-error" @click="deleteAction(action)">
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedTab === 'lookups'" class="space-y-4">
            <div class="flex gap-6">
              <div class="w-64 flex-shrink-0">
                <div class="card bg-base-100 border border-base-300" data-tour="template-lookup-list">
                  <div class="card-body p-3">
                    <div class="flex justify-between items-center mb-1">
                      <h3 class="font-medium text-sm">
                        查找表
                      </h3>
                      <button class="btn btn-ghost btn-xs" @click="openNewLookup">
                        +
                      </button>
                    </div>
                    <ul class="menu menu-vertical gap-0.5 w-full">
                      <li v-for="t in configStore.config.lookupTables" :key="t.tableId">
                        <button
                          :class="{ active: selectedLookupTableId === t.tableId }"
                          @click="selectedLookupTableId = t.tableId"
                        >
                          <span class="text-xs">{{ t.tableName || t.tableId }}</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="flex-1">
                <div v-if="!selectedLookupTable" class="card bg-base-100 border border-base-300">
                  <div class="card-body text-center py-20 text-base-content/50">
                    请选择一个查找表。
                  </div>
                </div>
                <div v-else class="card bg-base-100 border border-base-300">
                  <div class="card-body">
                    <div class="flex justify-between items-center mb-3">
                      <div>
                        <h3 class="font-medium">
                          {{ selectedLookupTable.tableName }}
                        </h3>
                        <p class="text-xs text-base-content/60">
                          {{ selectedLookupTable.sheetName }} | {{ matchModeLabel(selectedLookupTable.matchMode) }}
                        </p>
                      </div>
                      <div class="flex gap-1">
                        <button class="btn btn-ghost btn-sm" @click="openEditLookup(selectedLookupTable)">
                          编辑
                        </button>
                        <button class="btn btn-ghost btn-sm text-error" @click="deleteLookup(selectedLookupTable)">
                          删除
                        </button>
                      </div>
                    </div>
                    <div v-if="!selectedLookupTable.rows || selectedLookupTable.rows.length === 0" class="text-base-content/50 text-sm">
                      暂无数据行。
                    </div>
                    <div v-else class="overflow-x-auto">
                      <table class="table table-sm">
                        <thead>
                          <tr>
                            <th v-for="key in Object.keys(selectedLookupTable.rows[0])" :key="key">
                              {{ key }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(row, i) in selectedLookupTable.rows" :key="i">
                            <td v-for="key in Object.keys(selectedLookupTable.rows[0])" :key="key">
                              {{ row[key] }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rule Modal -->
    <div v-if="showRuleModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingRule ? '编辑' : '新建' }}规则
        </h3>
        <div class="space-y-3">
          <div>
            <label class="label text-xs pb-1">规则 ID</label>
            <input v-model="ruleForm.ruleId" type="text" class="input input-bordered w-full" :disabled="!!editingRule">
          </div>
          <div>
            <label class="label text-xs pb-1">说明</label>
            <input v-model="ruleForm.description" type="text" class="input input-bordered w-full">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">优先级</label>
              <input v-model.number="ruleForm.priority" type="number" class="input input-bordered w-full">
            </div>
            <div>
              <label class="label text-xs pb-1">根分组 ID</label>
              <input v-model="ruleForm.rootGroupId" type="text" class="input input-bordered w-full">
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="ruleForm.enabled" type="checkbox" class="toggle toggle-sm">
            <span class="text-sm">启用</span>
          </label>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showRuleModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="saveRule">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showRuleModal = false" />
    </div>

    <!-- Condition Modal -->
    <div v-if="showConditionModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingCondition ? '编辑' : '新建' }}条件
        </h3>
        <div class="space-y-3">
          <div>
            <label class="label text-xs pb-1">字段</label>
            <select v-model="conditionForm.fieldKey" class="select select-bordered w-full">
              <option value="">
                -- 请选择 --
              </option>
              <option v-for="f in configStore.config.fields" :key="f.fieldKey" :value="f.fieldKey">
                {{ f.fieldName || f.fieldKey }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">运算符</label>
              <select v-model="conditionForm.operator" class="select select-bordered w-full">
                <option value="eq">
                  =
                </option>
                <option value="neq">
                  !=
                </option>
                <option value="gt">
                  &gt;
                </option>
                <option value="gte">
                  &gt;=
                </option>
                <option value="lt">
                  &lt;
                </option>
                <option value="lte">
                  &lt;=
                </option>
                <option value="between">
                  区间
                </option>
                <option value="in">
                  包含
                </option>
                <option value="not_in">
                  不包含
                </option>
              </select>
            </div>
            <div>
              <label class="label text-xs pb-1">值类型</label>
              <select v-model="conditionForm.valueType" class="select select-bordered w-full">
                <option value="literal">
                  字面量
                </option>
                <option value="number_range">
                  数值区间
                </option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">值</label>
              <input v-model="conditionForm.value" type="text" class="input input-bordered w-full">
            </div>
            <div v-if="conditionForm.operator === 'between'">
              <label class="label text-xs pb-1">结束值</label>
              <input v-model="conditionForm.valueEnd" type="text" class="input input-bordered w-full">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">排序</label>
              <input v-model.number="conditionForm.sort" type="number" class="input input-bordered w-full">
            </div>
            <div>
              <label class="label text-xs pb-1">分组 ID</label>
              <input v-model="conditionForm.groupId" type="text" class="input input-bordered w-full" disabled>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showConditionModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="saveCondition">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showConditionModal = false" />
    </div>

    <!-- Group Modal -->
    <div v-if="showGroupModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingGroup ? '编辑' : '新建' }}分组
        </h3>
        <div class="space-y-3">
          <div>
            <label class="label text-xs pb-1">分组 ID</label>
            <input v-model="groupForm.groupId" type="text" class="input input-bordered w-full" :disabled="!!editingGroup">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">逻辑</label>
              <select v-model="groupForm.logic" class="select select-bordered w-full">
                <option value="and">
                  AND
                </option>
                <option value="or">
                  OR
                </option>
              </select>
            </div>
            <div>
              <label class="label text-xs pb-1">排序</label>
              <input v-model.number="groupForm.sort" type="number" class="input input-bordered w-full">
            </div>
          </div>
          <div>
            <label class="label text-xs pb-1">说明</label>
            <input v-model="groupForm.description" type="text" class="input input-bordered w-full">
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showGroupModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="saveGroup">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showGroupModal = false" />
    </div>

    <!-- Action Modal -->
    <div v-if="showActionModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="text-lg font-bold mb-4">
          {{ editingAction ? '编辑' : '新建' }}动作
        </h3>
        <ActionEditor
          v-model="actionForm"
          :fields="configStore.config.fields"
          :lookup-tables="configStore.config.lookupTables"
        />
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showActionModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="saveAction">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showActionModal = false" />
    </div>

    <!-- Lookup Modal -->
    <div v-if="showLookupModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">
          {{ editingLookup ? '编辑' : '新建' }}查找表
        </h3>
        <div class="space-y-3">
          <div>
            <label class="label text-xs pb-1">表 ID</label>
            <input v-model="lookupForm.tableId" type="text" class="input input-bordered w-full" :disabled="!!editingLookup">
          </div>
          <div>
            <label class="label text-xs pb-1">表名称</label>
            <input v-model="lookupForm.tableName" type="text" class="input input-bordered w-full">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs pb-1">匹配模式</label>
              <select v-model="lookupForm.matchMode" class="select select-bordered w-full">
                <option value="exact">
                  精确匹配
                </option>
                <option value="range">
                  区间匹配
                </option>
              </select>
            </div>
            <div>
              <label class="label text-xs pb-1">工作表名称</label>
              <input v-model="lookupForm.sheetName" type="text" class="input input-bordered w-full">
            </div>
          </div>
          <div>
            <label class="label text-xs pb-1">说明</label>
            <input v-model="lookupForm.description" type="text" class="input input-bordered w-full">
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" @click="showLookupModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" @click="saveLookup">
            保存
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showLookupModal = false" />
    </div>
  </div>
</template>
