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
    "1:1 (1024x1024)", "3:4 (768x1024)", "4:3 (1024x768)",
    "16:9 (1024x576)", "9:16 (576x1024)",
    "原生 1:1 (1328x1328)", "原生 16:9 (1664x928)", "原生 9:16 (928x1664)",
    "原生 4:3 (1472x1104)", "原生 3:4 (1104x1472)", "原生 3:2 (1584x1056)", "原生 2:3 (1056x1584)"
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

  hub.register("qwen-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: { sizes: QWEN_SIZES, note: "默认使用 1024 级兼容尺寸；Qwen 原生大尺寸保留为可选项，不再强制放大" },
    parameters: [
      { key: "size", label: "分辨率 Resolution", type: "select", sourceId: "zRes", options: QWEN_SIZES, help: "优先使用托管 API 更稳定的 1024 级尺寸；需要时仍可手动选择 Qwen 原生尺寸。" }
    ],
    jsonVariants(body) {
      const parsed = splitSize(body.size) || { width: 1024, height: 1024 };
      const starSize = { ...body, size: `${parsed.width}*${parsed.height}` };
      const noN = { ...starSize }; delete noN.n;
      const widthHeight = { ...noN, width: parsed.width, height: parsed.height }; delete widthHeight.size;
      const defaultSize = { ...noN }; delete defaultSize.size;
      // Qwen is single-image in this workbench. Some hosted backends return a
      // generic HTTP 500 instead of a 4xx when `n` or a backend-specific size
      // combination is rejected. Prefer the smallest compatible payload first.
      return unique([noN, widthHeight, defaultSize, starSize]);
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
      // Generic image models are treated as single-image by default. Prefer
      // the minimal payload first so servers that reject `n` do not fail
      // before the compatibility variants can be reached.
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
