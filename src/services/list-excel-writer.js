import ExcelJS from "exceljs";
import JSZip from "jszip";

/** 写入 Excel，图片真正嵌入单元格（WPS DISPIMG 兼容）。 先用 ExcelJS 生成 xlsx，再用 JSZip 注入 cellimages.xml。 */
export async function buildListWorkbookBuffer(records, columnOrder) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("商品记录");

  if (!records.length) {
    ws.addRow([]);
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }

  const allKeys = [...new Set(records.flatMap(r => Object.keys(r)))].filter(
    k => k !== "图片路径" && k !== "_uid",
  );
  let cols;
  if (columnOrder && columnOrder.length) {
    const ordered = columnOrder.filter(
      k => allKeys.includes(k) && k !== "图片路径" && k !== "_uid",
    );
    const remaining = allKeys.filter(k => !ordered.includes(k));
    cols = [...ordered, ...remaining];
  }
  else {
    cols = allKeys;
  }
  const imgColIdx = cols.indexOf("图片") + 1;
  const imgColLetter = colNumToLetter(imgColIdx - 1);

  const centerAlign = { horizontal: "center", vertical: "middle" };

  const header = ws.addRow(cols);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.alignment = centerAlign;
  });

  const cellImages = [];
  for (let ri = 0; ri < records.length; ri++) {
    const record = records[ri];
    const row = ws.addRow(cols.map(c => record[c] ?? ""));
    row.eachCell((cell) => {
      cell.alignment = centerAlign;
    });
    row.commit();

    const imgSrc = record["图片"];
    if (imgSrc && typeof imgSrc === "string" && imgSrc.startsWith("data:image/")) {
      cellImages.push({
        base64: imgSrc.split(",")[1],
        cellRef: `${imgColLetter}${ri + 2}`,
        col: imgColIdx,
        ext: imgSrc.includes("image/png") ? "png" : "jpeg",
        row: ri + 2,
      });
      row.getCell(imgColIdx).value = "";
    }
  }

  const MIN_W = 8;
  const MAX_W = 30;
  const PAD = 2;
  ws.columns.forEach((col, i) => {
    if (i === imgColIdx - 1) {
      col.width = 16;
      return;
    }
    let maxW = displayWidth(cols[i] || "");
    for (const record of records) {
      const val = record[cols[i]];
      if (val != null)
        maxW = Math.max(maxW, displayWidth(String(val)));
    }
    col.width = Math.max(MIN_W, Math.min(MAX_W, maxW + PAD));
  });
  for (const ci of cellImages) {
    ws.getRow(ci.row).height = 90;
  }

  const xlsxBuf = new Uint8Array(await wb.xlsx.writeBuffer());

  // 2. 如果没有图片，直接返回
  if (!cellImages.length)
    return xlsxBuf;

  // 3. JSZip 注入 cellimages.xml
  const zip = await JSZip.loadAsync(xlsxBuf);

  // 生成唯一图片 ID（每张图独立的 rId 和文件名）
  const imageIds = cellImages.map((ci, idx) => ({
    ...ci,
    fileName: `image${idx + 1}.${ci.ext}`,
    id: `ID_${generateHex32()}`,
    rId: `rId${idx + 1}`,
  }));

  // 构建 cellimages.xml
  let ciXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
  ciXml
    += "<etc:cellImages xmlns:xdr=\"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:etc=\"http://www.wps.cn/officeDocument/2017/etCustomData\">\n";

  for (const ci of imageIds) {
    ciXml += `<etc:cellImage><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="${ci.id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${ci.rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="500000" cy="500000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic></etc:cellImage>\n`;
  }
  ciXml += "</etc:cellImages>";

  zip.file("xl/cellimages.xml", ciXml);

  // 构建 cellimages.xml.rels（每张图一条 Relationship）
  let ciRels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";
  ciRels
    += "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n";
  for (const ci of imageIds) {
    ciRels += `<Relationship Id="${ci.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${ci.fileName}"/>\n`;
  }
  ciRels += "</Relationships>";
  zip.file("xl/_rels/cellimages.xml.rels", ciRels);

  // 添加图片文件到 media（每张图独立文件）
  for (const ci of imageIds) {
    const bytes = Uint8Array.from(atob(ci.base64), c => c.charCodeAt(0));
    zip.file(`xl/media/${ci.fileName}`, bytes);
  }

  // 更新 workbook.xml.rels — 添加 cellimages 引用
  const wbRelsXml = await zip.file("xl/_rels/workbook.xml.rels").async("text");
  const updatedRels = wbRelsXml.replace(
    "</Relationships>",
    "<Relationship Id=\"rId99\" Type=\"http://www.wps.cn/officeDocument/2020/cellImage\" Target=\"cellimages.xml\"/></Relationships>",
  );
  zip.file("xl/_rels/workbook.xml.rels", updatedRels);

  // 更新 sheet1.xml — 将图片列单元格值替换为 DISPIMG 公式
  const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("text");

  let updatedSheet = sheetXml;
  for (const ci of imageIds) {
    // 替换空单元格为 DISPIMG 公式
    // 匹配: <c r="V2"><v></v></c> 或 <c r="V2"/>
    const cellPattern = new RegExp(`<c r="${ci.cellRef}"[^>]*>([\\s\\S]*?)</c>`);
    const replacement = `<c r="${ci.cellRef}" t="str"><f>_xlfn.DISPIMG(&quot;${ci.id}&quot;,1)</f><v>=DISPIMG(&quot;${ci.id}&quot;,1)</v></c>`;
    updatedSheet = updatedSheet.replace(cellPattern, replacement);
  }
  zip.file("xl/worksheets/sheet1.xml", updatedSheet);

  // 更新 [Content_Types].xml — 添加 cellimages 扩展
  const ctXml = await zip.file("[Content_Types].xml").async("text");
  if (!ctXml.includes("cellimages.xml")) {
    const updatedCt = ctXml.replace(
      "</Types>",
      "<Override PartName=\"/xl/cellimages.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet+xml\"/></Types>",
    );
    zip.file("[Content_Types].xml", updatedCt);
  }

  const out = await zip.generateAsync({ type: "uint8array" });
  return out;
}

function colNumToLetter(n) {
  let s = "";
  n++;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function generateHex32() {
  const chars = "0123456789ABCDEF";
  let s = "";
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function displayWidth(str) {
  if (!str) return 0;
  let w = 0;
  for (const ch of str) {
    w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1;
  }
  return w;
}
