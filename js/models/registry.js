(() => {
  "use strict";

  const TASKS = {
    t2i: {
      panelId: "panelZ",
      selectId: "mmT2IModel",
      storageKey: "moark_model_t2i",
      defaultEndpoint: "images/generations",
      defaultModel: "z-image-turbo",
      allowAutoSync: true,
      models: [
        { id: "Qwen-Image-2512", label: "Qwen-Image-2512", badge: "高质量 · 兼容模式", adapter: "qwen-image", group: "recommended", status: { state: "adapted", text: "已适配", detail: "已切换为 1024 级兼容尺寸与单图最简请求；需重新实测后再标记已验证" } },
        { id: "FLUX.2-dev", label: "FLUX.2-dev", badge: "高质量 · 专业", adapter: "generic-image", group: "more" },
        { id: "Qwen-Image", label: "Qwen-Image", badge: "高质量 · 中文文字", adapter: "qwen-image", group: "recommended", status: { state: "adapted", text: "已适配", detail: "Qwen 单图兼容请求已就绪，建议先用 1024x1024 实测" } },
        { id: "FLUX.2-klein-9B", label: "FLUX.2-klein-9B", badge: "推荐 · 均衡", adapter: "generic-image", group: "recommended" },
        { id: "FLUX.1-schnell", label: "FLUX.1-schnell", badge: "热门 · 极速", adapter: "generic-image", group: "fast" },
        { id: "z-image-turbo", label: "z-image-turbo", badge: "推荐 · 极速 · 稳定", adapter: "z-image", group: "recommended", status: { state: "verified", text: "已验证", detail: "本站原有稳定文生图链路；默认使用 1024x1024" } },
        { id: "Z-Image", label: "Z-Image", badge: "高质量 · 单图兼容", adapter: "generic-image", group: "more", status: { state: "adapted", text: "已适配", detail: "按通用单图请求处理，不再继承 z-image-turbo 的批量 n 参数" } },
        { id: "GLM-Image", label: "GLM-Image", badge: "中文 · 文字渲染", adapter: "generic-image", group: "more" },
        { id: "HiDream-I1-Full", label: "HiDream-I1-Full", badge: "高质量", adapter: "generic-image", group: "more" },
        { id: "CogView4-6B", label: "CogView4-6B", badge: "中文 · 空间关系", adapter: "generic-image", group: "more" },
        { id: "LongCat-Image", label: "LongCat-Image", badge: "写实 · 中文文字", adapter: "generic-image", group: "more" },
        { id: "FLUX.1-dev", label: "FLUX.1-dev", badge: "经典高质量", adapter: "generic-image", group: "more" },
        { id: "FLUX.1-Krea-dev", label: "FLUX.1-Krea-dev", badge: "创意 · 美学", adapter: "generic-image", group: "more" },
        { id: "FLUX.2-klein-4B", label: "FLUX.2-klein-4B", badge: "快速/轻量", adapter: "generic-image", group: "fast" },
        { id: "Kolors", label: "Kolors", badge: "中文 · 风格", adapter: "generic-image", group: "more" },
        { id: "stable-diffusion-xl-base-1.0", label: "SDXL 1.0", badge: "经典通用", adapter: "generic-image", group: "more" },
        { id: "stable-diffusion-3.5-large-turbo", label: "SD 3.5 Large Turbo", badge: "快速 · 高质量", adapter: "generic-image", group: "fast" },
        { id: "stable-diffusion-3-medium", label: "Stable Diffusion 3 Medium", badge: "通用", adapter: "generic-image", group: "more" }
      ]
    },
    edit: {
      panelId: "panelEdit",
      selectId: "mmEditModel",
      storageKey: "moark_model_edit",
      defaultEndpoint: "async/images/edits",
      defaultModel: "Qwen-Image-Edit-2511",
      allowAutoSync: true,
      models: [
        { id: "Qwen-Image-Edit-2511", label: "Qwen-Image-Edit-2511", badge: "推荐 · 默认 · 去物体/一致性", adapter: "qwen-edit", group: "recommended", status: { state: "verified", text: "已验证", detail: "原项目编辑链路" } },
        { id: "LongCat-Image-Edit", label: "LongCat-Image-Edit", badge: "推荐 · 精细编辑", adapter: "generic-edit", group: "recommended" },
        { id: "Qwen-Image-Edit", label: "Qwen-Image-Edit", badge: "热门 · 通用编辑", adapter: "qwen-edit", group: "recommended" },
        { id: "FLUX.1-Kontext-dev", label: "FLUX.1-Kontext-dev", badge: "上下文编辑 · 一致性", adapter: "generic-edit", group: "more" },
        { id: "FLUX.2-klein-9B", label: "FLUX.2-klein-9B", badge: "推荐 · 快速编辑", adapter: "generic-edit", group: "fast" },
        { id: "FLUX.2-klein-4B", label: "FLUX.2-klein-4B", badge: "轻量 · 快速编辑", adapter: "generic-edit", group: "fast" },
        { id: "FLUX.1-Krea-dev", label: "FLUX.1-Krea-dev", badge: "创意编辑", adapter: "generic-edit", group: "more" },
        { id: "Qwen-Image", label: "Qwen-Image", badge: "生成+编辑", adapter: "generic-edit", group: "more" }
      ]
    },
    i2v: {
      panelId: "panelWan",
      selectId: "mmI2VModel",
      storageKey: "moark_model_i2v",
      defaultEndpoint: "async/videos/image-to-video",
      defaultModel: "ViduQ3-Pro",
      allowAutoSync: false,
      models: [
        { id: "ViduQ3-Pro", label: "ViduQ3-Pro", badge: "高质量 · 最长 16s", note: "高质量 · 最长 16s", adapter: "generic-video", group: "recommended", limits: { duration: { min: 5, max: 16, recommended: 5 } } },
        { id: "ViduQ3-Turbo", label: "ViduQ3-Turbo", badge: "高性能 · 速度更快", note: "高性能 · 速度更快", adapter: "generic-video", group: "recommended", limits: { duration: { min: 5, max: 16, recommended: 5 } } },
        { id: "ViduQ2-Pro", label: "ViduQ2-Pro", badge: "参考控制 · 图生视频", note: "参考控制 · 图生视频", adapter: "generic-video", group: "recommended", limits: { duration: { min: 5, max: 10, recommended: 5 } } },
        { id: "HappyHorse-1.1", label: "HappyHorse-1.1", badge: "高质量 · 图生视频", note: "高质量 · 图生视频", adapter: "generic-video", group: "recommended", limits: { duration: { min: 3, max: 15, recommended: 5 } } },
        { id: "Wan2.7", label: "Wan2.7", badge: "新一代 Wan 视频模型", note: "新一代 Wan 视频模型", adapter: "generic-video", group: "recommended", limits: { duration: { min: 3, max: 15, recommended: 5 } }, status: { state: "experimental", text: "实验", detail: "接口参数仍需实测" } },
        { id: "Wan2_2-I2V-A14B", label: "Wan2.2-I2V-A14B", badge: "原项目稳定链路", note: "原项目稳定链路", adapter: "wan-i2v", group: "recommended", status: { state: "verified", text: "已验证", detail: "原项目稳定链路，支持分段" } },
        { id: "LTX-2", label: "LTX-2", badge: "音视频基础模型", note: "音视频基础模型", adapter: "generic-video", group: "recommended", status: { state: "experimental", text: "实验", detail: "接口参数仍需实测" } },
        { id: "ViduQ2-Turbo", label: "ViduQ2-Turbo", badge: "快速 · 备选", note: "快速 · 备选", adapter: "generic-video", group: "optional", limits: { duration: { min: 5, max: 10, recommended: 5 } } },
        { id: "HappyHorse-1.0", label: "HappyHorse-1.0", badge: "上一代 · 备选", note: "上一代 · 备选", adapter: "generic-video", group: "optional", limits: { duration: { min: 3, max: 15, recommended: 5 } } }
      ]
    },
    t2v: {
      panelId: "panelHunyuan",
      selectId: "mmT2VModel",
      storageKey: "moark_model_t2v",
      defaultEndpoint: "async/videos/generations",
      defaultModel: "HunyuanVideo-1.5",
      allowAutoSync: false,
      models: [
        { id: "HunyuanVideo-1.5", label: "HunyuanVideo-1.5", badge: "原项目稳定链路", note: "原项目稳定链路", adapter: "hunyuan-t2v", group: "recommended", status: { state: "verified", text: "已验证", detail: "原项目稳定链路" } },
        { id: "ViduQ3-Pro", label: "ViduQ3-Pro", badge: "高质量 · 最长 16s", note: "高质量 · 最长 16s", adapter: "generic-video", group: "recommended", limits: { duration: { min: 5, max: 16, recommended: 5 } } },
        { id: "ViduQ3-Turbo", label: "ViduQ3-Turbo", badge: "高性能 · 速度更快", note: "高性能 · 速度更快", adapter: "generic-video", group: "recommended", limits: { duration: { min: 5, max: 16, recommended: 5 } } },
        { id: "Wan2.7", label: "Wan2.7", badge: "新一代 Wan 视频模型", note: "新一代 Wan 视频模型", adapter: "generic-video", group: "recommended", limits: { duration: { min: 3, max: 15, recommended: 5 } }, status: { state: "experimental", text: "实验", detail: "接口参数仍需实测" } },
        { id: "Wan2.1-T2V-14B", label: "Wan2.1-T2V-14B", badge: "专用文生视频", note: "专用文生视频", adapter: "generic-video", group: "recommended" },
        { id: "LTX-2", label: "LTX-2", badge: "音视频基础模型", note: "音视频基础模型", adapter: "generic-video", group: "recommended", status: { state: "experimental", text: "实验", detail: "接口参数仍需实测" } },
        { id: "HappyHorse-1.1", label: "HappyHorse-1.1", badge: "页面可体验 · 兼容适配", note: "页面可体验 · 兼容适配", adapter: "generic-video", group: "optional", limits: { duration: { min: 3, max: 15, recommended: 5 } } }
      ]
    }
  };

  const GROUP_LABELS = {
    recommended: "推荐/已验证",
    fast: "快速/轻量",
    more: "更多模型",
    optional: "备选模型",
    synced: "Gitee API 同步"
  };

  function task(taskId) { return TASKS[taskId] || null; }
  function model(taskId, modelId) { return TASKS[taskId]?.models?.find((m) => m.id === modelId) || null; }
  function adapterId(taskId, modelId) {
    return model(taskId, modelId)?.adapter || ({ t2i: "generic-image", edit: "generic-edit", i2v: "generic-video", t2v: "generic-video" }[taskId] || "generic");
  }
  function classifyModelId(id) {
    const s = String(id || "");
    const out = [];
    if (/image[-_ ]?edit|edit[-_ ]?image|kontext|longcat.*edit/i.test(s)) out.push("edit");
    if (/i2v|image[-_ ]?to[-_ ]?video|happyhorse|viduq2/i.test(s)) out.push("i2v");
    if (/viduq3/i.test(s)) out.push("i2v", "t2v");
    if (/t2v|hunyuanvideo|wan.*2[._ ]?7/i.test(s)) out.push("t2v");
    if (/ltx[-_ ]?2/i.test(s)) out.push("i2v", "t2v");
    if (/image|flux|cogview|hidream|z[-_ ]?image|longcat|kolors|stable[-_ ]?diffusion/i.test(s) && !out.includes("edit") && !/video|i2v|t2v/i.test(s)) out.push("t2i");
    return [...new Set(out)];
  }
  function registerSyncedModel(taskId, id) {
    const conf = task(taskId);
    if (!conf?.allowAutoSync || !id) return null;
    const existing = model(taskId, id);
    if (existing) return existing;
    const entry = { id, label: id, badge: "Gitee API 同步", note: "由当前 Token 的模型列表接口发现", adapter: taskId === "t2i" ? "generic-image" : "generic-edit", group: "synced" };
    conf.models.push(entry);
    return entry;
  }
  function modelsByGroup(taskId) {
    const conf = task(taskId);
    const groups = new Map();
    for (const item of conf?.models || []) {
      const key = item.group || "more";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return groups;
  }

  window.GiteeModelRegistry = Object.freeze({ tasks: TASKS, groupLabels: GROUP_LABELS, task, model, adapterId, classifyModelId, registerSyncedModel, modelsByGroup });
})();
