import { buildWorkbookBuffer } from "../services/excel-writer";

globalThis.onmessage = async (event) => {
  try {
    const { config } = event.data || {};
    const buffer = await buildWorkbookBuffer(config);

    globalThis.postMessage(
      { buffer, success: true },
      [buffer.buffer],
    );
  }
  catch (e) {
    globalThis.postMessage({
      error: e?.message || "配置 Excel 导出失败",
      success: false,
    });
  }
};
