(() => {
  "use strict";

  const hub = window.GiteeModelAdapters;
  if (!hub) throw new Error("GiteeModelAdapters is not initialized");

  const COMMON_SIZES = [
    "1:1 (1024x1024)", "3:4 (768x1024)", "4:3 (1024x768)",
    "16:9 (1024x576)", "9:16 (576x1024)"
  ];
  const Z_SIZES = [
    "1:1 (2048x2048)", "1:1 (1024x1024)", "3:4 (768x1024)",
    "4:3 (1024x768)", "16:9 (1024x576)", "9:16 (576x1024)"
  ];
  const QWEN_SIZES = [
    "1:1 (1328x1328)", "16:9 (1664x928)", "9:16 (928x1664)",
    "4:3 (1472x1104)", "3:4 (1104x1472)", "3:2 (1584x1056)", "2:3 (1056x1584)"
  ];
  const QWEN_BUCKETS = [
    { ratio: 1, width: 1328, height: 1328 },
    { ratio: 16 / 9, width: 1664, height: 928 },
    { ratio: 9 / 16, width: 928, height: 1664 },
    { ratio: 4 / 3, width: 1472, height: 1104 },
    { ratio: 3 / 4, width: 1104, height: 1472 },
    { ratio: 3 / 2, width: 1584, height: 1056 },
    { ratio: 2 / 3, width: 1056, height: 1584 }
  ];

  function splitSize(size) {
    const m = String(size || "").match(/(\d+)[x*](\d+)/i);
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
  }
  function unique(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function nearestBucket(parsed) {
    if (!parsed?.width || !parsed?.height) return QWEN_BUCKETS[0];
    const ratio = parsed.width / parsed.height;
    return QWEN_BUCKETS.reduce((best, item) => Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best, QWEN_BUCKETS[0]);
  }

  hub.register("qwen-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: { sizes: QWEN_SIZES, note: "自动使用 Qwen 原生分辨率桶，并转换为 1328*1328 / 1664*928 等格式" },
    jsonVariants(body) {
      const bucket = nearestBucket(splitSize(body.size));
      const nativeSize = { ...body, size: `${bucket.width}*${bucket.height}` };
      const noN = { ...nativeSize }; delete noN.n;
      const widthHeight = { ...noN, width: bucket.width, height: bucket.height }; delete widthHeight.size;
      const defaultSize = { ...noN }; delete defaultSize.size;
      return unique([nativeSize, noN, widthHeight, defaultSize]);
    }
  });

  hub.register("z-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: true,
    ui: { sizes: Z_SIZES, note: "沿用已验证的 OpenAI 风格 size=1024x1024" },
    jsonVariants(body) { return [{ ...body }]; }
  });

  hub.register("generic-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: { sizes: COMMON_SIZES, note: "先用标准 size，参数不兼容时自动尝试精简/宽高格式" },
    jsonVariants(body) {
      const parsed = splitSize(body.size);
      const noN = { ...body }; delete noN.n;
      const variants = [{ ...body }, noN];
      if (parsed) {
        variants.push({ ...noN, size: `${parsed.width}*${parsed.height}` });
        const widthHeight = { ...noN, width: parsed.width, height: parsed.height }; delete widthHeight.size;
        variants.push(widthHeight);
      }
      return unique(variants);
    }
  });

  hub.register("qwen-edit", { task: "edit", defaultEndpoint: "async/images/edits", uiProfile: "qwen" });
  hub.register("generic-edit", { task: "edit", defaultEndpoint: "async/images/edits", uiProfile: "standard" });
})();
