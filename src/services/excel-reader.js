import * as XLSX from 'xlsx'

const STD_SHEETS = ['国家平台', '计算字段', '选项组', '选项值', '计算模板', '费用规则']

/**
 * 解析配置工作簿 ArrayBuffer。
 * @param {ArrayBuffer} buffer
 * @returns {object} 配置对象
 */
export function readWorkbookBuffer(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  return readConfigWorkbook(wb)
}

function readConfigWorkbook(wb) {
  const names = wb.SheetNames

  for (const s of STD_SHEETS) {
    if (!names.includes(s))
      throw new Error(`配置缺少 sheet：「${s}」`)
  }

  const 国家平台ColOrder = getSheetHeaders(wb, '国家平台')

  const config = {
    国家平台: s2j(wb, '国家平台'),
    计算字段: s2j(wb, '计算字段'),
    选项组: s2j(wb, '选项组'),
    选项值: s2j(wb, '选项值'),
    计算模板: s2j(wb, '计算模板'),
    费用规则: s2j(wb, '费用规则'),
    模板参数: s2j(wb, '模板参数', true),
    lookupTables: {},
    国家平台ColOrder,
  }

  // 动态费率表：扫描费用规则中的查表名称
  const refs = new Set()
  for (const r of config['费用规则']) {
    if (r.查表名称)
      refs.add(r.查表名称)
  }
  for (const n of refs) {
    if (names.includes(n))
      config.lookupTables[n] = s2j(wb, n)
  }

  return config
}

function s2j(wb, name, optional) {
  const ws = wb.Sheets[name]
  if (!ws) {
    return optional
      ? []
      : (() => {
          throw new Error(`Sheet「${name}」不存在`)
        })()
  }
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

/**
 * @deprecated Use `list-excel-reader.js` instead — this version lacks WPS DISPIMG image
 * extraction and columnOrder support.
 */
export function readListWorkbook(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets['商品记录']
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : []
}

function getSheetHeaders(wb, name) {
  const ws = wb.Sheets[name]
  if (!ws || !ws['!ref'])
    return []
  const range = XLSX.utils.decode_range(ws['!ref'])
  const headers = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]
    headers.push(cell ? String(cell.v) : '')
  }
  return headers.filter(h => h)
}
