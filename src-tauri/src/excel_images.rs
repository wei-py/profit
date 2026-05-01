use base64::Engine;
use std::{
    collections::HashMap,
    io::{Cursor, Read},
};
use zip::ZipArchive;

const REL_NS: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

pub fn extract_images_base64(bytes: &[u8]) -> Result<Vec<serde_json::Value>, String> {
    let images = extract_images_from_xlsx_bytes(bytes)?;
    Ok(images
        .into_iter()
        .map(|img| {
            let mime = if img.bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                "image/png"
            } else if img.bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
                "image/jpeg"
            } else if img.bytes.starts_with(&[0x47, 0x49, 0x46]) {
                "image/gif"
            } else {
                "image/png"
            };
            let b64 = base64::engine::general_purpose::STANDARD.encode(&img.bytes);
            serde_json::json!({
                "row": img.row_index as usize + 1,
                "col": img.column_index as usize,
                "base64": format!("data:{};base64,{}", mime, b64),
            })
        })
        .collect())
}

#[derive(Debug)]
struct ExtractedExcelImage {
    row_index: u32,
    column_index: u32,
    bytes: Vec<u8>,
}

#[derive(Debug)]
struct WorkbookSheetRef {
    path: String,
}

fn extract_images_from_xlsx_bytes(bytes: &[u8]) -> Result<Vec<ExtractedExcelImage>, String> {
    let files = read_zip_entries(bytes)?;
    let workbook_xml = read_utf8_file(&files, "xl/workbook.xml")?;
    let workbook_rels = read_optional_utf8_file(&files, "xl/_rels/workbook.xml.rels")?
        .map(|xml| parse_relationships(&xml))
        .transpose()?
        .unwrap_or_default();

    // 优先尝试 WPS cellimages.xml（嵌入单元格图片）
    if files.contains_key("xl/cellimages.xml") {
        let wps = extract_wps_cell_images(&files);
        if let Ok(imgs) = wps {
            if !imgs.is_empty() { return Ok(imgs); }
        }
    }

    let sheets = parse_workbook_sheets(&workbook_xml, &workbook_rels)?;
    let mut extracted_images = Vec::new();
    for sheet in sheets {
        extracted_images.extend(extract_images_for_sheet(&files, &sheet)?);
    }
    Ok(extracted_images)
}

