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
    parameters: [
      { key: "size", label: "分辨率 Resolution", type: "select", sourceId: "zRes", options: QWEN_SIZES, help: "Qwen 使用原生尺寸桶；实际请求会自动转换为模型接受的格式。" }
    ],
    jsonVariants(body) {
      const bucket = nearestBucket(splitSize(body.size));
      const nativeSize = { ...body, size: `${bucket.width}*${bucket.height}` };
      const noN = { ...nativeSize }; delete noN.n;
      const widthHeight = { ...noN, width: bucket.width, height: bucket.height }; delete widthHeight.size;
      const defaultSize = { ...noN }; delete defaultSize.size;
      // Qwen is single-image in this workbench. Some Gitee backends return a
      // generic HTTP 500 instead of a 4xx when an unsupported `n` is present,
      // so the safest single-image payload must be attempted first.
      return unique([noN, widthHeight, defaultSize, nativeSize]);
    }
  });

  hub.register("z-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: true,
    ui: { sizes: Z_SIZES, note: "沿用已验证的 OpenAI 风格 size=1024x1024" },
    parameters: [
      { key: "size", label: "分辨率 Resolution", type: "select", sourceId: "zRes", options: Z_SIZES },
      { key: "count", label: "生成张数", type: "number", sourceId: "zN", min: 1, max: 4, step: 1, default: 1, help: "z-image 支持一次生成 1–4 张。" }
    ],
    jsonVariants(body) { return [{ ...body }]; }
  });

  hub.register("generic-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: { sizes: COMMON_SIZES, note: "先用标准 size，参数不兼容时自动尝试精简/宽高格式" },
    parameters: [
      { key: "size", label: "分辨率 Resolution", type: "select", sourceId: "zRes", options: COMMON_SIZES, help: "为提高跨模型兼容性，通用模型默认一次生成 1 张。" }
    ],
    jsonVariants(body) {
      const parsed = splitSize(body.size);
      const noN = { ...body }; delete noN.n;
      // Generic image models are also treated as single-image by default.
      // Prefer the minimal payload first so servers that reject `n` do not
      // fail before the compatibility variants can be reached.
      const variants = [noN, { ...body }];
      if (parsed) {
        variants.push({ ...noN, size: `${parsed.width}*${parsed.height}` });
        const widthHeight = { ...noN, width: parsed.width, height: parsed.height }; delete widthHeight.size;
        variants.push(widthHeight);
      }
      return unique(variants);
    }
  });

  hub.register("qwen-edit", {
    task: "edit",
    defaultEndpoint: "async/images/edits",
    uiProfile: "qwen",
    parameters: [
      {
        key: "taskTypes",
        label: "编辑方式",
        type: "checkbox-group",
        sourceName: "editTaskType",
        options: ["id", "style", "pose", "layout", "color", "background"],
        span: "full",
        help: "可多选；保持与 Qwen 编辑接口的 task_types 一致。"
      },
      { key: "steps", label: "推理步数", type: "number", sourceId: "editSteps", min: 1, max: 50, step: 1, default: 4, advanced: true },
      { key: "guidance", label: "Guidance Scale", type: "number", sourceId: "editGuidance", min: 0, max: 10, step: 0.5, default: 1, advanced: true },
      { key: "openUrl", label: "完成后打开 file_url", type: "checkbox", sourceId: "editOpenUrl", advanced: true }
    ]
  });

  hub.register("generic-edit", {
    task: "edit",
    defaultEndpoint: "async/images/edits",
    uiProfile: "standard",
    parameters: [
      { key: "openUrl", label: "完成后打开 file_url", type: "checkbox", sourceId: "editOpenUrl", advanced: true }
    ]
  });
})();
