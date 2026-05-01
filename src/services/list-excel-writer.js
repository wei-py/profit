import ExcelJS from 'exceljs'

/**
 * 将商品记录写入 Excel，图片嵌入到单元格中（WPS 兼容）。
 * @param {object[]} records - 展平 SKU 行
 * @returns {Promise<Uint8Array>}
 */
export async function buildListWorkbookBuffer(records) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('商品记录')

  if (!records.length) {
    ws.addRow([])
    return wb.xlsx.writeBuffer()
  }

  // 收集所有列（保持顺序）
  const cols = []
  const seen = new Set()
  for (const row of records) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) { seen.add(k); cols.push(k) }
    }
  }

  // 写表头
  const headerRow = ws.addRow(cols)
  headerRow.font = { bold: true }

  // 写数据行 + 嵌入图片
  const imgColIdx = cols.indexOf('图片') + 1 // 1-based for exceljs

  for (const record of records) {
    const row = ws.addRow(cols.map(c => record[c] ?? ''))
    row.commit() // commit row so we can get row number

    // 嵌入图片到单元格
    if (imgColIdx > 0) {
      const imgSrc = record['图片']
      if (imgSrc && typeof imgSrc === 'string' && imgSrc.startsWith('data:image/')) {
        try {
          const imgId = wb.addImage({ base64: imgSrc.split(',')[1], extension: getExt(imgSrc) })
          row.height = 70
          const col = imgColIdx - 1
          // twoCell 锚定：图片填充整个单元格
          ws.addImage(imgId, {
            tl: { col: col + 0.05, row: row.number - 1 + 0.05 },
            br: { col: col + 0.95, row: row.number - 0.05 },
            editAs: 'oneCell',
          })
          // 清除单元格文本，避免 base64 字符串显示
          const cell = row.getCell(imgColIdx)
          cell.value = ''
        }
        catch { /* skip broken images */ }
      }
    }
  }

  // 列宽
  ws.columns.forEach((col, i) => {
    col.width = i === imgColIdx - 1 ? 10 : Math.max(8, Math.min(20, String(cols[i] || '').length * 2 + 4))
  })

  return new Uint8Array(await wb.xlsx.writeBuffer())
}

function getExt(src) {
  if (src.startsWith('data:image/png')) return 'png'
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) return 'jpeg'
  if (src.startsWith('data:image/gif')) return 'gif'
  if (src.startsWith('data:image/webp')) return 'webp'
  return 'png'
}
