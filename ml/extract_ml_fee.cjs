(() => {
  let webpackRequire;
  self.webpackChunkant_design_pro.push([
    [Math.random()],
    {},
    (req) => {
      webpackRequire = req;
    },
  ]);
  if (!webpackRequire) {
    console.error("webpackRequire not found");
    return;
  }
  const findStore = () => {
    const cache = webpackRequire.c || webpackRequire.cache;
    if (cache) {
      const found = Object.values(cache)
        .map(m => m && m.exports)
        .find((exports) => {
          return exports
            && exports.SY
            && exports.lz
            && typeof exports.lz.getSiteInfoFee === "function";
        });
      if (found)
        return found;
    }
    if (webpackRequire.m) {
      for (const id of Object.keys(webpackRequire.m)) {
        try {
          const exports = webpackRequire(id);
          if (
            exports
            && exports.SY
            && exports.lz
            && typeof exports.lz.getSiteInfoFee === "function"
          ) {
            return exports;
          }
        }
        catch (err) {
          console.error(err);
        }
      }
    }
    return null;
  };

  const store = findStore();
  if (!store) {
    console.error("store module not found");
    return;
  }
  const siteId = store.SY.site.siteId;
  ["cat_sale_0", "cat_sale_1"].forEach((key) => {
    const data = store.lz.getSiteInfoFee(siteId, key);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${siteId}_${key}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
})();
