import * as XLSX from 'xlsx'

function sheetToObjects(ws) {
  if (!ws)
    return []
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string')
    return {}
  try {
    return JSON.parse(raw.trim())
  }
  catch {
    return {}
  }
}

function parseNumber(val) {
  if (val === '' || val === undefined || val === null)
    return null
  const n = Number(val)
  return Number.isNaN(n) ? null : n
}

function normalizeBoolean(val) {
  if (typeof val === 'boolean')
    return val
  if (val === 'true' || val === 'TRUE' || val === 1 || val === '1')
    return true
  if (val === 'false' || val === 'FALSE' || val === 0 || val === '0')
    return false
  return !!val
}

function findSheet(wb, names) {
  for (const name of names) {
    if (wb.SheetNames.includes(name))
      return wb.Sheets[name]
  }
  return null
}

function buildConditionTree(groups, conditions) {
  const groupMap = new Map()
  const conditionMap = new Map()

  for (const g of groups) {
    groupMap.set(String(g.group_id), {
      id: String(g.group_id),
      ruleId: String(g.rule_id),
      parentGroupId: g.parent_group_id != null && g.parent_group_id !== '' ? String(g.parent_group_id) : null,
      logic: (g.logic || 'and').toLowerCase(),
      sort: parseNumber(g.sort) ?? 0,
      conditions: [],
      children: [],
    })
  }

  for (const c of conditions) {
    const key = String(c.condition_id)
    conditionMap.set(key, {
      id: key,
      groupId: String(c.group_id),
      fieldKey: c.field_key,
      operator: (c.operator || 'eq').toLowerCase(),
      valueType: c.value_type || 'literal',
      value: c.value,
      valueEnd: c.value_end != null && c.value_end !== '' ? c.value_end : undefined,
      sort: parseNumber(c.sort) ?? 0,
    })
  }

  const roots = []

  for (const g of groups) {
    const group = groupMap.get(String(g.group_id))
    if (!group)
      continue

    for (const c of conditions) {
      if (String(c.group_id) === group.id) {
        group.conditions.push(conditionMap.get(String(c.condition_id)))
      }
    }
    group.conditions.sort((a, b) => a.sort - b.sort)

    if (group.parentGroupId && groupMap.has(group.parentGroupId)) {
      groupMap.get(group.parentGroupId).children.push(group)
    }
    else {
      roots.push(group)
    }
  }

  for (const g of groupMap.values()) {
    g.children.sort((a, b) => a.sort - b.sort)
  }

  return roots
}

