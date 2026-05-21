import { buildWorkbookBuffer } from "@/services/excel-writer";

export function buildWorkbookBufferInWorker(config) {
  if (typeof Worker === "undefined")
    return buildWorkbookBuffer(config);

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/config-excel-writer.worker.js", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event) => {
      worker.terminate();

      const { buffer, error, success } = event.data || {};
      if (!success) {
        reject(new Error(error || "配置 Excel 导出失败"));
        return;
      }

      resolve(new Uint8Array(buffer));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "配置 Excel 导出失败"));
    };

    worker.postMessage({ config });
  });
}
