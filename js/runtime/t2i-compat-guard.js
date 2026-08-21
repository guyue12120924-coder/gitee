(() => {
  "use strict";

  const VERSION = "20260821-t2i-fix5";
  const MIGRATION_KEY = `moark_t2i_compat_guard:${VERSION}`;
  const $ = (id) => document.getElementById(id);
  const REGISTRY = window.GiteeModelRegistry;
  const ADAPTERS = window.GiteeModelAdapters;
  let activeModel = "";
  let applying = false;

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
    const match = String(size || "").match(/(\d+)[x*](\d+)/i);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
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

  function singleImageVariants(body) {
    const base = { ...body };
    delete base.n;
    const parsed = splitSize(base.size);
    const variants = [];
    if (parsed) variants.push({ ...base, size: `${parsed.width}x${parsed.height}` });
    else variants.push({ ...base });
    if (parsed) variants.push({ ...base, size: `${parsed.width}*${parsed.height}` });
    if (parsed) {
      const widthHeight = { ...base, width: parsed.width, height: parsed.height };
      delete widthHeight.size;
      variants.push(widthHeight);
    }
    const noSize = { ...base };
    delete noSize.size;
    variants.push(noSize);
    return unique(variants);
  }

  function installStableAdapters() {
    if (!ADAPTERS?.register) return;

    ADAPTERS.register("qwen-image", {
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
      jsonVariants: singleImageVariants,
    });

    ADAPTERS.register("generic-image", {
      task: "t2i",
      defaultEndpoint: "images/generations",
      allowBatch: false,
      ui: {
        sizes: COMMON_SIZES,
        note: "统一使用 1024 级兼容尺寸；单图最简请求优先，再尝试兼容尺寸格式"
      },
      parameters: [
        {
          key: "size",
          label: "分辨率 Resolution",
          type: "select",
          sourceId: "zRes",
          options: COMMON_SIZES,
          help: "通用文生图模型默认单图请求，避免不支持 n 时触发服务端错误。"
        }
      ],
      jsonVariants: singleImageVariants,
    });

    ADAPTERS.register("z-image", {
      task: "t2i",
      defaultEndpoint: "images/generations",
      allowBatch: true,
      ui: {
        sizes: Z_SIZES,
        note: "稳定模式默认 1024x1024；仅 z-image-turbo 保留批量生成能力"
      },
      parameters: [
        { key: "size", label: "分辨率 Resolution", type: "select", sourceId: "zRes", options: Z_SIZES },
        { key: "count", label: "生成张数", type: "number", sourceId: "zN", min: 1, max: 4, step: 1, default: 1 }
      ],
      jsonVariants(body) { return [{ ...body }]; },
    });
  }

  function patchRegistryModel(id, patch) {
    const model = REGISTRY?.task?.("t2i")?.models?.find((item) => item.id === id);
    if (model) Object.assign(model, patch);
  }

  function installStableRegistryMappings() {
    patchRegistryModel("Qwen-Image-2512", {
      adapter: "qwen-image",
      badge: "高质量 · 兼容模式",
      status: { state: "adapted", text: "已适配", detail: "1024 级兼容尺寸 + 单图最简请求，等待当前账户实测" },
    });
    patchRegistryModel("Qwen-Image", {
      adapter: "qwen-image",
      status: { state: "adapted", text: "已适配", detail: "建议先用 1024x1024 实测" },
    });
    patchRegistryModel("z-image-turbo", {
      adapter: "z-image",
      status: { state: "verified", text: "已验证", detail: "原有稳定链路；默认 1024x1024" },
    });
    patchRegistryModel("Z-Image", {
      adapter: "generic-image",
      badge: "高质量 · 单图兼容",
      status: { state: "adapted", text: "已适配", detail: "单图兼容请求，不继承 z-image-turbo 的批量 n" },
    });
  }

  // Install immediately. This intentionally runs after the core Registry / Adapter / Runtime
  // scripts so it also repairs browsers that still hold an older cached copy of those files.
  installStableAdapters();
  installStableRegistryMappings();

  function modelId() {
    return $("mmT2IModel")?.value || "";
  }

  function adapter() {
    try { return ADAPTERS?.forModel?.("t2i", modelId()) || null; }
    catch { return null; }
  }

  function preferredSize() {
    const options = adapter()?.ui?.sizes || [];
    return options.find((value) => /(^|\D)1024x1024(\D|$)/.test(String(value))) || options[0] || "";
  }

  function dispatchValue(el) {
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    el?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyStableDefaults(force = false) {
    if (applying) return;
    const id = modelId();
    const res = $("zRes");
    if (!id || !res) return;

    const changedModel = id !== activeModel;
    if (!force && !changedModel) return;
    activeModel = id;

    applying = true;
    try {
      const preferred = preferredSize();
      if (preferred && [...res.options].some((option) => option.value === preferred) && res.value !== preferred) {
        res.value = preferred;
        dispatchValue(res);
      }

      const count = $("zN");
      if (count) {
        const allowBatch = adapter()?.allowBatch === true;
        count.disabled = !allowBatch;
        count.max = allowBatch ? "4" : "1";
        if (!allowBatch) count.value = "1";
      }
    } finally {
      applying = false;
    }
  }

  function clearStaleFailuresOnce() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === "1") return;
      const models = REGISTRY?.task?.("t2i")?.models || [];
      for (const model of models) {
        const key = `moark_model_health_v1:t2i:${model.id}`;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.state === "fail") localStorage.removeItem(key);
        } catch {}
      }
      localStorage.setItem(MIGRATION_KEY, "1");
    } catch {}
  }

  function markRuntimeVersion() {
    document.documentElement.dataset.t2iCompat = VERSION;
    const note = $("mm-t2i-note");
    if (note && !note.textContent.includes("稳定兼容 v5")) {
      note.textContent = `${note.textContent} · 稳定兼容 v5`;
    }
  }

  function init() {
    clearStaleFailuresOnce();
    activeModel = "";
    applyStableDefaults(true);
    markRuntimeVersion();

    $("mmT2IModel")?.addEventListener("change", () => {
      window.setTimeout(() => {
        installStableAdapters();
        installStableRegistryMappings();
        applyStableDefaults(true);
        markRuntimeVersion();
      }, 0);
    });

    window.addEventListener("gitee-experience-mode-change", () => window.setTimeout(markRuntimeVersion, 0));
  }

  window.GiteeT2ICompatGuard = Object.freeze({
    version: VERSION,
    apply: () => applyStableDefaults(true),
    reinstall: () => {
      installStableAdapters();
      installStableRegistryMappings();
      applyStableDefaults(true);
    },
  });

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(init)));
})();
