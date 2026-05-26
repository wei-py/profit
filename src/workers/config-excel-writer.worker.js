import { dedupeOptionConfigs } from "../domain/option-config-dedupe";
import { buildWorkbookBuffer } from "../services/excel-writer";

globalThis.onmessage = async (event) => {
  try {
    const { config } = event.data || {};
    const dedupedConfig = {
      ...config,
      选项配置: dedupeOptionConfigs(config.选项配置 || []),
    };
    const buffer = await buildWorkbookBuffer(dedupedConfig);

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
