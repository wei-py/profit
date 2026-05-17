import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeProductId } from "@/domain/product-records";
import { readListWorkbook } from "@/services/list-excel-reader";
import { buildListWorkbookBuffer } from "@/services/list-excel-writer";

let uidCounter = 0;
function genUid() {
  uidCounter += 1;
  return uidCounter;
}

export const useListStore = defineStore("list", () => {
  const filePath = ref("");
  const records = ref([]);
  const columnOrder = ref([]);
  const hiddenColumns = ref([]);
  const loading = ref(false);
  const error = ref("");

  async function loadFromBuffer(buffer, p) {
    loading.value = true;
    error.value = "";
    if (p)
      filePath.value = p;
    try {
      const { columnOrder: order, hiddenColumns: hidden, records: rows } = await readListWorkbook(buffer);
      records.value = withUids(rows);
      columnOrder.value = order || [];
      hiddenColumns.value = hidden || [];
      syncColumnOrder();
    }
    catch (e) {
      error.value = e.message;
      throw e;
    }
    finally {
      loading.value = false;
    }
  }

  async function getExportBuffer() {
    syncColumnOrder();
    return await buildListWorkbookBuffer(records.value, columnOrder.value, hiddenColumns.value);
  }

  function withUids(rows) {
    return (rows || []).map(row => ({ ...row, _uid: genUid() }));
  }

  function addRecords(skuRows) {
    records.value.push(...withUids(skuRows));
    syncColumnOrder();
  }

  function replaceRecordsByProductId(productId, skuRows) {
    const target = normalizeProductId(productId);
    if (!target) {
      addRecords(skuRows);
      return;
    }

    const firstIndex = records.value.findIndex(row => normalizeProductId(row.商品ID) === target);
    if (firstIndex < 0) {
      addRecords(skuRows);
      return;
    }

    const nextRows = withUids(skuRows);
    records.value = [
      ...records.value.slice(0, firstIndex),
      ...nextRows,
      ...records.value.slice(firstIndex).filter(row => normalizeProductId(row.商品ID) !== target),
    ];
    syncColumnOrder();
  }

  function removeRecord(index) {
    records.value.splice(index, 1);
    syncColumnOrder();
  }

  function moveRecordToTop(index) {
    if (index <= 0)
      return;
    const [moved] = records.value.splice(index, 1);
    records.value.unshift(moved);
  }

  function moveRecordToBottom(index) {
    if (index >= records.value.length - 1)
      return;
    const [moved] = records.value.splice(index, 1);
    records.value.push(moved);
  }

  function updateRecord(index, data) {
    records.value[index] = { ...records.value[index], ...data };
    syncColumnOrder();
  }

  function syncColumnOrder() {
    if (!records.value.length) {
      columnOrder.value = [];
      hiddenColumns.value = [];
      return;
    }

    const allKeys = new Set();
    for (const row of records.value) {
      for (const key of Object.keys(row || {})) {
        if (key !== "_uid")
          allKeys.add(key);
      }
    }

    const existing = new Set(columnOrder.value);
    const merged = columnOrder.value.filter(key => allKeys.has(key));
    for (const key of allKeys) {
      if (!existing.has(key))
        merged.push(key);
    }
    columnOrder.value = merged;
    hiddenColumns.value = hiddenColumns.value.filter(key => allKeys.has(key));
  }

  function clear() {
    filePath.value = "";
    records.value = [];
    columnOrder.value = [];
    hiddenColumns.value = [];
    error.value = "";
  }

  return {
    addRecords,
    clear,
    columnOrder,
    error,
    filePath,
    getExportBuffer,
    hiddenColumns,
    loadFromBuffer,
    loading,
    moveRecordToBottom,
    moveRecordToTop,
    records,
    removeRecord,
    replaceRecordsByProductId,
    syncColumnOrder,
    updateRecord,
  };
});
