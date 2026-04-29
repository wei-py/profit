/**
 * 评估单个条件的匹配结果。
 * @param {{ fieldKey: string, operator: string, value: *, valueEnd: * }} condition - 条件对象
 * @param {object} userInputs - 用户输入键值对
 * @returns {boolean} 条件是否满足
 */
function evaluateCondition(condition, userInputs) {
  const { fieldKey, operator, value, valueEnd } = condition
  const inputVal = userInputs[fieldKey]

  if (inputVal === undefined || inputVal === null || inputVal === '') {
    return false
  }

  switch (operator) {
    case 'eq':
      return String(inputVal) === String(value)
    case 'neq':
      return String(inputVal) !== String(value)
    case 'gt':
      return Number(inputVal) > Number(value)
    case 'gte':
      return Number(inputVal) >= Number(value)
    case 'lt':
      return Number(inputVal) < Number(value)
    case 'lte':
      return Number(inputVal) <= Number(value)
    case 'between': {
      const n = Number(inputVal)
      return n >= Number(value) && n <= Number(valueEnd)
    }
    case 'in': {
      const list = typeof value === 'string' ? value.split(',').map(s => s.trim()) : (Array.isArray(value) ? value : [value])
      return list.some(item => String(inputVal) === String(item))
    }
    case 'not_in': {
      const list = typeof value === 'string' ? value.split(',').map(s => s.trim()) : (Array.isArray(value) ? value : [value])
      return !list.some(item => String(inputVal) === String(item))
    }
    default:
      return false
  }
}

/**
 * 递归评估条件组树，计算整体匹配结果。
 * @param {{ logic: string, conditions: Array, children: Array }} group - 条件组节点
 * @param {object} userInputs - 用户输入键值对
 * @returns {boolean} 条件组是否满足
 */
function evaluateGroup(group, userInputs) {
  if (!group || !group.conditions)
    return true

  const results = []

  for (const cond of group.conditions) {
    results.push(evaluateCondition(cond, userInputs))
  }

  for (const child of (group.children || [])) {
    results.push(evaluateGroup(child, userInputs))
  }

  if (results.length === 0)
    return true

  if (group.logic === 'or') {
    return results.includes(true)
  }
  return results.every(r => r === true)
}

/**
 * 判断规则是否与用户输入匹配。
 * @param {{ enabled: boolean, conditionTree: Array }} rule - 规则对象
 * @param {object} userInputs - 用户输入键值对
 * @returns {boolean} 规则是否匹配
 */
function ruleMatches(rule, userInputs) {
  if (!rule.enabled)
    return false
  if (!rule.conditionTree || rule.conditionTree.length === 0)
    return true
  return rule.conditionTree.some(tree => evaluateGroup(tree, userInputs))
}

/**
 * 根据 ID 查找对应的查找表。
 * @param {Array} lookupTables - 查找表列表
 * @param {string} tableId - 查找表 ID
 * @returns {object | undefined} 匹配的查找表
 */
function findLookupTable(lookupTables, tableId) {
  return lookupTables.find(t => t.tableId === tableId || t.tableId === String(tableId))
}

/**
 * 在查找表中执行精确匹配或区间匹配，返回输出列的值。
 * @param {{input_map: object, output_column: string, match_mode: string}} config - 查找配置
 * @param {{ rows: Array, matchMode: string }} lookupTable - 查找表对象
 * @param {object} userInputs - 用户输入键值对
 * @param {object} results - 已计算的结果键值对
 * @returns {*|null} 匹配到的值，未匹配则返回 null
 */
