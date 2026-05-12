import { useConfigStore } from "@/stores/config";
import { useListStore } from "@/stores/list";

const isTauri = () => !!(window.__TAURI_INTERNALS__ || window.__TAURI__);

export function useFileIO() {
  const configStore = useConfigStore();
  const listStore = useListStore();

  // ── Tauri 实现 ──
  async function tauriOpen(filterName, ext) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const selected = await open({
      filters: [
        {
          extensions: [ext, "xls"],
          name: "Excel",
        },
      ],
      multiple: false,
      title: filterName,
    });
    if (!selected)
      return null;
    const p = typeof selected === "string" ? selected : selected.path;
    return {
      bytes: await readFile(p),
      path: p,
    };
  }
  async function tauriSave(name, ext, buffer) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const selected = await save({
      filters: [
        {
          extensions: [ext],
          name: "Excel",
        },
      ],
      title: name,
    });
    if (!selected)
      return false;
    const p = typeof selected === "string" ? selected : selected.path;
    await writeFile(p, new Uint8Array(buffer));
    return p;
  }

  // ── 浏览器实现 ──
  let browserFileHandle = null;

  async function browserOpen() {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
                  ".xlsx",
                  ".xls",
                ],
              },
              description: "Excel",
            },
          ],
        });
        browserFileHandle = handle;
        const file = await handle.getFile();
        return {
          bytes: new Uint8Array(await file.arrayBuffer()),
          path: file.name,
        };
      }
      catch (e) {
        if (e.name === "AbortError")
          return null;
      }
    }
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls";
      input.onchange = async () => {
        const file = input.files[0];
        resolve(
          file
            ? {
                bytes: new Uint8Array(await file.arrayBuffer()),
                path: file.name,
              }
            : null,
        );
      };
      input.click();
    });
  }

  async function browserSave(name, buffer) {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (browserFileHandle) {
      try {
        const w = await browserFileHandle.createWritable();
        await w.write(blob);
        await w.close();
        return true;
      }
      catch {
        browserFileHandle = null;
      }
    }
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name.includes(".xlsx") ? name : `${name}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      resolve(true);
    });
  }

  // ── 持久化路径 ──
  async function getLastPaths() {
    if (isTauri()) {
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json", { autoSave: true });
        return {
          config: (await store.get("lastConfigPath")) || "",
          list: (await store.get("lastListPath")) || "",
        };
      }
      catch {
        return {};
      }
    }
    return {
      config: localStorage.getItem("lastConfigPath") || "",
      list: localStorage.getItem("lastListPath") || "",
    };
  }
  async function saveLastPath(key, path) {
    if (isTauri()) {
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json", { autoSave: true });
        await store.set(key, path);
        await store.save();
      }
      catch {}
    }
    else {
      localStorage.setItem(key, path);
    }
  }

  // ── 公共接口 ──
  async function openConfigExcel() {
    const result = isTauri() ? await tauriOpen("打开配置 Excel", "xlsx") : await browserOpen();
    if (!result)
      return { success: false };
    await configStore.loadFromBuffer(result.bytes, result.path);
    await saveLastPath("lastConfigPath", result.path);
    return { success: true };
  }

  async function saveConfigExcel() {
    if (!configStore.loaded) {
      return {
        error: "没有已加载的配置",
        success: false,
      };
    }
    const buffer = configStore.getExportBuffer();
    if (isTauri()) {
      let path = configStore.filePath;
      if (!path) {
        const p = await tauriSave("保存配置 Excel", "xlsx", buffer);
        if (!p)
          return { success: false };
        path = p;
      }
      else {
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        await writeFile(path, new Uint8Array(buffer));
      }
      configStore.setFilePath(path);
      await saveLastPath("lastConfigPath", path);
    }
    else {
      const name = configStore.filePath || "config.xlsx";
      await browserSave(name, buffer);
      localStorage.setItem("lastConfigPath", name);
      configStore.setFilePath(name);
    }
    return { success: true };
  }

  async function openListExcel() {
    const result = isTauri() ? await tauriOpen("打开列表 Excel", "xlsx") : await browserOpen();
    if (!result)
      return false;
    await listStore.loadFromBuffer(result.bytes, result.path);
    await saveLastPath("lastListPath", result.path);
    return true;
  }

  async function saveListExcel() {
    const buffer = await listStore.getExportBuffer();
    if (isTauri()) {
      let path = listStore.filePath;
      if (!path) {
        const p = await tauriSave("保存商品列表", "xlsx", buffer);
        if (!p)
          return false;
        path = p;
      }
      else {
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        await writeFile(path, new Uint8Array(buffer));
      }
      listStore.filePath = path;
      await saveLastPath("lastListPath", path);
    }
    else {
      const name = listStore.filePath || "products.xlsx";
      await browserSave(name, buffer);
      localStorage.setItem("lastListPath", name);
      listStore.filePath = name;
    }
    return true;
  }

  async function restoreLastPath() {
    const paths = await getLastPaths();
    if (isTauri()) {
      if (paths.config) {
        try {
          const { readFile } = await import("@tauri-apps/plugin-fs");
          const bytes = await readFile(paths.config);
          await configStore.loadFromBuffer(bytes, paths.config);
        }
        catch {
          configStore.setFilePath(paths.config);
        }
      }
    }
    // Web 端不支持自动恢复，需手动打开文件
  }

  return {
    openConfigExcel,
    openListExcel,
    restoreLastPath,
    saveConfigExcel,
    saveListExcel,
  };
}
