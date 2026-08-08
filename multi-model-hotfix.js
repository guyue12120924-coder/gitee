(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const nativeFetch = window.fetch.bind(window);

  const QWEN_IMAGE_MODELS = new Set(["Qwen-Image-2512", "Qwen-Image"]);
  const Z_IMAGE_MODELS = new Set(["z-image-turbo", "Z-Image"]);
  const GENERIC_VIDEO_I2V_MODELS = new Set([
    "ViduQ3-Pro",
    "ViduQ2-Pro",
    "ViduQ3-Turbo",
    "ViduQ2-Turbo",
    "HappyHorse-1.0",
    "HappyHorse-1.1",
    "LTX-2",
    "Wan2.7",
  ]);

  const QWEN_SIZE_BUCKETS = [
    { ratio: 1, width: 1328, height: 1328 },
    { ratio: 16 / 9, width: 1664, height: 928 },
    { ratio: 9 / 16, width: 928, height: 1664 },
    { ratio: 4 / 3, width: 1472, height: 1104 },
    { ratio: 3 / 4, width: 1104, height: 1472 },
    { ratio: 3 / 2, width: 1584, height: 1056 },
    { ratio: 2 / 3, width: 1056, height: 1584 },
  ];

  const T2I_SIZE_PRESETS = {
    qwen: [
      ["1:1 (1328x1328)", "1328x1328"],
      ["16:9 (1664x928)", "1664x928"],
      ["9:16 (928x1664)", "928x1664"],
      ["4:3 (1472x1104)", "1472x1104"],
      ["3:4 (1104x1472)", "1104x1472"],
      ["3:2 (1584x1056)", "1584x1056"],
      ["2:3 (1056x1584)", "1056x1584"],
    ],
    zimage: [
      ["1:1 (2048x2048)", "2048x2048"],
      ["1:1 (1024x1024)", "1024x1024"],
      ["3:4 (768x1024)", "768x1024"],
      ["4:3 (1024x768)", "1024x768"],
      ["16:9 (1024x576)", "1024x576"],
      ["9:16 (576x1024)", "576x1024"],
    ],
    common: [
      ["1:1 (1024x1024)", "1024x1024"],
      ["3:4 (768x1024)", "768x1024"],
      ["4:3 (1024x768)", "1024x768"],
      ["16:9 (1024x576)", "1024x576"],
      ["9:16 (576x1024)", "576x1024"],
    ],
  };

  function rememberKeyNow() {
    const key = $("apiKey")?.value?.trim();
    if (!key) return;
    try {
      if ($("rememberKey")?.checked) localStorage.setItem("moark_api_key", key);
    } catch {}
  }

  function setLoading(show) {
    if (typeof window.showLoading === "function") {
      window.showLoading(show);
      return;
    }
    const el = $("globalLoading");
    if (el) el.style.display = show ? "block" : "none";
  }

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

  function splitSize(size) {
    const m = String(size || "").match(/^(\d+)[x*](\d+)$/i);
    if (!m) return null;
    return { width: Number(m[1]), height: Number(m[2]) };
  }

  function nearestQwenBucket(parsed) {
    if (!parsed || !parsed.width || !parsed.height) return QWEN_SIZE_BUCKETS[0];
    const ratio = parsed.width / parsed.height;
    return QWEN_SIZE_BUCKETS.reduce((best, item) => (
      Math.abs(item.ratio - ratio) < Math.abs(best.ratio - ratio) ? item : best
    ), QWEN_SIZE_BUCKETS[0]);
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

    if (QWEN_IMAGE_MODELS.has(model)) {
      const bucket = nearestQwenBucket(parsed);
      const qwen = { ...body, size: `${bucket.width}*${bucket.height}` };
      variants.push(qwen);

      const noN = { ...qwen };
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

    if (parsed && !Z_IMAGE_MODELS.has(model)) {
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
    if (res.ok) return false;
    if (![400, 404, 405, 415, 422].includes(res.status)) return false;
    let text = "";
    try { text = await res.clone().text(); } catch {}
    if (!text) return true;
    return /参数|parameter|invalid|unsupported|size|field|format|request|method|endpoint/i.test(text);
  }

  async function fetchWithJsonVariants(input, init, variants) {
    let last = null;
    for (const body of variants) {
      const res = await nativeFetch(input, { ...init, body: JSON.stringify(body) });
      last = res;
      if (res.ok) return res;
      if (!(await shouldRetryResponse(res))) return res;
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

  function t2iProfile(modelId) {
    if (QWEN_IMAGE_MODELS.has(modelId)) return "qwen";
    if (Z_IMAGE_MODELS.has(modelId)) return "zimage";
    return "common";
  }

  function refillT2ISizes() {
    const modelId = $("mmT2IModel")?.value || "z-image-turbo";
    const res = $("zRes");
    if (!res) return;
    const profile = t2iProfile(modelId);
    const options = T2I_SIZE_PRESETS[profile];
    const old = res.value;
    res.innerHTML = "";
    for (const [label] of options) {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      res.appendChild(option);
    }
    const oldDims = splitSize((old.match(/(\d+[x*]\d+)/) || [])[1]);
    const compatible = oldDims && [...res.options].find((o) => o.value.includes(`${oldDims.width}x${oldDims.height}`));
    if (compatible) res.value = compatible.value;
    else res.value = options[0][0];

    const note = $("mm-t2i-note");
    if (note) {
      const base = note.textContent.split(" · 参数适配：")[0];
      const desc = profile === "qwen"
        ? "自动使用 Qwen 原生分辨率桶，并把 size 转为 1328*1328 / 1664*928 等格式"
        : profile === "zimage"
          ? "沿用已验证的 OpenAI 风格 size=1024x1024"
          : "先用标准 size，参数不兼容时自动尝试精简/宽高格式";
      note.textContent = `${base} · 参数适配：${desc}`;
    }
  }

  function addModelOption(selectId, id, text, beforeCustom = true) {
    const sel = $(selectId);
    if (!sel || [...sel.options].some((o) => o.value === id)) return;
    let group = [...sel.querySelectorAll("optgroup")].find((g) => g.label === "Gitee 页面可见 / 兼容适配");
    if (!group) {
      group = document.createElement("optgroup");
      group.label = "Gitee 页面可见 / 兼容适配";
      const custom = sel.querySelector('option[value="__custom__"]');
      if (beforeCustom && custom) sel.insertBefore(group, custom);
      else sel.appendChild(group);
    }
    const option = document.createElement("option");
    option.value = id;
    option.textContent = text;
    group.appendChild(option);
  }

  function setEndpointInputs(task, endpoint) {
    const normal = $(`mm-${task}-endpoint`);
    const advanced = $(`mm-${task}-endpoint-advanced`);
    if (normal) normal.value = endpoint;
    if (advanced) advanced.value = endpoint;
  }

  function applyVideoEndpointProfile() {
    const i2vModel = $("mmI2VModel")?.value;
    if (!i2vModel || i2vModel === "__custom__") return;
    if (i2vModel === "Wan2_2-I2V-A14B") {
      setEndpointInputs("i2v", "async/videos/image-to-video");
    } else if (GENERIC_VIDEO_I2V_MODELS.has(i2vModel)) {
      setEndpointInputs("i2v", "async/videos/generations");
    }
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
    const blob = await zip.generateAsync({ type: "blob" });
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    downloadBlob(blob, `wan_segments_${stamp}.zip`);
  }

  function syncWanAutoFrames() {
    if (!$("wanAutoFrames")?.checked) return;
    const fps = Math.max(1, Math.min(60, Number.parseInt($("wanFps")?.value || "24", 10) || 24));
    const frames = Math.max(1, Math.min(300, fps * 5));
    if ($("wanFrames")) $("wanFrames").value = String(frames);
  }

  function markExperimentalModels() {
    const ids = ["Wan2.7", "LTX-2"];
    for (const selectId of ["mmI2VModel", "mmT2VModel"]) {
      const sel = $(selectId);
      if (!sel) continue;
      for (const id of ids) {
        const opt = [...sel.options].find((o) => o.value === id);
        if (opt && !opt.textContent.includes("实验")) {
          opt.textContent += " · 实验/需核对当前模型页";
        }
      }
    }
  }

  function preferVerifiedDefaults() {
    try {
      const migrationKey = "moark_verified_defaults_v2";
      const migrated = localStorage.getItem(migrationKey) === "1";

      const t2iSaved = localStorage.getItem("moark_model_t2i");
      const i2vSaved = localStorage.getItem("moark_model_i2v");
      const t2vSaved = localStorage.getItem("moark_model_t2v");

      const t2i = $("mmT2IModel");
      const i2v = $("mmI2VModel");
      const t2v = $("mmT2VModel");

      const oldT2IAutoDefaults = new Set([null, "", "Qwen-Image-2512"]);
      if (!migrated && oldT2IAutoDefaults.has(t2iSaved) && t2i && [...t2i.options].some((o) => o.value === "z-image-turbo")) {
        t2i.value = "z-image-turbo";
        t2i.dispatchEvent(new Event("change"));
      } else if (!t2iSaved && t2i && [...t2i.options].some((o) => o.value === "z-image-turbo")) {
        t2i.value = "z-image-turbo";
        t2i.dispatchEvent(new Event("change"));
      }

      const oldVideoAutoDefaults = new Set([null, "", "ViduQ3-Pro"]);
      if (!migrated && oldVideoAutoDefaults.has(i2vSaved) && i2v && [...i2v.options].some((o) => o.value === "Wan2_2-I2V-A14B")) {
        i2v.value = "Wan2_2-I2V-A14B";
        i2v.dispatchEvent(new Event("change"));
      } else if (!i2vSaved && i2v && [...i2v.options].some((o) => o.value === "Wan2_2-I2V-A14B")) {
        i2v.value = "Wan2_2-I2V-A14B";
        i2v.dispatchEvent(new Event("change"));
      }

      if (!migrated && oldVideoAutoDefaults.has(t2vSaved) && t2v && [...t2v.options].some((o) => o.value === "HunyuanVideo-1.5")) {
        t2v.value = "HunyuanVideo-1.5";
        t2v.dispatchEvent(new Event("change"));
      } else if (!t2vSaved && t2v && [...t2v.options].some((o) => o.value === "HunyuanVideo-1.5")) {
        t2v.value = "HunyuanVideo-1.5";
        t2v.dispatchEvent(new Event("change"));
      }

      localStorage.setItem(migrationKey, "1");
    } catch {}
  }

  function wrapSimpleButton(id) {
    const button = $(id);
    if (!button || typeof button.onclick !== "function" || button.dataset.mmHotfix === "1") return;
    const original = button.onclick;
    button.dataset.mmHotfix = "1";
    button.onclick = async function (event) {
      rememberKeyNow();
      setLoading(true);
      button.disabled = true;
      try {
        return await original.call(this, event);
      } finally {
        button.disabled = false;
        setLoading(false);
      }
    };
  }

  function wrapWanButton() {
    const button = $("btnWanRun");
    if (!button || typeof button.onclick !== "function" || button.dataset.mmHotfix === "1") return;
    const original = button.onclick;
    button.dataset.mmHotfix = "1";

    button.onclick = async function (event) {
      rememberKeyNow();
      syncWanAutoFrames();
      setLoading(true);
      button.disabled = true;

      const durationInput = $("wanDuration");
      const originalDuration = durationInput?.value || "5";
      const requested = Number.parseFloat(originalDuration) || 5;
      const selectedModel = $("mmI2VModel")?.value;
      const needsSegments = selectedModel === "Wan2_2-I2V-A14B" && requested > 5;

      try {
        if (!needsSegments) return await original.call(this, event);

        const count = Math.max(1, Math.ceil(requested / 5));
        const zipItems = [];
        addInfo("Wan2.2 长视频分段模式", `总时长=${requested}s · 分段数=${count} · 每段最多5s`);

        for (let i = 0; i < count; i++) {
          const remaining = Math.max(0.5, Math.min(5, requested - i * 5));
          if (durationInput) durationInput.value = String(remaining);
          syncWanAutoFrames();

          const before = new Set(document.querySelectorAll("#output video"));
          if (typeof window.setStatus === "function") {
            window.setStatus(`Wan2.2 分段 ${i + 1}/${count} 生成中…`);
          }

          await original.call(this, event);

          const fresh = [...document.querySelectorAll("#output video")].find((v) => !before.has(v));
          if (!fresh?.src) {
            throw new Error(`Wan2.2 第 ${i + 1}/${count} 段没有生成视频，已停止后续分段`);
          }

          if ($("wanZipSegments")?.checked) {
            const res = await fetch(fresh.src);
            if (res.ok) {
              zipItems.push({
                name: `wan_segment_${String(i + 1).padStart(2, "0")}.mp4`,
                blob: await res.blob(),
              });
            }
          }
        }

        if ($("wanZipSegments")?.checked && zipItems.length > 1) {
          if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段完成，正在打包 ZIP…");
          await zipVideos(zipItems);
          addInfo("Wan2.2 分段 ZIP 已生成", `已打包 ${zipItems.length} 个视频片段`);
        }

        if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段生成完成", "ok");
      } catch (e) {
        if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段生成失败", "err");
        addInfo("Wan2.2 分段错误", String(e?.message || e));
      } finally {
        if (durationInput) durationInput.value = originalDuration;
        button.disabled = false;
        setLoading(false);
      }
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    preferVerifiedDefaults();
    addModelOption("mmI2VModel", "HappyHorse-1.1", "HappyHorse-1.1 · Gitee 页面可见 · generations 适配");
    markExperimentalModels();
    syncWanAutoFrames();
    refillT2ISizes();
    applyVideoEndpointProfile();

    $("mmT2IModel")?.addEventListener("change", refillT2ISizes);
    $("mmI2VModel")?.addEventListener("change", applyVideoEndpointProfile);

    wrapSimpleButton("btnZRun");
    wrapSimpleButton("btnEditRun");
    wrapWanButton();
    wrapSimpleButton("btnHyRun");
  });
})();