export function readConfigWorkbook(wb) {
  const result = {
    presets: [],
    optionGroups: [],
    fields: [],
    ruleSets: [],
    rules: [],
    lookupTables: [],
  }

  const opGroupsWs = findSheet(wb, ['option_groups', 'optionGroups'])
  if (opGroupsWs) {
    const items = sheetToObjects(opGroupsWs)
    result.optionGroups = items.map(r => ({
      groupId: String(r.option_group_id ?? r.group_id ?? ''),
      groupName: r.option_group_name ?? r.group_name ?? '',
      description: r.description ?? '',
    }))
  }

  const opItemsWs = findSheet(wb, ['option_items', 'optionItems'])
  if (opItemsWs) {
    const items = sheetToObjects(opItemsWs)
    const groupMap = new Map()
    for (const g of result.optionGroups) {
      groupMap.set(g.groupId, [])
    }
    for (const r of items) {
      const gid = String(r.option_group_id ?? r.group_id ?? '')
      const arr = groupMap.get(gid) || []
      arr.push({
        groupId: gid,
        itemValue: r.item_value ?? r.value ?? '',
        itemLabel: r.item_label ?? r.label ?? '',
        sort: parseNumber(r.sort) ?? 0,
        enabled: normalizeBoolean(r.enabled ?? true),
      })
      if (!groupMap.has(gid))
        groupMap.set(gid, arr)
    }
    for (const g of result.optionGroups) {
      const arr = groupMap.get(g.groupId) || []
      arr.sort((a, b) => a.sort - b.sort)
      g.items = arr
    }
  }

  const fieldsWs = findSheet(wb, ['fields'])
  if (fieldsWs) {
    result.fields = sheetToObjects(fieldsWs).map(r => ({
      fieldKey: r.field_key,
      fieldName: r.field_name,
      type: r.type || 'text',
      unit: r.unit || '',
      optionGroupId: r.option_group_id ? String(r.option_group_id) : '',
      ruleMode: r.rule_mode || 'input',
      required: normalizeBoolean(r.required),
      description: r.description || '',
    }))
  }

  const ruleSetsWs = findSheet(wb, ['rule_sets', 'ruleSets'])
  if (ruleSetsWs) {
    result.ruleSets = sheetToObjects(ruleSetsWs).map(r => ({
      ruleSetId: String(r.rule_set_id ?? ''),
      name: r.name ?? r.rule_set_name ?? '',
      description: r.description ?? '',
      enabled: normalizeBoolean(r.enabled ?? true),
    }))
  }

  const rulesWs = findSheet(wb, ['rules'])
  const groupsWss = findSheet(wb, ['rule_condition_groups', 'ruleConditionGroups'])
  const condsWs = findSheet(wb, ['rule_conditions', 'ruleConditions'])
  const actionsWs = findSheet(wb, ['rule_actions', 'ruleActions'])

  const allGroups = groupsWss ? sheetToObjects(groupsWss) : []
  const allConds = condsWs ? sheetToObjects(condsWs) : []
  const allActions = actionsWs ? sheetToObjects(actionsWs) : []

  if (rulesWs) {
    const rawRules = sheetToObjects(rulesWs)
    for (const r of rawRules) {
      const rid = String(r.rule_id ?? '')
      const ruleGroups = allGroups.filter(g => String(g.rule_id) === rid)
      const ruleConds = allConds.filter((c) => {
        const cGid = String(c.group_id)
        return ruleGroups.some(g => String(g.group_id) === cGid)
      })
      const ruleActions = allActions
        .filter(a => String(a.rule_id) === rid)
        .map(a => ({
          actionId: String(a.action_id ?? ''),
          ruleId: rid,
          sort: parseNumber(a.sort) ?? 0,
          actionType: a.action_type || 'set',
          targetField: a.target_field || '',
          configJson: safeParseJSON(a.config_json),
        }))
        .sort((a, b) => a.sort - b.sort)

      const rootGroup = ruleGroups.find(g => String(g.group_id) === String(r.root_group_id))

      result.rules.push({
        ruleId: rid,
        ruleSetId: String(r.rule_set_id ?? ''),
        priority: parseNumber(r.priority) ?? 0,
        enabled: normalizeBoolean(r.enabled ?? true),
        rootGroupId: r.root_group_id ? String(r.root_group_id) : null,
        description: r.description || '',
        conditionGroups: ruleGroups,
        conditionTree: rootGroup
          ? buildConditionTree(
              ruleGroups.filter(g => isDescendantOf(g, rootGroup, ruleGroups)),
              ruleConds,
            )
          : [],
        allConditions: ruleConds,
        actions: ruleActions,
      })
    }
    result.rules.sort((a, b) => a.priority - b.priority)
  }

  const lookupTablesWs = findSheet(wb, ['lookup_tables', 'lookupTables'])
  if (lookupTablesWs) {
    result.lookupTables = sheetToObjects(lookupTablesWs).map((r) => {
      const sheetName = r.sheet_name || ''
      const dataWs = wb.Sheets[sheetName]
      let rows = []
      if (dataWs) {
        rows = sheetToObjects(dataWs)
      }
      return {
        tableId: String(r.table_id ?? ''),
        tableName: r.table_name || '',
        matchMode: r.match_mode || 'exact',
        sheetName,
        description: r.description || '',
        rows,
      }
    })
  }

  const presetsWs = findSheet(wb, ['presets'])
  const presetParamsWs = findSheet(wb, ['preset_params', 'presetParams'])

  if (presetsWs) {
    const presetRows = sheetToObjects(presetsWs)
    const paramRows = presetParamsWs ? sheetToObjects(presetParamsWs) : []
    result.presets = presetRows.map((r) => {
      const pid = String(r.preset_id ?? '')
      const params = paramRows
        .filter(p => String(p.preset_id) === pid)
        .map(p => ({
          paramId: String(p.param_id ?? p.id ?? ''),
          presetId: pid,
          fieldKey: p.field_key || '',
          paramName: p.param_name || '',
          type: p.type || 'text',
          unit: p.unit || '',
          optionGroupId: p.option_group_id ? String(p.option_group_id) : '',
          defaultValue: p.default_value ?? '',
          sort: parseNumber(p.sort) ?? 0,
          isRequired: normalizeBoolean(p.is_required ?? false),
        }))
        .sort((a, b) => a.sort - b.sort)
      return {
        presetId: pid,
        presetName: r.preset_name || '',
        country: r.country || '',
        platform: r.platform || '',
        ruleSetId: String(r.rule_set_id ?? ''),
        enabled: normalizeBoolean(r.enabled ?? true),
        params,
      }
    })
  }

  return result
}

function isDescendantOf(group, ancestor, allGroups) {
  let current = group
  const visited = new Set()
  while (current && current.parent_group_id && !visited.has(String(current.group_id))) {
    visited.add(String(current.group_id))
    if (String(current.parent_group_id) === String(ancestor.group_id))
      return true
    current = allGroups.find(g => String(g.group_id) === String(current.parent_group_id))
    if (!current)
      break
  }
  return false
}

export function readWorkbookBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  return readConfigWorkbook(wb)
}
