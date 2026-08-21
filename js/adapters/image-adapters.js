(() => {
  "use strict";

  const hub = window.GiteeModelAdapters;
  if (!hub) throw new Error("GiteeModelAdapters is not initialized");

  const COMMON_SIZES = [
    "1:1 (1024x1024)", "3:4 (768x1024)", "4:3 (1024x768)",
    "16:9 (1024x576)", "9:16 (576x1024)"
  ];
  const Z_SIZES = [
    "1:1 (1024x1024)", "3:4 (768x1024)", "4:3 (1024x768)",
    "16:9 (1024x576)", "9:16 (576x1024)", "1:1 (2048x2048)"
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

  function singleImageBase(body) {
    const next = { ...body };
    delete next.n;
    return next;
  }

  function singleImageVariants(body, { allowStarSize = true } = {}) {
    const base = singleImageBase(body);
    const parsed = splitSize(base.size);
    const variants = [];

    // OpenAI-compatible size syntax is the safest first request.
    if (parsed) variants.push({ ...base, size: `${parsed.width}x${parsed.height}` });
    else variants.push({ ...base });

    // Some hosted image backends use W*H instead of WxH.
    if (parsed && allowStarSize) variants.push({ ...base, size: `${parsed.width}*${parsed.height}` });

    // Some implementations expose width/height instead of size.
    if (parsed) {
      const widthHeight = { ...base, width: parsed.width, height: parsed.height };
      delete widthHeight.size;
      variants.push(widthHeight);
    }

    // Final compatibility fallback: let the backend use its model default size.
    const noSize = { ...base };
    delete noSize.size;
    variants.push(noSize);
    return unique(variants);
  }

  hub.register("qwen-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: {
      sizes: QWEN_SIZES,
      note: "默认使用 1024 级兼容尺寸；Qwen 原生大尺寸保留为可选项，不再强制转换到 1328/1664 原生桶"
    },
    parameters: [
      {
        key: "size",
        label: "分辨率 Resolution",
        type: "select",
        sourceId: "zRes",
        options: QWEN_SIZES,
        help: "优先使用托管 API 更稳定的 1024 级尺寸；需要时仍可手动选择 Qwen 原生尺寸。"
      }
    ],
    jsonVariants(body) {
      return singleImageVariants(body, { allowStarSize: true });
    }
  });

  hub.register("z-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: true,
    ui: { sizes: Z_SIZES, note: "稳定模式默认 1024x1024；仅 z-image-turbo 保留批量生成能力" },
    parameters: [
      { key: "size", label: "分辨率 Resolution", type: "select", sourceId: "zRes", options: Z_SIZES },
      { key: "count", label: "生成张数", type: "number", sourceId: "zN", min: 1, max: 4, step: 1, default: 1, help: "z-image-turbo 支持一次生成 1–4 张。" }
    ],
    jsonVariants(body) {
      return [{ ...body }];
    }
  });

  hub.register("generic-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: { sizes: COMMON_SIZES, note: "统一使用 1024 级兼容尺寸；单图最简请求优先，再尝试兼容尺寸格式" },
    parameters: [
      {
        key: "size",
        label: "分辨率 Resolution",
        type: "select",
        sourceId: "zRes",
        options: COMMON_SIZES,
        help: "FLUX / GLM / HiDream / CogView / LongCat / Kolors / SD 等通用模型默认单图请求，避免不支持 n 时触发服务端错误。"
      }
    ],
    jsonVariants(body) {
      return singleImageVariants(body, { allowStarSize: true });
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
