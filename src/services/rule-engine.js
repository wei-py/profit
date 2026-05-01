/**
 * 执行费用计算。
 * @param {object[]} feeRules
 * @param {object} lookupTables
 * @param {object} userInputs
 * @returns {{ results: object, errors: string[], traces: object }}
 */
export function execute(feeRules, lookupTables, userInputs) {
  const results = {}
  const errors = []
  const traces = {}

  const enabled = feeRules.filter(r => r.启用 === '是' || r.启用 === 'TRUE')
  const sorted = enabled.sort((a, b) => Number(a.计算顺序) - Number(b.计算顺序))

  // 所有可用字段键（输入 + 已计算结果），公式替换时用
  const allKeys = [...new Set([
    ...Object.keys(userInputs),
    ...sorted.map(r => r.输出字段键).filter(Boolean),
  ])]

  for (const rule of sorted) {
    try {
      // 条件判断 — 通过条件结构树递归求值
      if (!evalConditions(rule, userInputs, results)) continue

      const key = rule.输出字段键
      if (!key) continue

      switch (rule.计算方式) {
        case '查表': {
          const { val, trace } = doLookup(rule, lookupTables, userInputs, results)
          results[key] = val
          traces[key] = trace
          break
        }
        case '百分比': {
          const { val, trace } = doPercent(rule, userInputs, results)
          results[key] = val
          traces[key] = trace
          break
        }
        case '固定值': {
          results[key] = Number(rule.固定金额) || 0
          traces[key] = `${rule.费用名称 || key} = ${results[key]}（固定值）`
          break
        }
        case '加总': {
          const { val, trace } = doSum(rule, userInputs, results)
          results[key] = val
          traces[key] = trace
          break
        }
        case '公式': {
          const { val, trace } = doFormula(rule, userInputs, results, allKeys)
          results[key] = val
          traces[key] = trace
          break
        }
      }
    }
    catch (e) {
      errors.push(`[${rule.编号}] ${e.message}`)
    }
  }

  return { results, errors, traces }
}

// ── helpers ──

/**
 * 按条件数据求值。
 * 优先从 条件数据 JSON 读取完整树，否则从条件1-4列读取（AND）。
 */
function evalConditions(rule, inputs, results) {
  // 优先：条件数据 JSON 树
  if (rule.条件数据) {
    try {
      const d = JSON.parse(rule.条件数据)
      if (d.tree) return evalTree(d.tree, d.pool || [], inputs, results)
    } catch { /* fall through */ }
  }

  // 或：解析 条件结构
  const 结构 = (rule.条件结构 || '').trim()
  if (结构) return evalStruct(结构, rule, inputs, results)

  // 兜底：所有非空条件 AND
  for (let i = 1; i <= 4; i++) {
    const f = rule['条件' + i + '字段']
    if (!f) continue
    if (!matches(getVal(f, inputs, results), rule['条件' + i + '运算符'], rule['条件' + i + '值'], rule['条件' + i + '值2'])) {
      return false
    }
  }
  return true
}

function evalTree(node, pool, inputs, results) {
  if (node.type === 'cond') {
    const c = pool[node.idx]
    if (!c || !c.字段) return true
    return matches(getVal(c.字段, inputs, results), c.运算符, c.值, '')
  }
  // group: evaluate children with their individual connectors
  let result = null
  for (const ch of node.children) {
    const chResult = evalTree(ch, pool, inputs, results)
    if (result === null) {
      result = chResult
    } else {
      const op = ch.type === 'cond' ? (ch.op || 'AND') : (ch.linkOp || 'AND')
      result = op === 'AND' ? (result && chResult) : (result || chResult)
    }
  }
  return result === null ? true : result
}

function evalStruct(结构, rule, inputs, results) {
  const groups = 结构.split('|').map(g => g.split(',').map(s => s.trim()))
  for (const group of groups) {
    let ok = true
    for (const idx of group) {
      const i = Number(idx) + 1
      if (i < 1 || i > 4) continue
      const f = rule['条件' + i + '字段']
      if (!f) continue
      if (!matches(getVal(f, inputs, results), rule['条件' + i + '运算符'], rule['条件' + i + '值'], rule['条件' + i + '值2'])) {
        ok = false; break
      }
    }
    if (ok) return true
  }
  return false
}

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
  const condParts = []

  for (const row of table) {
    let ok = true
    for (const [fieldKey, colName] of mappings) {
      const inputVal = getVal(fieldKey, inputs, results)
      if (isRange) {
        const v = Number(inputVal)
        const lo = Number(row[colName + '下限'])
        const hi = Number(row[colName + '上限'])
        if (v < lo || v > hi) { ok = false; break }
        condParts.push(`${fieldKey}=${inputVal} ∈ [${lo}, ${hi}]`)
      }
      else {
        if (String(inputVal) !== String(row[colName])) { ok = false; break }
        condParts.push(`${fieldKey}=${inputVal}`)
      }
    }
    if (ok) {
      const val = Number(row[rule.输出列]) || 0
      const trace = `查表「${rule.查表名称}」：${condParts.join('，')} → ${rule.输出列}=${val}`
      return { val, trace }
    }
  }
  throw new Error(`查表「${rule.查表名称}」未找到匹配行`)
}

function doPercent(rule, inputs, results) {
  const base = Number(getVal(rule.百分比基数, inputs, results)) || 0
  let rate, rateDesc
  if (rule.百分比来源字段) {
    rate = Number(getVal(rule.百分比来源字段, inputs, results)) || 0
    rateDesc = `${rule.百分比来源字段}(${rate})`
  } else {
    rate = Number(rule.百分比值) / 100 || 0
    rateDesc = `${rule.百分比值}%`
  }
  const val = base * rate
  const trace = `${rule.百分比基数}(${base}) × ${rateDesc} = ${val.toFixed(2)}`
  return { val, trace }
}

function doSum(rule, inputs, results) {
  if (!rule.加总字段) return { val: 0, trace: '' }
  const fields = rule.加总字段.split(',').map(s => s.trim())
  const parts = []
  let total = 0
  for (const fk of fields) {
    const v = Number(getVal(fk, inputs, results)) || 0
    parts.push(`${fk}(${v.toFixed(2)})`)
    total += v
  }
  const trace = `加总：${parts.join(' + ')} = ${total.toFixed(2)}`
  return { val: total, trace }
}

function doFormula(rule, inputs, results, allKeys) {
  let expr = rule.公式
  if (!expr) return { val: 0, trace: '' }
  const traceParts = []

  const sorted = [...allKeys].sort((a, b) => b.length - a.length)
  for (const fk of sorted) {
    const val = Number(getVal(fk, inputs, results)) || 0
    if (expr.includes(fk)) {
      traceParts.push(`${fk}=${val}`)
      expr = expr.replaceAll(fk, val)
    }
  }

  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`公式含非法字符：${rule.公式}`)
  }

  // eslint-disable-next-line no-new-func
  const val = Function('"use strict"; return (' + expr + ')')()
  const trace = `公式「${rule.公式}」：${traceParts.join('，')} → ${Number(val).toFixed(4)}`
  return { val, trace }
}

function parseMappings(inputMap) {
  if (!inputMap) return []
  return inputMap.split(',').map(p => {
    const parts = p.split('=').map(s => s.trim())
    return [parts[0], parts[1]]
  }).filter(m => m[0] && m[1])
}
