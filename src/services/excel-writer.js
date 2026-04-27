import * as XLSX from 'xlsx'

function objectsToSheet(data, headers) {
  const headerRow = headers.map(h => h.key)
  const ws = XLSX.utils.aoa_to_sheet([headerRow])
  data.forEach((row) => {
    const rowArr = headers.map((h) => {
      const val = row[h.prop] ?? ''
      if (typeof val === 'object' && val !== null)
        return JSON.stringify(val, null, 2)
      return val
    })
    XLSX.utils.sheet_add_aoa(ws, [rowArr], { origin: -1 })
  })
  return ws
}

export function buildConfigWorkbook(config) {
  const wb = XLSX.utils.book_new()

  if (config.presets && config.presets.length > 0) {
    const presetHeaders = [
      { key: 'preset_id', prop: 'presetId' },
      { key: 'preset_name', prop: 'presetName' },
      { key: 'country', prop: 'country' },
      { key: 'platform', prop: 'platform' },
      { key: 'rule_set_id', prop: 'ruleSetId' },
      { key: 'enabled', prop: 'enabled' },
    ]
    wb.SheetNames.push('presets')
    wb.Sheets.presets = objectsToSheet(config.presets, presetHeaders)

    const allParams = []
    for (const p of config.presets) {
      if (p.params) {
        for (const param of p.params) {
          allParams.push({ ...param, presetId: p.presetId })
        }
      }
    }
    if (allParams.length > 0) {
      const paramHeaders = [
        { key: 'param_id', prop: 'paramId' },
        { key: 'preset_id', prop: 'presetId' },
        { key: 'field_key', prop: 'fieldKey' },
        { key: 'param_name', prop: 'paramName' },
        { key: 'type', prop: 'type' },
        { key: 'unit', prop: 'unit' },
        { key: 'option_group_id', prop: 'optionGroupId' },
        { key: 'default_value', prop: 'defaultValue' },
        { key: 'sort', prop: 'sort' },
        { key: 'is_required', prop: 'isRequired' },
      ]
      const name = wb.SheetNames.includes('preset_params')
        ? `preset_params_${wb.SheetNames.length}`
        : 'preset_params'
      wb.SheetNames.push(name)
      wb.Sheets[name] = objectsToSheet(allParams, paramHeaders)
    }
  }

  if (config.optionGroups && config.optionGroups.length > 0) {
    const groupHeaders = [
      { key: 'option_group_id', prop: 'groupId' },
      { key: 'option_group_name', prop: 'groupName' },
      { key: 'description', prop: 'description' },
    ]
    wb.SheetNames.push('option_groups')
    wb.Sheets.option_groups = objectsToSheet(config.optionGroups, groupHeaders)

    const allItems = []
    for (const g of config.optionGroups) {
      if (g.items) {
        for (const item of g.items) {
          allItems.push({ ...item, groupId: g.groupId })
        }
      }
    }
    if (allItems.length > 0) {
      const itemHeaders = [
        { key: 'option_group_id', prop: 'groupId' },
        { key: 'item_value', prop: 'itemValue' },
        { key: 'item_label', prop: 'itemLabel' },
        { key: 'sort', prop: 'sort' },
        { key: 'enabled', prop: 'enabled' },
        { key: 'remark', prop: 'remark' },
      ]
      wb.SheetNames.push('option_items')
      wb.Sheets.option_items = objectsToSheet(allItems, itemHeaders)
    }
  }

  if (config.fields && config.fields.length > 0) {
    const fieldHeaders = [
      { key: 'field_key', prop: 'fieldKey' },
      { key: 'field_name', prop: 'fieldName' },
      { key: 'type', prop: 'type' },
      { key: 'unit', prop: 'unit' },
      { key: 'option_group_id', prop: 'optionGroupId' },
      { key: 'rule_mode', prop: 'ruleMode' },
      { key: 'required', prop: 'required' },
      { key: 'description', prop: 'description' },
    ]
    wb.SheetNames.push('fields')
    wb.Sheets.fields = objectsToSheet(config.fields, fieldHeaders)
  }

  if (config.ruleSets && config.ruleSets.length > 0) {
    const rsHeaders = [
      { key: 'rule_set_id', prop: 'ruleSetId' },
      { key: 'rule_set_name', prop: 'name' },
      { key: 'description', prop: 'description' },
      { key: 'enabled', prop: 'enabled' },
    ]
    wb.SheetNames.push('rule_sets')
    wb.Sheets.rule_sets = objectsToSheet(config.ruleSets, rsHeaders)
  }

  if (config.rules && config.rules.length > 0) {
    const ruleHeaders = [
      { key: 'rule_id', prop: 'ruleId' },
      { key: 'rule_set_id', prop: 'ruleSetId' },
      { key: 'priority', prop: 'priority' },
      { key: 'enabled', prop: 'enabled' },
      { key: 'root_group_id', prop: 'rootGroupId' },
      { key: 'description', prop: 'description' },
    ]
    wb.SheetNames.push('rules')
    wb.Sheets.rules = objectsToSheet(config.rules, ruleHeaders)

    const allGroups = []
    const allConds = []
    const allActions = []
    for (const r of config.rules) {
      if (r.conditionGroups)
        allGroups.push(...r.conditionGroups)
      if (r.allConditions)
        allConds.push(...r.allConditions)
      if (r.actions)
        allActions.push(...r.actions.map(a => ({ ...a, ruleId: r.ruleId })))
    }
    if (allGroups.length > 0) {
      const grpHeaders = [
        { key: 'group_id', prop: 'group_id' },
        { key: 'rule_id', prop: 'rule_id' },
        { key: 'parent_group_id', prop: 'parent_group_id' },
        { key: 'logic', prop: 'logic' },
        { key: 'sort', prop: 'sort' },
        { key: 'description', prop: 'description' },
      ]
      wb.SheetNames.push('rule_condition_groups')
      wb.Sheets.rule_condition_groups = objectsToSheet(allGroups, grpHeaders)
    }
    if (allConds.length > 0) {
      const condHeaders = [
        { key: 'condition_id', prop: 'condition_id' },
        { key: 'group_id', prop: 'group_id' },
        { key: 'field_key', prop: 'field_key' },
        { key: 'operator', prop: 'operator' },
        { key: 'value_type', prop: 'value_type' },
        { key: 'value', prop: 'value' },
        { key: 'value_end', prop: 'value_end' },
        { key: 'sort', prop: 'sort' },
        { key: 'description', prop: 'description' },
      ]
      wb.SheetNames.push('rule_conditions')
      wb.Sheets.rule_conditions = objectsToSheet(allConds, condHeaders)
    }
    if (allActions.length > 0) {
      const actHeaders = [
        { key: 'action_id', prop: 'action_id' },
        { key: 'rule_id', prop: 'rule_id' },
        { key: 'sort', prop: 'sort' },
        { key: 'action_type', prop: 'action_type' },
        { key: 'target_field', prop: 'target_field' },
        { key: 'config_json', prop: 'config_json' },
      ]
      wb.SheetNames.push('rule_actions')
      wb.Sheets.rule_actions = objectsToSheet(allActions, actHeaders)
    }
  }

  if (config.lookupTables && config.lookupTables.length > 0) {
    const ltHeaders = [
      { key: 'table_id', prop: 'tableId' },
      { key: 'table_name', prop: 'tableName' },
      { key: 'match_mode', prop: 'matchMode' },
      { key: 'sheet_name', prop: 'sheetName' },
      { key: 'description', prop: 'description' },
    ]
    wb.SheetNames.push('lookup_tables')
    wb.Sheets.lookup_tables = objectsToSheet(config.lookupTables, ltHeaders)

    for (const lt of config.lookupTables) {
      if (lt.rows && lt.rows.length > 0 && lt.sheetName) {
        const rowHeaders = Object.keys(lt.rows[0]).map(key => ({ key, prop: key }))
        const name = wb.SheetNames.includes(lt.sheetName)
          ? `${lt.sheetName}_${wb.SheetNames.length}`
          : lt.sheetName
        wb.SheetNames.push(name)
        wb.Sheets[name] = objectsToSheet(lt.rows, rowHeaders)
      }
    }
  }

  return wb
}

export function buildWorkbookBuffer(config) {
  const wb = buildConfigWorkbook(config)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Uint8Array(buf)
}

export function buildListWorkbook(records, headers) {
  const wb = XLSX.utils.book_new()
  const ws = objectsToSheet(records, headers)
  wb.SheetNames.push('records')
  wb.Sheets.records = ws
  return wb
}

export function buildListWorkbookBuffer(records, headers) {
  const wb = buildListWorkbook(records, headers)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Uint8Array(buf)
}
