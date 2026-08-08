(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const nativeFetch = window.fetch.bind(window);

  const CONFIG = {
    qwenImageModels: new Set(["Qwen-Image-2512", "Qwen-Image"]),
    zImageModels: new Set(["z-image-turbo", "Z-Image"]),
    genericI2VModels: new Set([
      "ViduQ3-Pro", "ViduQ2-Pro", "ViduQ3-Turbo", "ViduQ2-Turbo",
      "HappyHorse-1.0", "HappyHorse-1.1", "LTX-2", "Wan2.7",
    ]),
    qwenSizeBuckets: [
      { ratio: 1, width: 1328, height: 1328 },
      { ratio: 16 / 9, width: 1664, height: 928 },
      { ratio: 9 / 16, width: 928, height: 1664 },
      { ratio: 4 / 3, width: 1472, height: 1104 },
      { ratio: 3 / 4, width: 1104, height: 1472 },
      { ratio: 3 / 2, width: 1584, height: 1056 },
      { ratio: 2 / 3, width: 1056, height: 1584 },
    ],
    t2iSizes: {
      qwen: [
        "1:1 (1328x1328)", "16:9 (1664x928)", "9:16 (928x1664)",
        "4:3 (1472x1104)", "3:4 (1104x1472)", "3:2 (1584x1056)", "2:3 (1056x1584)",
      ],
      zimage: [
        "1:1 (2048x2048)", "1:1 (1024x1024)", "3:4 (768x1024)",
        "4:3 (1024x768)", "16:9 (1024x576)", "9:16 (576x1024)",
      ],
      common: [
        "1:1 (1024x1024)", "3:4 (768x1024)", "4:3 (1024x768)",
        "16:9 (1024x576)", "9:16 (576x1024)",
      ],
    },
    durationRules: {
      "ViduQ3-Pro": { min: 5, max: 16, recommended: 5 },
      "ViduQ3-Turbo": { min: 5, max: 16, recommended: 5 },
      "ViduQ2-Pro": { min: 5, max: 10, recommended: 5 },
      "ViduQ2-Turbo": { min: 5, max: 10, recommended: 5 },
      "HappyHorse-1.0": { min: 3, max: 15, recommended: 5 },
      "HappyHorse-1.1": { min: 3, max: 15, recommended: 5 },
      "Wan2.7": { min: 3, max: 15, recommended: 5 },
    },
    staticStatus: {
      t2i: {
        "z-image-turbo": { state: "verified", text: "已验证", detail: "本站已确认可生成" },
        "Qwen-Image-2512": { state: "verified", text: "已验证", detail: "Qwen 尺寸适配已确认可生成" },
        "Qwen-Image": { state: "adapted", text: "已适配", detail: "Qwen 参数适配已就绪，建议实测" },
      },
      edit: {
        "Qwen-Image-Edit-2511": { state: "verified", text: "已验证", detail: "原项目编辑链路" },
      },
      i2v: {
        "Wan2_2-I2V-A14B": { state: "verified", text: "已验证", detail: "原项目稳定链路，支持分段" },
        "LTX-2": { state: "experimental", text: "实验", detail: "接口参数仍需实测" },
        "Wan2.7": { state: "experimental", text: "实验", detail: "接口参数仍需实测" },
      },
      t2v: {
        "HunyuanVideo-1.5": { state: "verified", text: "已验证", detail: "原项目稳定链路" },
        "LTX-2": { state: "experimental", text: "实验", detail: "接口参数仍需实测" },
        "Wan2.7": { state: "experimental", text: "实验", detail: "接口参数仍需实测" },
      },
    },
    videoCatalog: {
      i2v: {
        fallback: "ViduQ3-Pro",
        recommended: [
          { id: "ViduQ3-Pro", label: "ViduQ3-Pro", note: "高质量 · 最长 16s" },
          { id: "ViduQ3-Turbo", label: "ViduQ3-Turbo", note: "高性能 · 速度更快" },
          { id: "ViduQ2-Pro", label: "ViduQ2-Pro", note: "参考控制 · 图生视频" },
          { id: "HappyHorse-1.1", label: "HappyHorse-1.1", note: "高质量 · 图生视频" },
          { id: "Wan2.7", label: "Wan2.7", note: "新一代 Wan 视频模型" },
          { id: "Wan2_2-I2V-A14B", label: "Wan2.2-I2V-A14B", note: "原项目稳定链路" },
          { id: "LTX-2", label: "LTX-2", note: "音视频基础模型" },
        ],
        optional: [
          { id: "ViduQ2-Turbo", label: "ViduQ2-Turbo", note: "快速 · 备选" },
          { id: "HappyHorse-1.0", label: "HappyHorse-1.0", note: "上一代 · 备选" },
        ],
      },
      t2v: {
        fallback: "HunyuanVideo-1.5",
        recommended: [
          { id: "HunyuanVideo-1.5", label: "HunyuanVideo-1.5", note: "原项目稳定链路" },
          { id: "ViduQ3-Pro", label: "ViduQ3-Pro", note: "高质量 · 最长 16s" },
          { id: "ViduQ3-Turbo", label: "ViduQ3-Turbo", note: "高性能 · 速度更快" },
          { id: "Wan2.7", label: "Wan2.7", note: "新一代 Wan 视频模型" },
          { id: "Wan2.1-T2V-14B", label: "Wan2.1-T2V-14B", note: "专用文生视频" },
          { id: "LTX-2", label: "LTX-2", note: "音视频基础模型" },
        ],
        optional: [
          { id: "HappyHorse-1.1", label: "HappyHorse-1.1", note: "页面可体验 · 兼容适配" },
        ],
      },
    },
  };

  const SELECT_IDS = { t2i: "mmT2IModel", edit: "mmEditModel", i2v: "mmI2VModel", t2v: "mmT2VModel" };
  const BUTTON_IDS = { t2i: "btnZRun", edit: "btnEditRun", i2v: "btnWanRun", t2v: "btnHyRun" };
  const enforcingCatalog = new WeakSet();

  function addInfo(title, meta = "") {
    if (typeof window.addOutputItem === "function") {
      window.addOutputItem({ title, meta });
      return;
    }
    const out = $("output");
    if (!out) return;
    const box = document.createElement("div");
    box.className = "item";
    const h = document.createElement("h3");
    h.textContent = title;
    box.appendChild(h);
    if (meta) {
      const m = document.createElement("div");
      m.className = "meta";
      m.textContent = meta;
      box.appendChild(m);
    }
    out.prepend(box);
  }

  function rememberKeyNow() {
    const key = $("apiKey")?.value?.trim();
    if (!key) return;
    try {
      if ($("rememberKey")?.checked) localStorage.setItem("moark_api_key", key);
    } catch {}
  }

  function setLoading(show) {
    if (typeof window.showLoading === "function") return window.showLoading(show);
    const el = $("globalLoading");
    if (el) el.style.display = show ? "block" : "none";
  }

  function splitSize(size) {
    const m = String(size || "").match(/(\d+)[x*](\d+)/i);
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
  }

  function clamp(value, min, max) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function parseJsonBody(init) {
    if (!init || typeof init.body !== "string") return null;
    const type = String(init.headers?.["Content-Type"] || init.headers?.["content-type"] || "");
    if (type && !type.includes("application/json")) return null;
    try {
      const obj = JSON.parse(init.body);
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  }

  function nearestQwenBucket(parsed) {
    if (!parsed?.width || !parsed?.height) return CONFIG.qwenSizeBuckets[0];
    const ratio = parsed.width / parsed.height;
    return CONFIG.qwenSizeBuckets.reduce((best, item) => (
      Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best
    ), CONFIG.qwenSizeBuckets[0]);
  }

  function uniqueJsonVariants(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function imageRequestVariants(body) {
    const model = String(body.model || "");
    const parsed = splitSize(body.size);
    const variants = [];
    if (CONFIG.qwenImageModels.has(model)) {
      const bucket = nearestQwenBucket(parsed);
      const nativeSize = { ...body, size: `${bucket.width}*${bucket.height}` };
      variants.push(nativeSize);
      const noN = { ...nativeSize };
      delete noN.n;
      variants.push(noN);
      const widthHeight = { ...noN, width: bucket.width, height: bucket.height };
      delete widthHeight.size;
      variants.push(widthHeight);
      const defaultSize = { ...noN };
      delete defaultSize.size;
      variants.push(defaultSize);
      return uniqueJsonVariants(variants);
    }
    variants.push({ ...body });
    const noN = { ...body };
    delete noN.n;
    variants.push(noN);
    if (parsed && !CONFIG.zImageModels.has(model)) {
      variants.push({ ...noN, size: `${parsed.width}*${parsed.height}` });
      const widthHeight = { ...noN, width: parsed.width, height: parsed.height };
      delete widthHeight.size;
      variants.push(widthHeight);
    }
    return uniqueJsonVariants(variants);
  }

  function videoRequestVariants(body) {
    const variants = [{ ...body }];
    const model = String(body.model || "");
    if (!model || model === "HunyuanVideo-1.5") return variants;
    const compact = {
      model: body.model,
      prompt: body.prompt,
      ...(body.resolution ? { resolution: body.resolution } : {}),
      ...(body.duration !== undefined ? { duration: body.duration } : {}),
      ...(body.ratio ? { ratio: body.ratio } : {}),
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
      ...(body.negative_prompt ? { negative_prompt: body.negative_prompt } : {}),
      ...(body.image ? { image: body.image } : {}),
      ...(body.first_frame ? { first_frame: body.first_frame } : {}),
      ...(body.image_url ? { image_url: body.image_url } : {}),
    };
    variants.push(compact);
    if (body.ratio) {
      const aspect = { ...compact, aspect_ratio: body.ratio };
      delete aspect.ratio;
      variants.push(aspect);
    }
    if (body.image && typeof body.image === "string") {
      const firstFrame = { ...compact, first_frame: body.image };
      delete firstFrame.image;
      variants.push(firstFrame);
      const imageUrl = { ...compact, image_url: body.image };
      delete imageUrl.image;
      variants.push(imageUrl);
    }
    if (body.first_frame && typeof body.first_frame === "string") {
      const imageUrl = { ...compact, image_url: body.first_frame };
      delete imageUrl.first_frame;
      variants.push(imageUrl);
    }
    const minimal = { ...compact };
    delete minimal.seed;
    delete minimal.negative_prompt;
    variants.push(minimal);
    return uniqueJsonVariants(variants);
  }

  async function shouldRetryResponse(res) {
    if (res.ok || ![400, 404, 405, 415, 422].includes(res.status)) return false;
    let text = "";
    try { text = await res.clone().text(); } catch {}
    return !text || /参数|parameter|invalid|unsupported|size|field|format|request|method|endpoint/i.test(text);
  }

  async function fetchWithJsonVariants(input, init, variants) {
    let last = null;
    for (const body of variants) {
      const res = await nativeFetch(input, { ...init, body: JSON.stringify(body) });
      last = res;
      if (res.ok || !(await shouldRetryResponse(res))) return res;
    }
    return last;
  }

  window.fetch = async function modelAwareFetch(input, init = {}) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const body = parseJsonBody(init);
    if (body && /\/api\/images\/generations(?:\?|$)/.test(url)) {
      return fetchWithJsonVariants(input, init, imageRequestVariants(body));
    }
    if (body && /\/api\/async\/videos\//.test(url)) {
      return fetchWithJsonVariants(input, init, videoRequestVariants(body));
    }
    return nativeFetch(input, init);
  };

  function currentModelId(task) {
    return $(SELECT_IDS[task])?.value || "";
  }

  function t2iProfile(modelId) {
    if (CONFIG.qwenImageModels.has(modelId)) return "qwen";
    if (CONFIG.zImageModels.has(modelId)) return "zimage";
    return "common";
  }

  function refillT2ISizes() {
    const modelId = currentModelId("t2i") || "z-image-turbo";
    const res = $("zRes");
    if (!res) return;
    const profile = t2iProfile(modelId);
    const options = CONFIG.t2iSizes[profile];
    const oldDims = splitSize(res.value);
    res.innerHTML = "";
    for (const label of options) {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      res.appendChild(option);
    }
    const compatible = oldDims && [...res.options].find((o) => o.value.includes(`${oldDims.width}x${oldDims.height}`));
    res.value = compatible?.value || options[0];
    const note = $("mm-t2i-note");
    if (note) {
      const base = note.textContent.split(" · 参数适配：")[0];
      const desc = profile === "qwen"
        ? "自动使用 Qwen 原生分辨率桶，并转换为 1328*1328 / 1664*928 等格式"
        : profile === "zimage"
          ? "沿用已验证的 OpenAI 风格 size=1024x1024"
          : "先用标准 size，参数不兼容时自动尝试精简/宽高格式";
      note.textContent = `${base} · 参数适配：${desc}`;
    }
  }

  function setEndpointInputs(task, endpoint) {
    const normal = $(`mm-${task}-endpoint`);
    const advanced = $(`mm-${task}-endpoint-advanced`);
    if (normal) normal.value = endpoint;
    if (advanced) advanced.value = endpoint;
  }

  function applyVideoEndpointProfile() {
    const modelId = currentModelId("i2v");
    if (!modelId || modelId === "__custom__") return;
    if (modelId === "Wan2_2-I2V-A14B") setEndpointInputs("i2v", "async/videos/image-to-video");
    else if (CONFIG.genericI2VModels.has(modelId)) setEndpointInputs("i2v", "async/videos/generations");
  }

  function setVisible(el, show) {
    if (!el) return;
    if (el.dataset.mmOriginalDisplay === undefined) el.dataset.mmOriginalDisplay = el.style.display || "";
    el.style.display = show ? el.dataset.mmOriginalDisplay : "none";
  }

  function fieldParent(id) {
    const el = $(id);
    return el ? (el.closest("label") || el.parentElement) : null;
  }

  function createI2VGenericControls() {
    if ($("mmI2VGenericControls")) return;
    const modelBox = $("mmI2VModel")?.closest(".mm-model-box");
    if (!modelBox) return;
    const box = document.createElement("div");
    box.id = "mmI2VGenericControls";
    box.className = "mm-dynamic-controls";
    box.innerHTML = `
      <div class="grid3">
        <div><label class="lab">通用分辨率</label><select id="mmI2VResolution" class="input"><option>720P</option><option>480P</option></select></div>
        <div><label class="lab">画面比例</label><select id="mmI2VRatio" class="input"><option>16:9</option><option>9:16</option><option>1:1</option></select></div>
        <div><label class="lab">时长（秒）</label><input id="mmI2VDuration" class="input" type="number" min="1" max="16" step="1" value="5" /></div>
      </div>
      <div class="hint">通用视频模型显示简化参数；程序会同步到底层兼容请求。</div>`;
    modelBox.appendChild(box);
    for (const id of ["mmI2VResolution", "mmI2VRatio", "mmI2VDuration"]) {
      $(id)?.addEventListener("change", syncGenericI2VToLegacy);
      $(id)?.addEventListener("input", syncGenericI2VToLegacy);
    }
  }

  function syncGenericI2VToLegacy() {
    const resolution = $("mmI2VResolution")?.value || "720P";
    const ratio = $("mmI2VRatio")?.value || "16:9";
    const duration = Number.parseFloat($("mmI2VDuration")?.value || "5") || 5;
    const dims = {
      "720P": { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1280, 1280] },
      "480P": { "16:9": [832, 480], "9:16": [480, 832], "1:1": [768, 768] },
    };
    const [w, h] = dims[resolution]?.[ratio] || dims["720P"]["16:9"];
    if ($("wanW")) $("wanW").value = String(w);
    if ($("wanH")) $("wanH").value = String(h);
    if ($("wanDuration")) $("wanDuration").value = String(duration);
  }

  function updateT2IParameterUi() {
    const modelId = currentModelId("t2i");
    const nInput = $("zN");
    if (nInput) {
      const allowMulti = CONFIG.zImageModels.has(modelId);
      nInput.disabled = !allowMulti;
      nInput.max = allowMulti ? "4" : "1";
      if (!allowMulti) nInput.value = "1";
      nInput.title = allowMulti ? "当前模型允许一次生成多张" : "为提高跨模型兼容性，当前模型固定 n=1";
    }
    refreshHealth("t2i");
  }

  function updateI2VParameterUi() {
    const isWan = currentModelId("i2v") === "Wan2_2-I2V-A14B";
    setVisible($("mmI2VGenericControls"), !isWan);
    setVisible($("wanPreset")?.closest(".grid3"), isWan);
    setVisible($("wanResPreset")?.closest(".grid3"), isWan);
    setVisible($("wanFps")?.closest(".grid3"), isWan);
    setVisible(fieldParent("wanSteps"), isWan);
    setVisible(fieldParent("wanGuidance"), isWan);
    setVisible(fieldParent("wanWatermark"), isWan);
    setVisible(fieldParent("wanPromptExtend"), isWan);
    setVisible(fieldParent("wanAutoFrames"), isWan);
    setVisible(fieldParent("wanZipSegments"), isWan);
    if (!isWan) syncGenericI2VToLegacy();
    applyDurationRule("i2v");
    refreshHealth("i2v");
  }

  function updateT2VParameterUi() {
    const isHunyuan = currentModelId("t2v") === "HunyuanVideo-1.5";
    setVisible($("mmT2VResolution")?.closest(".grid2"), !isHunyuan);
    setVisible(fieldParent("hySteps"), isHunyuan);
    setVisible(fieldParent("hyFps"), isHunyuan);
    setVisible(fieldParent("hyFrames"), isHunyuan);
    applyDurationRule("t2v");
    refreshHealth("t2v");
  }

  function durationInput(task) {
    return $(task === "i2v" ? "mmI2VDuration" : "mmT2VDuration");
  }

  function applyDurationRule(task, { forceRecommended = false } = {}) {
    const modelId = currentModelId(task);
    const rule = CONFIG.durationRules[modelId];
    if (!rule) return;
    const input = durationInput(task);
    const legacy = task === "i2v" ? $("wanDuration") : null;
    const source = input?.value ?? legacy?.value ?? rule.recommended;
    const valid = forceRecommended ? rule.recommended : clamp(source, rule.min, rule.max);
    if (input) {
      input.min = String(rule.min);
      input.max = String(rule.max);
      input.step = "1";
      input.value = String(valid);
    }
    if (legacy) legacy.value = String(valid);
    const hint = task === "i2v" ? $("mmI2VGenericControls")?.querySelector(".hint") : $("mm-t2v-note");
    const text = `${modelId} 时长范围：${rule.min}–${rule.max} 秒；推荐先用 ${rule.recommended} 秒。`;
    if (hint) {
      if (task === "t2v") {
        const base = hint.textContent.split(" · 时长适配：")[0];
        hint.textContent = `${base} · 时长适配：${text}`;
      } else hint.textContent = text;
    }
  }

  function clearFalseDurationFailuresOnce() {
    const migrationKey = "moark_video_duration_runtime_v3";
    try {
      if (localStorage.getItem(migrationKey) === "1") return;
      for (const task of ["i2v", "t2v"]) {
        for (const modelId of Object.keys(CONFIG.durationRules)) {
          const key = `moark_model_health_v1:${task}:${modelId}`;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.state === "fail" && /duration|时长|参数范围/i.test(parsed?.detail || "")) localStorage.removeItem(key);
          } catch {}
        }
      }
      localStorage.setItem(migrationKey, "1");
    } catch {}
  }

  function localTestKey(task, modelId) {
    return `moark_model_health_v1:${task}:${modelId}`;
  }

  function readLocalTest(task, modelId) {
    try {
      const raw = localStorage.getItem(localTestKey(task, modelId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function writeLocalTest(task, modelId, state, detail = "") {
    if (!modelId || modelId === "__custom__") return;
    try { localStorage.setItem(localTestKey(task, modelId), JSON.stringify({ state, detail, at: Date.now() })); } catch {}
    decorateSelect(task);
    refreshHealth(task);
  }

  function staticStatus(task, modelId) {
    if (modelId === "__custom__") return { state: "custom", text: "自定义", detail: "按自定义 Endpoint / 参数调用" };
    return CONFIG.staticStatus[task]?.[modelId] || { state: "adapted", text: "待实测", detail: "已加入兼容层，尚未在当前浏览器确认" };
  }

  function effectiveStatus(task, modelId) {
    const local = readLocalTest(task, modelId);
    if (local?.state === "pass") return { state: "pass", text: "本机已通过", detail: local.detail || "最近一次调用成功" };
    if (local?.state === "fail") return { state: "fail", text: "最近失败", detail: local.detail || "最近一次调用失败" };
    return staticStatus(task, modelId);
  }

  function statusIcon(state) {
    if (["verified", "pass"].includes(state)) return "✅";
    if (state === "fail") return "❌";
    if (state === "experimental") return "🧪";
    if (state === "custom") return "⚙️";
    return "🟡";
  }

  function makeCatalogOption(task, item, tag) {
    const option = document.createElement("option");
    option.value = item.id;
    const base = `${item.label} · ${tag} · ${item.note}`;
    option.dataset.mmBaseText = base;
    option.textContent = `${statusIcon(effectiveStatus(task, item.id).state)} ${base}`;
    return option;
  }

  function makeCatalogGroup(task, label, items, tag) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const item of items) group.appendChild(makeCatalogOption(task, item, tag));
    return group;
  }

  function catalogAllowed(task) {
    const conf = CONFIG.videoCatalog[task];
    return new Set([...conf.recommended.map((m) => m.id), ...conf.optional.map((m) => m.id), "__custom__"]);
  }

  function rebuildVideoCatalog(task) {
    const select = $(SELECT_IDS[task]);
    const conf = CONFIG.videoCatalog[task];
    if (!select || !conf) return;
    const previous = select.value;
    enforcingCatalog.add(select);
    select.innerHTML = "";
    select.appendChild(makeCatalogGroup(task, "推荐体验", conf.recommended, "推荐体验"));
    if (conf.optional.length) select.appendChild(makeCatalogGroup(task, "备选模型", conf.optional, "备选"));
    const customGroup = document.createElement("optgroup");
    customGroup.label = "自定义";
    const custom = document.createElement("option");
    custom.value = "__custom__";
    custom.dataset.mmBaseText = "自定义模型…";
    custom.textContent = "⚙️ 自定义模型…";
    customGroup.appendChild(custom);
    select.appendChild(customGroup);
    const allowed = catalogAllowed(task);
    const next = allowed.has(previous) && [...select.options].some((o) => o.value === previous) ? previous : conf.fallback;
    select.value = next;
    try {
      const storageKey = task === "i2v" ? "moark_model_i2v" : "moark_model_t2v";
      if (!allowed.has(localStorage.getItem(storageKey))) localStorage.setItem(storageKey, next);
    } catch {}
    select.dispatchEvent(new Event("change"));
    setTimeout(() => enforcingCatalog.delete(select), 0);
  }

  function observeExternalModelChanges(task) {
    const select = $(SELECT_IDS[task]);
    if (!select || select.dataset.curatedCatalogObserver === "1") return;
    select.dataset.curatedCatalogObserver = "1";
    const allowed = catalogAllowed(task);
    new MutationObserver(() => {
      if (enforcingCatalog.has(select)) return;
      const values = [...select.options].map((o) => o.value);
      const unknown = values.some((id) => !allowed.has(id));
      const missing = CONFIG.videoCatalog[task].recommended.some((m) => !values.includes(m.id));
      if (unknown || missing) rebuildVideoCatalog(task);
    }).observe(select, { childList: true, subtree: true });
  }

  function addTrialNotice(task) {
    const box = $(SELECT_IDS[task])?.closest(".mm-model-box");
    if (!box || box.querySelector(`[data-video-trial-notice="${task}"]`)) return;
    const notice = document.createElement("div");
    notice.dataset.videoTrialNotice = task;
    notice.className = "hint";
    notice.style.marginTop = "10px";
    notice.textContent = "ℹ 已按当前 Gitee 视频生成页精选模型。截图中的这些模型可在 Gitee 页面进行免费体验；通过本工具直接调用 API 时，是否消耗体验额度或产生费用仍以 Gitee 当前账户/API 规则为准。";
    box.appendChild(notice);
  }

  function decorateSelect(task) {
    const select = $(SELECT_IDS[task]);
    if (!select) return;
    for (const option of select.options) {
      if (!option.dataset.mmBaseText) option.dataset.mmBaseText = option.textContent.replace(/^[✅❌🧪⚙️🟡]\s*/, "");
      option.textContent = `${statusIcon(effectiveStatus(task, option.value).state)} ${option.dataset.mmBaseText}`;
    }
  }

  function refreshHealth(task) {
    const el = $(`mmHealth-${task}`);
    if (!el) return;
    const st = effectiveStatus(task, currentModelId(task));
    el.className = `mm-health mm-health-${st.state}`;
    el.innerHTML = `<strong>${statusIcon(st.state)} ${st.text}</strong><span>${st.detail}</span>`;
  }

  function inspectNewOutput(before) {
    const items = [...document.querySelectorAll("#output .item")].filter((item) => !before.has(item));
    const error = items.find((item) => /错误|失败|error|failed/i.test(item.querySelector("h3")?.textContent || ""));
    const media = items.find((item) => item.querySelector("img,video"));
    if (error) return { state: "fail", detail: error.querySelector(".meta")?.textContent || error.textContent.slice(0, 180) };
    if (media) return { state: "pass", detail: "最近一次完整生成成功" };
    return { state: "unknown", detail: "未发现明确结果" };
  }

  function addHealthRow(task, buttonText, noteText) {
    const box = $(SELECT_IDS[task])?.closest(".mm-model-box");
    if (!box || $(`mmHealth-${task}`)) return;
    const row = document.createElement("div");
    row.className = "mm-health-row";
    row.innerHTML = `<div id="mmHealth-${task}" class="mm-health"></div><button type="button" class="btn" id="mmTest-${task}">${buttonText}</button><span class="hint mm-test-note">${noteText}</span>`;
    box.appendChild(row);
  }

  async function runModelDiagnostic(task) {
    if (!$("apiKey")?.value?.trim()) return addInfo("模型检测未开始", "请先输入 Gitee AI API Key");
    const testBtn = $(`mmTest-${task}`);
    if (testBtn) testBtn.disabled = true;
    try {
      if (["i2v", "t2v"].includes(task)) {
        const modelId = currentModelId(task);
        const ok = window.confirm(`将真实提交 ${modelId} 视频生成任务。Gitee 页面支持免费体验，但 API 调用可能消耗体验额度或产生费用。是否继续？`);
        if (!ok) return;
      }
      if (task === "t2i") {
        const prompt = $("zPrompt");
        const n = $("zN");
        const oldPrompt = prompt?.value || "";
        const oldN = n?.value || "1";
        if (prompt && !prompt.value.trim()) prompt.value = "A red ceramic sphere on a clean white studio background, realistic lighting";
        if (n) n.value = "1";
        await $(BUTTON_IDS.t2i)?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt;
        if (n) n.value = oldN;
        return;
      }
      if (task === "i2v") {
        if (!$("wanImg")?.files?.[0]) return addInfo("图生视频模型检测未开始", "请先上传一张测试图片，再点击检测当前模型");
        const prompt = $("wanPrompt");
        const oldPrompt = prompt?.value || "";
        const oldDuration = $("mmI2VDuration")?.value;
        if (prompt && !prompt.value.trim()) prompt.value = "Slow cinematic camera push-in, subtle natural motion, stable subject";
        const rule = CONFIG.durationRules[currentModelId("i2v")];
        if (rule && $("mmI2VDuration")) $("mmI2VDuration").value = String(rule.recommended);
        syncGenericI2VToLegacy();
        await $(BUTTON_IDS.i2v)?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt;
        if ($("mmI2VDuration") && oldDuration != null) $("mmI2VDuration").value = oldDuration;
        return;
      }
      if (task === "t2v") {
        const prompt = $("hyPrompt");
        const oldPrompt = prompt?.value || "";
        const oldFrames = $("hyFrames")?.value;
        const oldDuration = $("mmT2VDuration")?.value;
        if (prompt && !prompt.value.trim()) prompt.value = "A red paper airplane glides slowly through a bright studio, smooth camera movement";
        if (currentModelId("t2v") === "HunyuanVideo-1.5") {
          if ($("hyFrames")) $("hyFrames").value = "81";
        } else {
          const rule = CONFIG.durationRules[currentModelId("t2v")];
          if (rule && $("mmT2VDuration")) $("mmT2VDuration").value = String(rule.recommended);
        }
        await $(BUTTON_IDS.t2v)?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt;
        if ($("hyFrames") && oldFrames != null) $("hyFrames").value = oldFrames;
        if ($("mmT2VDuration") && oldDuration != null) $("mmT2VDuration").value = oldDuration;
      }
    } finally {
      if (testBtn) testBtn.disabled = false;
      refreshHealth(task);
    }
  }

  function syncWanAutoFrames() {
    if (!$("wanAutoFrames")?.checked) return;
    const fps = Math.max(1, Math.min(60, Number.parseInt($("wanFps")?.value || "24", 10) || 24));
    if ($("wanFrames")) $("wanFrames").value = String(Math.max(1, Math.min(300, fps * 5)));
  }

  async function ensureZip() {
    if (window.JSZip) return window.JSZip;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error("加载 JSZip 失败"));
    });
    return window.JSZip;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function zipVideos(items) {
    if (!items.length) return;
    const JSZip = await ensureZip();
    const zip = new JSZip();
    for (const item of items) zip.file(item.name, item.blob);
    downloadBlob(await zip.generateAsync({ type: "blob" }), `wan_segments_${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}.zip`);
  }

  async function runWanSegments(original, event, requested) {
    const input = $("wanDuration");
    const originalDuration = input?.value || "5";
    const count = Math.max(1, Math.ceil(requested / 5));
    const zipItems = [];
    addInfo("Wan2.2 长视频分段模式", `总时长=${requested}s · 分段数=${count} · 每段最多5s`);
    try {
      for (let i = 0; i < count; i++) {
        const remaining = Math.max(0.5, Math.min(5, requested - i * 5));
        if (input) input.value = String(remaining);
        syncWanAutoFrames();
        const before = new Set(document.querySelectorAll("#output video"));
        if (typeof window.setStatus === "function") window.setStatus(`Wan2.2 分段 ${i + 1}/${count} 生成中…`);
        await original.call($(BUTTON_IDS.i2v), event);
        const fresh = [...document.querySelectorAll("#output video")].find((v) => !before.has(v));
        if (!fresh?.src) throw new Error(`Wan2.2 第 ${i + 1}/${count} 段没有生成视频，已停止后续分段`);
        if ($("wanZipSegments")?.checked) {
          const res = await fetch(fresh.src);
          if (res.ok) zipItems.push({ name: `wan_segment_${String(i + 1).padStart(2, "0")}.mp4`, blob: await res.blob() });
        }
      }
      if ($("wanZipSegments")?.checked && zipItems.length > 1) {
        if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段完成，正在打包 ZIP…");
        await zipVideos(zipItems);
        addInfo("Wan2.2 分段 ZIP 已生成", `已打包 ${zipItems.length} 个视频片段`);
      }
      if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段生成完成", "ok");
    } finally {
      if (input) input.value = originalDuration;
    }
  }

  function wrapGenerateButton(task) {
    const button = $(BUTTON_IDS[task]);
    if (!button || typeof button.onclick !== "function" || button.dataset.modelRuntimeWrapped === "1") return;
    const original = button.onclick;
    button.dataset.modelRuntimeWrapped = "1";
    button.onclick = async function (event) {
      rememberKeyNow();
      if (task === "i2v") {
        syncWanAutoFrames();
        applyDurationRule("i2v");
        if (currentModelId("i2v") !== "Wan2_2-I2V-A14B") syncGenericI2VToLegacy();
      }
      if (task === "t2v") applyDurationRule("t2v");
      const modelId = currentModelId(task);
      const before = new Set(document.querySelectorAll("#output .item"));
      setLoading(true);
      button.disabled = true;
      try {
        if (task === "i2v" && modelId === "Wan2_2-I2V-A14B") {
          const requested = Number.parseFloat($("wanDuration")?.value || "5") || 5;
          if (requested > 5) await runWanSegments(original, event, requested);
          else await original.call(this, event);
        } else {
          await original.call(this, event);
        }
      } catch (e) {
        addInfo(`${task === "i2v" ? "图生视频" : "模型"}运行错误`, String(e?.message || e));
      } finally {
        button.disabled = false;
        setLoading(false);
        const detected = inspectNewOutput(before);
        if (["pass", "fail"].includes(detected.state)) writeLocalTest(task, modelId, detected.state, detected.detail);
      }
    };
  }

  function preferVerifiedDefaults() {
    try {
      const migrationKey = "moark_verified_defaults_v3";
      if (localStorage.getItem(migrationKey) === "1") return;
      const t2i = $("mmT2IModel");
      const t2v = $("mmT2VModel");
      if (!localStorage.getItem("moark_model_t2i") && t2i && [...t2i.options].some((o) => o.value === "z-image-turbo")) {
        t2i.value = "z-image-turbo";
        t2i.dispatchEvent(new Event("change"));
      }
      if (!localStorage.getItem("moark_model_t2v") && t2v && [...t2v.options].some((o) => o.value === "HunyuanVideo-1.5")) {
        t2v.value = "HunyuanVideo-1.5";
        t2v.dispatchEvent(new Event("change"));
      }
      localStorage.setItem(migrationKey, "1");
    } catch {}
  }

  function injectStyle() {
    if ($("modelRuntimeStyle")) return;
    const style = document.createElement("style");
    style.id = "modelRuntimeStyle";
    style.textContent = `
      .mm-health-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:12px 0 4px; padding-top:12px; border-top:1px dashed rgba(128,128,128,.25); }
      .mm-health { display:flex; gap:8px; align-items:center; min-width:220px; padding:8px 10px; border-radius:10px; background:rgba(128,128,128,.07); }
      .mm-health strong { white-space:nowrap; }
      .mm-health span { font-size:12px; opacity:.8; }
      .mm-health-verified,.mm-health-pass { background:rgba(34,197,94,.10); }
      .mm-health-fail { background:rgba(239,68,68,.10); }
      .mm-health-experimental { background:rgba(245,158,11,.10); }
      .mm-dynamic-controls { margin:12px 0 4px; padding:12px; border-radius:10px; background:rgba(128,128,128,.06); }
      .mm-test-note { margin:0 !important; }
      .mm-legend { display:flex; gap:12px; flex-wrap:wrap; margin:8px 0 0; font-size:12px; opacity:.85; }
    `;
    document.head.appendChild(style);
  }

  function addLegend() {
    const syncStatus = $("mmSyncStatus");
    if (!syncStatus || $("mmStatusLegend")) return;
    const legend = document.createElement("div");
    legend.id = "mmStatusLegend";
    legend.className = "mm-legend";
    legend.innerHTML = `<span>✅ 已验证/本机通过</span><span>🟡 已适配待实测</span><span>🧪 实验模型</span><span>❌ 最近测试失败</span>`;
    syncStatus.insertAdjacentElement("afterend", legend);
  }

  function bindModelChanges() {
    $("mmT2IModel")?.addEventListener("change", () => { refillT2ISizes(); decorateSelect("t2i"); updateT2IParameterUi(); });
    $("mmI2VModel")?.addEventListener("change", () => { applyVideoEndpointProfile(); decorateSelect("i2v"); updateI2VParameterUi(); applyDurationRule("i2v", { forceRecommended: true }); });
    $("mmT2VModel")?.addEventListener("change", () => { decorateSelect("t2v"); updateT2VParameterUi(); applyDurationRule("t2v", { forceRecommended: true }); });
    $("mmEditModel")?.addEventListener("change", () => decorateSelect("edit"));
  }

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    clearFalseDurationFailuresOnce();
    preferVerifiedDefaults();
    rebuildVideoCatalog("i2v");
    rebuildVideoCatalog("t2v");
    observeExternalModelChanges("i2v");
    observeExternalModelChanges("t2v");
    createI2VGenericControls();
    syncWanAutoFrames();
    refillT2ISizes();
    applyVideoEndpointProfile();
    applyDurationRule("i2v");
    applyDurationRule("t2v");
    addHealthRow("t2i", "检测当前文生图模型", "会实际生成 1 张测试图");
    addHealthRow("i2v", "检测当前图生视频模型", "需先上传图片，会实际调用 API");
    addHealthRow("t2v", "检测当前文生视频模型", "会提交短视频任务，可能消耗体验额度");
    addTrialNotice("i2v");
    addTrialNotice("t2v");
    addLegend();
    for (const task of ["t2i", "edit", "i2v", "t2v"]) decorateSelect(task);
    updateT2IParameterUi();
    updateI2VParameterUi();
    updateT2VParameterUi();
    bindModelChanges();
    $("mmTest-t2i")?.addEventListener("click", () => runModelDiagnostic("t2i"));
    $("mmTest-i2v")?.addEventListener("click", () => runModelDiagnostic("i2v"));
    $("mmTest-t2v")?.addEventListener("click", () => runModelDiagnostic("t2v"));
    for (const task of ["t2i", "edit", "i2v", "t2v"]) wrapGenerateButton(task);
    refreshHealth("t2i");
    refreshHealth("i2v");
    refreshHealth("t2v");
  });
})();