/// WPS 嵌入单元格图片：cellimages.xml + DISPIMG 公式
fn extract_wps_cell_images(files: &HashMap<String, Vec<u8>>) -> Result<Vec<ExtractedExcelImage>, String> {
    let cellimages_xml = match files.get("xl/cellimages.xml") {
        Some(x) => String::from_utf8_lossy(x).into_owned(),
        None => return Ok(Vec::new()),
    };
    let ci_doc = roxmltree::Document::parse(&cellimages_xml).map_err(|e| e.to_string())?;
    let ci_rels = read_optional_utf8_file(files, "xl/_rels/cellimages.xml.rels")?
        .map(|x| parse_relationships(&x)).transpose()?.unwrap_or_default();

    // 解析 cellimages: ID → (embed_id, media_path)
    let mut img_map: HashMap<String, String> = HashMap::new();
    for ci in ci_doc.descendants().filter(|n| n.has_tag_name("cellImage")) {
        let name = ci.descendants()
            .find(|n| n.has_tag_name("cNvPr"))
            .and_then(|n| n.attribute("name"))
            .unwrap_or("");
        let embed = ci.descendants()
            .find(|n| n.has_tag_name("blip"))
            .and_then(|b| b.attributes().find(|a| a.name() == "embed"))
            .map(|a| a.value().to_string());
        if let Some(ref embed_id) = embed {
            if let Some(target) = ci_rels.get(embed_id.as_str()) {
                img_map.insert(name.to_string(), target.clone());
            }
        }
    }

    if img_map.is_empty() { return Ok(Vec::new()); }

    // 解析 sharedStrings，找到 DISPIMG 公式 → ID → 图片
    let sst = read_optional_utf8_file(files, "xl/sharedStrings.xml")?.unwrap_or_default();
    let sst_vals: Vec<String> = extract_shared_strings(&sst);

    // 解析 sheet1.xml 找 DISPIMG
    let sheet_xml = read_utf8_file(files, "xl/worksheets/sheet1.xml")?;
    let s_doc = roxmltree::Document::parse(&sheet_xml).map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    for row in s_doc.descendants().filter(|n| n.has_tag_name("row")) {
        let row_num: u32 = row.attribute("r").and_then(|r| r.parse().ok()).unwrap_or(0);
        for c in row.children().filter(|n| n.has_tag_name("c")) {
            let ref_str = c.attribute("r").unwrap_or("");
            let col_letter: String = ref_str.chars().filter(|ch| ch.is_alphabetic()).collect();
            let col_num = col_letter_to_num(&col_letter);
            let t = c.attribute("t").unwrap_or("");
            let v = c.children().find(|n| n.has_tag_name("v"))
                .and_then(|n| n.text().and_then(|t| t.parse::<usize>().ok()));

            if t == "str" {
                // inline string
                let val = c.children().find(|n| n.has_tag_name("t")).map(|n| n.text().unwrap_or("")).unwrap_or("");
                if let Some(id) = extract_dispimg_id(val) {
                    if let Some(target) = img_map.get(&id) {
                        let mp = format!("xl/{}", target);
                        if let Some(bytes) = files.get(&mp) {
                            results.push(ExtractedExcelImage { row_index: row_num.saturating_sub(1), column_index: col_num, bytes: bytes.clone() });
                        }
                    }
                }
            } else if t == "s" {
                // shared string
                if let Some(idx) = v {
                    if let Some(val) = sst_vals.get(idx) {
                        if let Some(id) = extract_dispimg_id(val) {
                            if let Some(target) = img_map.get(&id) {
                                let mp = format!("xl/{}", target);
                                if let Some(bytes) = files.get(&mp) {
                                    results.push(ExtractedExcelImage { row_index: row_num.saturating_sub(1), column_index: col_num, bytes: bytes.clone() });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

fn extract_dispimg_id(val: &str) -> Option<String> {
    if !val.starts_with("=DISPIMG(") { return None; }
    let start = val.find('"')? + 1;
    let end = val[start..].find('"')?;
    Some(val[start..start+end].to_string())
}

fn extract_shared_strings(xml: &str) -> Vec<String> {
    let doc = match roxmltree::Document::parse(xml) { Ok(d) => d, Err(_) => return vec![] };
    doc.descendants().filter(|n| n.has_tag_name("t")).map(|n| n.text().unwrap_or("").to_string()).collect()
}

fn col_letter_to_num(col: &str) -> u32 {
    let mut n = 0u32;
    for ch in col.chars() {
        n = n * 26 + (ch as u32 - 'A' as u32 + 1);
    }
    n.saturating_sub(1)
}

fn read_zip_entries(bytes: &[u8]) -> Result<HashMap<String, Vec<u8>>, String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let mut files = HashMap::new();

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
        if entry.is_dir() { continue; }
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        files.insert(normalize_zip_path(entry.name()), buf);
    }

    Ok(files)
}

fn read_utf8_file(files: &HashMap<String, Vec<u8>>, path: &str) -> Result<String, String> {
    let np = normalize_zip_path(path);
    files.get(&np)
        .map(|b| String::from_utf8_lossy(b).into_owned())
        .ok_or_else(|| format!("缺少: {}", np))
}

fn read_optional_utf8_file(files: &HashMap<String, Vec<u8>>, path: &str) -> Result<Option<String>, String> {
    let np = normalize_zip_path(path);
    Ok(files.get(&np).map(|b| String::from_utf8_lossy(b).into_owned()))
}

fn parse_relationships(xml: &str) -> Result<HashMap<String, String>, String> {
    let doc = roxmltree::Document::parse(xml).map_err(|e| e.to_string())?;
    let mut rels = HashMap::new();
    for node in doc.descendants().filter(|n| n.has_tag_name("Relationship")) {
        if let (Some(id), Some(target)) = (node.attribute("Id"), node.attribute("Target")) {
            rels.insert(id.to_string(), target.to_string());
        }
    }
    Ok(rels)
}

fn parse_workbook_sheets(xml: &str, rels: &HashMap<String, String>) -> Result<Vec<WorkbookSheetRef>, String> {
    let doc = roxmltree::Document::parse(xml).map_err(|e| e.to_string())?;
    let mut sheets = Vec::new();
    for node in doc.descendants().filter(|n| n.has_tag_name("sheet")) {
        if node.attribute("name").is_none() { continue }
        let Some(r_id) = get_relationship_id(node) else { continue };
        let Some(target) = rels.get(&r_id) else { continue };
        sheets.push(WorkbookSheetRef { path: resolve_zip_path("xl/workbook.xml", target) });
    }
    Ok(sheets)
}

fn extract_images_for_sheet(files: &HashMap<String, Vec<u8>>, sheet: &WorkbookSheetRef) -> Result<Vec<ExtractedExcelImage>, String> {
    let sheet_xml = read_utf8_file(files, &sheet.path)?;
    let doc = roxmltree::Document::parse(&sheet_xml).map_err(|e| e.to_string())?;
    let rels = read_optional_utf8_file(files, &relationship_path_for(&sheet.path))?
        .map(|x| parse_relationships(&x)).transpose()?.unwrap_or_default();
    let mut imgs = Vec::new();

    for dn in doc.descendants().filter(|n| n.has_tag_name("drawing")) {
        let Some(r_id) = get_relationship_id(dn) else { continue };
        let Some(target) = rels.get(&r_id) else { continue };
        let dp = resolve_zip_path(&sheet.path, target);
        imgs.extend(extract_images_for_drawing(files, &dp)?);
    }

    Ok(imgs)
}

fn extract_images_for_drawing(files: &HashMap<String, Vec<u8>>, drawing_path: &str) -> Result<Vec<ExtractedExcelImage>, String> {
    let xml = read_utf8_file(files, drawing_path)?;
    let doc = roxmltree::Document::parse(&xml).map_err(|e| e.to_string())?;
    let rels = read_optional_utf8_file(files, &relationship_path_for(drawing_path))?
        .map(|x| parse_relationships(&x)).transpose()?.unwrap_or_default();
    let mut imgs = Vec::new();

    for anchor in doc.descendants().filter(|n| matches!(n.tag_name().name(), "oneCellAnchor" | "twoCellAnchor")) {
        let Some(from) = anchor.children().find(|n| n.has_tag_name("from")) else { continue };
        let row = read_anchor_index(from, "row").unwrap_or(0);
        let col = read_anchor_index(from, "col").unwrap_or(0);
        let Some(embed) = find_pic_embed_id(anchor) else { continue };
        let Some(target) = rels.get(&embed) else { continue };
        let sp = resolve_zip_path(drawing_path, target);
        let Some(bytes) = files.get(&sp) else { continue };

        imgs.push(ExtractedExcelImage { row_index: row, column_index: col, bytes: bytes.clone() });
    }

    Ok(imgs)
}

fn find_pic_embed_id(anchor: roxmltree::Node) -> Option<String> {
    anchor.descendants().find(|n| n.has_tag_name("blip"))
        .and_then(|b| b.attributes().find(|a| a.name() == "embed" && a.namespace() == Some(REL_NS)))
        .map(|a| a.value().to_string())
}

fn get_relationship_id(node: roxmltree::Node) -> Option<String> {
    node.attributes()
        .find(|a| a.name() == "id" && a.namespace() == Some(REL_NS))
        .map(|a| a.value().to_string())
}

fn read_anchor_index(node: roxmltree::Node, tag: &str) -> Option<u32> {
    node.children().find(|c| c.has_tag_name(tag))
        .and_then(|c| c.text())
        .and_then(|v| v.parse().ok())
}

fn relationship_path_for(path: &str) -> String {
    let np = normalize_zip_path(path);
    if let Some((dir, file)) = np.rsplit_once('/') {
        format!("{}/_rels/{}.rels", dir, file)
    } else {
        format!("_rels/{}.rels", np)
    }
}

fn resolve_zip_path(base: &str, target: &str) -> String {
    let nt = normalize_zip_path(target);
    if !nt.contains("../") && !nt.contains("./") {
        if let Some((dir, _)) = normalize_zip_path(base).rsplit_once('/') {
            return normalize_zip_path(&format!("{}/{}", dir, nt));
        }
        return nt;
    }
    let base_dir = normalize_zip_path(base).rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default();
    let mut segs: Vec<String> = if base_dir.is_empty() { vec![] } else { base_dir.split('/').map(|s| s.to_string()).collect() };
    for part in nt.split('/') {
        match part { "" | "." => {}, ".." => { segs.pop(); }, v => segs.push(v.to_string()) }
    }
    segs.join("/")
}

fn normalize_zip_path(path: &str) -> String {
    path.replace('\\', "/").trim_start_matches('/').to_string()
}
