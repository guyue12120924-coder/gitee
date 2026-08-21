(() => {
  "use strict";

  const hub = window.GiteeModelAdapters;
  if (!hub) throw new Error("GiteeModelAdapters is not initialized");

  // Capture the browser fetch before model-runtime wraps it. This hotfix only
  // handles Qwen text-to-image requests; every other request is passed through.
  const rawFetch = window.fetch.bind(window);

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
  const QWEN_SAFE_BUCKETS = [
    { ratio: 1, width: 1024, height: 1024 },
    { ratio: 16 / 9, width: 1024, height: 576 },
    { ratio: 9 / 16, width: 576, height: 1024 },
    { ratio: 4 / 3, width: 1024, height: 768 },
    { ratio: 3 / 4, width: 768, height: 1024 },
    { ratio: 3 / 2, width: 1024, height: 680 },
    { ratio: 2 / 3, width: 680, height: 1024 }
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

  function nearestSafeQwenSize(parsed) {
    if (!parsed?.width || !parsed?.height) return QWEN_SAFE_BUCKETS[0];
    const ratio = parsed.width / parsed.height;
    return QWEN_SAFE_BUCKETS.reduce(
      (best, item) => Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best,
      QWEN_SAFE_BUCKETS[0]
    );
  }

  function qwenVariants(body) {
    const selected = splitSize(body?.size);
    const safe = nearestSafeQwenSize(selected);
    const base = { ...body };
    delete base.n;
    delete base.size;
    delete base.width;
    delete base.height;

    const variants = [
      { ...base, size: `${safe.width}x${safe.height}` },
      { ...base, size: `${safe.width}*${safe.height}` },
      { ...base, width: safe.width, height: safe.height },
      { ...base }
    ];

    // Keep the explicitly selected native size as a late fallback only.
    if (selected && (selected.width !== safe.width || selected.height !== safe.height)) {
      variants.push({ ...base, size: `${selected.width}*${selected.height}` });
    }
    return unique(variants);
  }

  function isQwenGenerationRequest(input, init) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    if (!/\/api\/images\/generations(?:\?|$)/.test(url)) return null;
    if (typeof init?.body !== "string") return null;
    let body;
    try { body = JSON.parse(init.body); } catch { return null; }
    const model = String(body?.model || "").toLowerCase();
    if (model !== "qwen-image-2512" && model !== "qwen-image") return null;
    return body;
  }

  async function shouldRetryQwen(res) {
    if (!res || res.ok) return false;
    if ([400, 404, 405, 415, 422, 502, 503, 504].includes(res.status)) return true;
    if (res.status !== 500) return false;
    let text = "";
    try { text = await res.clone().text(); } catch {}
    return /unexpected error|server log|internal server error/i.test(text);
  }

  async function qwenCompatibleFetch(input, init = {}) {
    const body = isQwenGenerationRequest(input, init);
    if (!body) return rawFetch(input, init);

    let last = null;
    for (const variant of qwenVariants(body)) {
      const res = await rawFetch(input, { ...init, body: JSON.stringify(variant) });
      last = res;
      if (res.ok || !(await shouldRetryQwen(res))) return res;
    }
    return last || rawFetch(input, init);
  }

  // model-runtime loads after this file and captures this wrapper as its native fetch.
  // Therefore Qwen gets the targeted 500 fallback while all other models remain untouched.
  window.fetch = qwenCompatibleFetch;

  hub.register("qwen-image", {
    task: "t2i",
    defaultEndpoint: "images/generations",
    allowBatch: false,
    ui: {
      sizes: QWEN_SIZES,
      note: "Qwen 默认使用 1024 级兼容尺寸；单图请求不发送 n，若服务端返回通用 500 会自动尝试兼容格式"
    },
    parameters: [
      {
        key: "size",
        label: "分辨率 Resolution",
        type: "select",
        sourceId: "zRes",
        options: QWEN_SIZES,
        help: "建议先用 1024 级尺寸；原生 1328/1664 尺寸仍保留为手动选项。"
      }
    ],
    jsonVariants(body) {
      // The Qwen-only fetch wrapper owns compatibility retries, including the
      // observed provider HTTP 500. Keep runtime-level variants to one safe body.
      return [qwenVariants(body)[0]];
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
      const variants = [{ ...body }, noN];
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