function performLookup(config, lookupTable, userInputs, results) {
  const { input_map: inputMap, output_column: outputColumn, match_mode: matchMode } = config
  if (!lookupTable || !lookupTable.rows || lookupTable.rows.length === 0)
    return null

  const mode = matchMode || lookupTable.matchMode || 'exact'

  for (const row of lookupTable.rows) {
    if (mode === 'exact') {
      let allMatch = true
      for (const [colKey, sourceField] of Object.entries(inputMap)) {
        const rowVal = row[colKey]
        const inputVal = sourceField in results
          ? results[sourceField]
          : sourceField in userInputs
            ? userInputs[sourceField]
            : undefined
        if (String(rowVal) !== String(inputVal)) {
          allMatch = false
          break
        }
      }
      if (allMatch)
        return row[outputColumn]
    }
    else if (mode === 'range') {
      let allInRange = true
      for (const [colPrefix, sourceField] of Object.entries(inputMap)) {
        const minKey = `${colPrefix}下限`
        const maxKey = `${colPrefix}上限`
        const inputVal = sourceField in results
          ? results[sourceField]
          : sourceField in userInputs
            ? userInputs[sourceField]
            : undefined

        if (inputVal === undefined || inputVal === null) {
          allInRange = false
          break
        }

        const n = Number(inputVal)
        const min = row[minKey] !== undefined && row[minKey] !== '' ? Number(row[minKey]) : -Infinity
        const max = row[maxKey] !== undefined && row[maxKey] !== '' ? Number(row[maxKey]) : Infinity

        if (n < min || n > max) {
          allInRange = false
          break
        }
      }
      if (allInRange)
        return row[outputColumn]
    }
  }
  return null
}

/**
 * 执行单个动作（set / lookup / branch），将结果写入 results 或错误写入 errors。
 * @param {{actionType: string, targetField: string, configJson: object, actionId: string}} action - 动作对象
 * @param {object} rule - 所属规则
 * @param {Array} allRules - 所有规则列表
 * @param {Array} lookupTables - 查找表列表
 * @param {object} userInputs - 用户输入键值对
 * @param {object} results - 计算结果输出对象
 * @param {string[]} errors - 错误信息数组
 */
function executeAction(action, rule, allRules, lookupTables, userInputs, results, errors) {
  const { actionType, targetField, configJson } = action

  try {
    switch (actionType) {
      case 'set': {
        const val = configJson.value
        results[targetField] = val
        break
      }
      case 'lookup': {
        const tableId = configJson.table_id
        const lookupTable = findLookupTable(lookupTables, tableId)
        if (!lookupTable) {
          errors.push(`动作 ${action.actionId} 未找到查找表“${tableId}”`)
          break
        }
        const val = performLookup(configJson, lookupTable, userInputs, results)
        if (val !== null && val !== undefined) {
          results[targetField] = val
        }
        else {
          errors.push(`动作 ${action.actionId} 在查找表“${tableId}”中未找到匹配行`)
        }
        break
      }
      case 'branch': {
        const { when, then: thenAction, else: elseAction } = configJson
        if (!when)
          break

        let conditionMet = false
        if (when.field) {
          conditionMet = evaluateCondition({
            fieldKey: when.field,
            operator: when.operator || 'eq',
            value: when.value,
            valueEnd: when.value_end,
          }, userInputs)
        }

        const subAction = conditionMet ? thenAction : elseAction
        if (!subAction)
          break

        if (subAction.type === 'set') {
          results[targetField] = subAction.value
        }
        else if (subAction.type === 'lookup') {
          const tableId = subAction.table_id
          const lookupTable = findLookupTable(lookupTables, tableId)
          if (!lookupTable) {
            errors.push(`分支动作 ${action.actionId} 未找到查找表“${tableId}”`)
            break
          }
          const val = performLookup(subAction, lookupTable, userInputs, results)
          if (val !== null && val !== undefined) {
            results[targetField] = val
          }
          else {
            errors.push(`分支动作 ${action.actionId} 在查找表“${tableId}”中未找到匹配行`)
          }
        }
        break
      }
      default:
        errors.push(`动作 ${action.actionId} 的动作类型“${actionType}”无效`)
    }
  }
  catch (e) {
    errors.push(`执行动作 ${action.actionId} 时出错：${e.message}`)
  }
}

/**
 * 执行规则引擎主流程：按优先级顺序匹配规则，执行动作后返回结果与错误。
 * @param {Array} fields - 字段定义列表
 * @param {Array} rules - 规则列表
 * @param {Array} lookupTables - 查找表列表
 * @param {object} userInputs - 用户输入键值对
 * @returns {{results: object, errors: string[]}} 计算结果与错误信息
 */
export function execute(fields, rules, lookupTables, userInputs) {
  const results = {}
  const errors = []

  const sortedRules = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of sortedRules) {
    if (ruleMatches(rule, userInputs)) {
      const sortedActions = [...(rule.actions || [])].sort((a, b) => a.sort - b.sort)
      for (const action of sortedActions) {
        executeAction(action, rule, sortedRules, lookupTables, userInputs, results, errors)
      }
    }
  }

  return { results, errors }
}
