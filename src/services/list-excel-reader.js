import ExcelJS from 'exceljs'
import JSZip from 'jszip'

export async function readListWorkbook(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const files = {}
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir)
      files[name] = entry
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.getWorksheet('商品记录')
  if (!ws)
    return { records: [], columnOrder: [] }

  const hRow = ws.getRow(1)
  const colN = ws.columnCount || hRow.cellCount || 0
  const headers = []
  for (let c = 1; c <= colN; c++) headers.push(String(hRow.getCell(c).value ?? ''))

  const columnOrder = headers.filter(h => h)

  // JSZip 解析 WPS cellimages.xml → 提取嵌入图片（DISPIMG）
  const wps = await extractWpsImages(files)

  // ExcelJS 浮动画片（标准格式，兜底）
  const imgs = ws.getImages()
  for (const img of imgs) {
    try {
      const tl = img.range?.tl || img.tl
      const r = Math.round(tl?.nativeRow ?? 0) + 1
      const c = Math.round(tl?.nativeCol ?? 0) + 1
      const key = `${r}-${c}`
      if (!wps[key] && img.imageId !== undefined) {
        const obj = wb.getImage(img.imageId)
        if (obj?.buffer) {
          const ext = obj.extension || 'png'
          wps[key] = `data:image/${ext};base64,${Buffer.from(obj.buffer).toString('base64')}`
        }
      }
    }
    catch {}
  }

  // 构建记录
  const rows = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const rec = {}
    for (let c = 1; c <= colN; c++) {
      let val = ws.getRow(r).getCell(c).value ?? ''
      if (val && typeof val === 'object') {
        if (val.richText)
          val = val.richText.map(t => t.text).join('')
        else if (val.text)
          val = val.text
        else val = String(val.result ?? val)
      }
      const key = `${r}-${c}`
      if (wps[key])
        val = wps[key]
      rec[headers[c - 1] || `col_${c}`] = String(val ?? '')
    }
    if (Object.values(rec).some(v => v))
      rows.push(rec)
  }
  return { records: rows, columnOrder }
}

/** 用正则解析 cellimages.xml 提取 WPS 嵌入图片 */
async function extractWpsImages(files) {
  const map = {}
  const ciEntry = files['xl/cellimages.xml']
  if (!ciEntry)
    return map

  try {
    const ciXml = await ciEntry.async('text')
    const ciRelsXml = files['xl/_rels/cellimages.xml.rels']
      ? await files['xl/_rels/cellimages.xml.rels'].async('text')
      : ''

    // rId → media/file path
    const rid2file = {}
    let m
    const relRe = /<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"/g
    while ((m = relRe.exec(ciRelsXml))) rid2file[m[1]] = m[2]

    // image name (DISPIMG ID) → rId
    const name2rid = {}
    const blocks = ciXml.split(/<\/etc:cellImage>/)
    for (const b of blocks) {
      const nm = b.match(/name="([^"]*)"/)
      const em = b.match(/embed="([^"]*)"/)
      if (nm && em)
        name2rid[nm[1]] = em[1]
    }

    // name → media file
    const name2file = {}
    for (const [rid, file] of Object.entries(rid2file)) {
      for (const [name, embed] of Object.entries(name2rid)) {
        if (embed === rid)
          name2file[name] = `xl/${file}`
      }
    }
    if (!Object.keys(name2file).length)
      return map

    // 匹配 DISPIMG 单元格：<c r="V4" t="str">...<v>=DISPIMG(&quot;ID_...&quot;,1)</v></c>
    const sheetXml = files['xl/worksheets/sheet1.xml']
      ? await files['xl/worksheets/sheet1.xml'].async('text')
      : ''
    if (sheetXml) {
      const dispRe
        = /<c r="([A-Z]+)(\d+)"[^>]*>[^<]*(?:<f[^>]*>[^<]*<\/f>)?<v[^>]*>=\s*DISPIMG\s*\(\s*&quot;\s*(ID_[0-9A-F]{32})\s*&quot;/gi
      let dm
      while ((dm = dispRe.exec(sheetXml))) {
        const colN = colToNum(dm[1]) + 1 // 1-based 对齐 ExcelJS
        const rowNum = Number.parseInt(dm[2])
        const imgId = dm[3]
        if (name2file[imgId]) {
          const mp = name2file[imgId]
          const entry = files[mp] || files[mp.replace('xl/', '')]
          if (entry) {
            const bytes = await entry.async('uint8array')
            const ext = mp.endsWith('.jpg') || mp.endsWith('.jpeg') ? 'jpeg' : 'png'
            const b64 = uint8ToBase64(bytes)
            map[`${rowNum}-${colN}`] = `data:image/${ext};base64,${b64}`
          }
        }
      }
    }
  }
  catch (e) {
    console.warn('WPS extract:', e)
  }
  return map
}

function uint8ToBase64(bytes) {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function colToNum(col) {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
