/**
 * 执行费用计算。
 * @param {object[]} feeRules - 费用规则列表（已按模板过滤）
 * @param {object} lookupTables - { sheet名: 行数据[] }
 * @param {object} userInputs - { 字段键: 值 }
 * @returns {{ results: object, errors: string[] }}
 */
export function execute(feeRules, lookupTables, userInputs) {
  const results = {}
  const errors = []

  const enabled = feeRules.filter(r => r.启用 === '是' || r.启用 === 'TRUE')
  const sorted = enabled.sort((a, b) => Number(a.计算顺序) - Number(b.计算顺序))

  // 所有可用字段键（输入 + 已计算结果），公式替换时用
  const allKeys = [...new Set([
    ...Object.keys(userInputs),
    ...sorted.map(r => r.输出字段键).filter(Boolean),
  ])]

  for (const rule of sorted) {
    try {
      // 条件判断
      if (rule.条件1字段) {
        if (!matches(getVal(rule.条件1字段, userInputs, results), rule.条件1运算符, rule.条件1值, rule.条件1值2)) {
          continue
        }
      }
      if (rule.条件2字段) {
        if (!matches(getVal(rule.条件2字段, userInputs, results), rule.条件2运算符, rule.条件2值, rule.条件2值2)) {
          continue
        }
      }

      const key = rule.输出字段键
      if (!key) continue

      switch (rule.计算方式) {
        case '查表':
          results[key] = doLookup(rule, lookupTables, userInputs, results)
          break
        case '百分比':
          results[key] = doPercent(rule, userInputs, results)
          break
        case '固定值':
          results[key] = Number(rule.固定金额) || 0
          break
        case '加总':
          results[key] = doSum(rule, userInputs, results)
          break
        case '公式':
          results[key] = doFormula(rule, userInputs, results, allKeys)
          break
      }
    }
    catch (e) {
      errors.push(`[${rule.编号}] ${e.message}`)
    }
  }

  return { results, errors }
}

// ── helpers ──

function getVal(fieldKey, inputs, results) {
  if (results[fieldKey] !== undefined && results[fieldKey] !== null) return results[fieldKey]
  return inputs[fieldKey]
}

function matches(val, op, target, target2) {
  const sVal = String(val ?? '')
  const sTgt = String(target ?? '')
  const nVal = Number(val)
  const nTgt = Number(target)
  switch (op) {
    case '等于': return sVal === sTgt
    case '不等于': return sVal !== sTgt
    case '大于': return nVal > nTgt
    case '大于等于': return nVal >= nTgt
    case '小于': return nVal < nTgt
    case '小于等于': return nVal <= nTgt
    default: return false
  }
}

function doLookup(rule, lookupTables, inputs, results) {
  const table = lookupTables[rule.查表名称]
  if (!table || !table.length) throw new Error(`费率表「${rule.查表名称}」不存在或为空`)

  const mappings = parseMappings(rule.输入映射)
  const isRange = rule.匹配方式 === '区间'

  for (const row of table) {
    let ok = true
    for (const [fieldKey, colName] of mappings) {
      const inputVal = getVal(fieldKey, inputs, results)
      if (isRange) {
        const v = Number(inputVal)
        const lo = Number(row[colName + '下限'])
        const hi = Number(row[colName + '上限'])
        if (v < lo || v > hi) { ok = false; break }
      }
      else {
        if (String(inputVal) !== String(row[colName])) { ok = false; break }
      }
    }
    if (ok) return Number(row[rule.输出列]) || 0
  }
  throw new Error(`查表「${rule.查表名称}」未找到匹配行`)
}

function doPercent(rule, inputs, results) {
  const base = Number(getVal(rule.百分比基数, inputs, results)) || 0
  let rate
  if (rule.百分比来源字段) {
    rate = Number(getVal(rule.百分比来源字段, inputs, results)) || 0
  }
  else {
    rate = Number(rule.百分比值) / 100 || 0
  }
  return base * rate
}

function doSum(rule, inputs, results) {
  if (!rule.加总字段) return 0
  return rule.加总字段.split(',').reduce((s, fk) => {
    return s + (Number(getVal(fk.trim(), inputs, results)) || 0)
  }, 0)
}

function doFormula(rule, inputs, results, allKeys) {
  let expr = rule.公式
  if (!expr) return 0

  // 按字段键长度从长到短替换，避免短名误匹配
  const sorted = [...allKeys].sort((a, b) => b.length - a.length)
  for (const fk of sorted) {
    const val = Number(getVal(fk, inputs, results)) || 0
    expr = expr.replaceAll(fk, val)
  }

  // 安全校验
  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`公式含非法字符：${rule.公式}`)
  }

  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + expr + ')')()
}

function parseMappings(inputMap) {
  if (!inputMap) return []
  return inputMap.split(',').map(p => {
    const parts = p.split('=').map(s => s.trim())
    return [parts[0], parts[1]]
  }).filter(m => m[0] && m[1])
}
