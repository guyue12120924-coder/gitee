(() => {
  "use strict";

  const REGISTRY = window.GiteeModelRegistry;
  const ADAPTERS = window.GiteeModelAdapters;
  if (!REGISTRY || !ADAPTERS) throw new Error("Model Registry / Adapter layer must load before multi-model.js");

  const TASKS = REGISTRY.tasks;
  const $ = (id) => document.getElementById(id);

  function status(text, kind = "info") {
    if (typeof window.setStatus === "function") return window.setStatus(text, kind);
    const badge = $("statusBadge");
    if (badge) badge.textContent = text;
  }

  function ts() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  async function readJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { _text: text }; }
  }

  async function apiFetch(path, init = {}) {
    return fetch(`/api/${String(path || "").replace(/^\/+/, "")}`, init);
  }

  function apiKey() {
    const key = $("apiKey")?.value?.trim();
    if (!key) throw new Error("请输入 Gitee AI API Token");
    return key;
  }

  function parseExtra(task) {
    const raw = $(`mm-${task}-extra`)?.value?.trim();
    if (!raw) return {};
    let obj;
    try { obj = JSON.parse(raw); }
    catch { throw new Error("附加参数 JSON 格式不正确"); }
    if (!obj || Array.isArray(obj) || typeof obj !== "object") throw new Error("附加参数必须是 JSON 对象");
    return obj;
  }

  function appendExtraForm(fd, extra) {
    for (const [k, v] of Object.entries(extra || {})) {
      if (v === undefined || v === null) continue;
      fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }

  function addOutput({ title, meta = "", raw = null, element = null, download = null, openUrl = null }) {
    if (typeof window.addOutputItem === "function") return window.addOutputItem({ title, meta, rawJson: raw, element, download, openUrl });
    const out = $("output");
    if (!out) return;
    const box = document.createElement("div");
    box.className = "item";
    const h = document.createElement("h3"); h.textContent = title; box.appendChild(h);
    if (meta) { const m = document.createElement("div"); m.className = "meta"; m.textContent = meta; box.appendChild(m); }
    if (element) box.appendChild(element);
    if (raw) { const pre = document.createElement("pre"); pre.textContent = JSON.stringify(raw, null, 2); box.appendChild(pre); }
    out.prepend(box);
  }

  async function fetchBlob(url) {
    const res = await fetch(`/dl?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`下载结果失败 HTTP ${res.status}`);
    const blob = await res.blob();
    return { blob, url: URL.createObjectURL(blob) };
  }

  async function resolveImageResult(url) {
    const raw = String(url || "").trim();
    if (!raw) throw new Error("图片结果 URL 为空");
    if (/^data:image\//i.test(raw)) return { url: raw, downloadUrl: raw, via: "data" };
    try {
      const proxied = await fetchBlob(raw);
      return { url: proxied.url, downloadUrl: proxied.url, via: "proxy" };
    } catch (error) {
      if (/^https:\/\//i.test(raw)) {
        console.warn("result proxy download failed; falling back to direct image URL", error);
        return { url: raw, downloadUrl: raw, via: "direct", warning: String(error?.message || error) };
      }
      throw error;
    }
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
      reader.readAsDataURL(file);
    });
  }

  async function pollTask(taskId, key, timeoutMs = 60 * 60 * 1000) {
    const start = Date.now();
    let n = 0;
    while (Date.now() - start < timeoutMs) {
      n += 1;
      status(`模型任务处理中… ${Math.floor((Date.now()-start)/1000)}s · 第 ${n} 次检查`);
      const res = await apiFetch(`task/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
      const j = await readJson(res);
      const st = j.status || j.state || "unknown";
      if (["success", "failed", "cancelled"].includes(st)) return { status: st, raw: j };
      if (!res.ok && res.status >= 400 && res.status < 500) return { status: "failed", raw: j };
      await new Promise((r) => setTimeout(r, 7000));
    }
    return { status: "timeout", raw: { status: "timeout" } };
  }

  function imageUrlFromResponse(j) { return j?.output?.file_url || j?.output?.url || j?.data?.[0]?.url || j?.images?.[0]?.url || null; }
  function imageB64FromResponse(j) { return j?.data?.[0]?.b64_json || j?.images?.[0]?.b64_json || null; }
  function videoUrlFromResponse(j) { return j?.output?.file_url || j?.output?.video_url || j?.output?.url || j?.data?.[0]?.url || j?.video?.url || null; }

  function responseMessage(j) {
    if (!j) return "";
    if (typeof j === "string") return j;
    return String(j?.message || j?.error?.message || j?.error || j?.detail || j?._text || "");
  }

  function isSafeCompatibilityRetry(res, j) {
    if (!res || res.ok) return false;
    if (![400, 404, 405, 415, 422].includes(res.status)) return false;
    const text = responseMessage(j).toLowerCase();
    if (!text) return true;
    return /参数|parameter|invalid|unsupported|unknown|missing|required|field|format|multipart|json|image|first_frame|image_url|size|resolution|duration|ratio|aspect|endpoint|method|not found|media type/.test(text);
  }

  function acceptedWithoutRecognizedResult(model, kind, last) {
    const code = last?.res?.status || "2xx";
    const endpoint = last?.endpoint || model.endpoint || "当前 Endpoint";
    return new Error(`${model.label} 已收到 HTTP ${code} 成功响应（${endpoint}），但返回中没有识别到 task_id 或${kind}结果。为避免重复提交并产生多个任务，已停止自动重试。请在“原始响应 / 调试信息”中查看实际返回结构。`);
  }

  function resolveAdapter(task, model) { return ADAPTERS.get(model?.adapter) || ADAPTERS.forModel(task, model?.id); }

  function currentModel(task) {
    const conf = TASKS[task];
    const sel = $(conf.selectId);
    if (!sel) throw new Error("模型选择器未初始化");
    if (sel.value === "__custom__") {
      const id = $(`mm-${task}-custom-id`)?.value?.trim();
      if (!id) throw new Error("请输入自定义模型 ID");
      const endpoint = $(`mm-${task}-endpoint`)?.value?.trim() || conf.defaultEndpoint;
      return { id, label: id, badge: "自定义", endpoint, adapter: null, profile: "custom" };
    }
    const model = REGISTRY.model(task, sel.value) || { id: sel.value, label: sel.value, adapter: REGISTRY.adapterId(task, sel.value) };
    const adapter = resolveAdapter(task, model);
    const endpoint = $(`mm-${task}-endpoint`)?.value?.trim() || model.endpoint || adapter?.defaultEndpoint || conf.defaultEndpoint;
    return { ...model, endpoint, adapterImpl: adapter, profile: adapter?.uiProfile || "generic" };
  }

  function rememberSelection(task) {
    const conf = TASKS[task];
    try {
      localStorage.setItem(conf.storageKey, $(conf.selectId)?.value || "");
      localStorage.setItem(`${conf.storageKey}_custom`, $(`mm-${task}-custom-id`)?.value || "");
      localStorage.setItem(`${conf.storageKey}_endpoint`, $(`mm-${task}-endpoint`)?.value || "");
    } catch {}
  }

  function groupLabel(key) { return REGISTRY.groupLabels[key] || "更多模型"; }

  function modelControl(task, title) {
    const conf = TASKS[task];
    const wrap = document.createElement("div");
    wrap.className = "mm-model-box";
    wrap.innerHTML = `
      <div class="grid2"><div><label class="lab">${title}</label><select id="${conf.selectId}" class="input"></select></div><div><label class="lab">模型说明</label><div id="mm-${task}-note" class="hint" style="margin-top:0;min-height:44px;display:flex;align-items:center"></div></div></div>
      <div id="mm-${task}-custom" style="display:none"><div class="grid2"><div><label class="lab">自定义模型 ID</label><input id="mm-${task}-custom-id" class="input" placeholder="填写 Gitee 当前模型 ID" /></div><div><label class="lab">API Endpoint（可选）</label><input id="mm-${task}-endpoint" class="input" value="${conf.defaultEndpoint}" /></div></div></div>
      <details style="margin:10px 0 16px"><summary style="cursor:pointer">高级：Endpoint / 附加 JSON 参数</summary><div class="grid2" style="margin-top:10px"><div><label class="lab">Endpoint 覆盖</label><input id="mm-${task}-endpoint-advanced" class="input" value="${conf.defaultEndpoint}" /></div><div><label class="lab">附加参数 JSON</label><textarea id="mm-${task}-extra" class="textarea" rows="3" placeholder='例如：{"seed":123}'></textarea></div></div></details>`;
    const panel = $(conf.panelId);
    const h2 = panel?.querySelector("h2");
    if (h2) h2.insertAdjacentElement("afterend", wrap);

    const sel = $(conf.selectId);
    for (const [groupKey, models] of REGISTRY.modelsByGroup(task)) {
      const og = document.createElement("optgroup");
      og.label = groupLabel(groupKey);
      for (const m of models) {
        const o = document.createElement("option");
        o.value = m.id;
        o.textContent = `${m.label} · ${m.badge || ""}`;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    const custom = document.createElement("option"); custom.value = "__custom__"; custom.textContent = "自定义模型…"; sel.appendChild(custom);

    try {
      const saved = localStorage.getItem(conf.storageKey);
      if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
      else if (conf.defaultModel && [...sel.options].some((o) => o.value === conf.defaultModel)) sel.value = conf.defaultModel;
      const customSaved = localStorage.getItem(`${conf.storageKey}_custom`);
      if (customSaved) $(`mm-${task}-custom-id`).value = customSaved;
    } catch {}

    const normalEndpoint = $(`mm-${task}-endpoint`);
    const advancedEndpoint = $(`mm-${task}-endpoint-advanced`);
    const endpointSaved = (() => { try { return localStorage.getItem(`${conf.storageKey}_endpoint`); } catch { return null; } })();
    if (endpointSaved) { normalEndpoint.value = endpointSaved; advancedEndpoint.value = endpointSaved; }

    const update = () => {
      const isCustom = sel.value === "__custom__";
      $(`mm-${task}-custom`).style.display = isCustom ? "block" : "none";
      const m = REGISTRY.model(task, sel.value);
      const adapter = m ? resolveAdapter(task, m) : null;
      $(`mm-${task}-note`).textContent = isCustom ? "自定义模式：请以 Gitee 当前模型页面展示的 model ID / Endpoint 为准。" : `${m?.badge || "Gitee 模型"} · Adapter=${m?.adapter || "generic"} · model=${m?.id || sel.value}`;
      if (!isCustom) {
        const ep = m?.endpoint || adapter?.defaultEndpoint || conf.defaultEndpoint;
        normalEndpoint.value = ep;
        advancedEndpoint.value = ep;
      }
      rememberSelection(task);
    };
    sel.addEventListener("change", update);
    $(`mm-${task}-custom-id`).addEventListener("change", () => rememberSelection(task));
    normalEndpoint.addEventListener("input", () => { advancedEndpoint.value = normalEndpoint.value; rememberSelection(task); });
    advancedEndpoint.addEventListener("input", () => { normalEndpoint.value = advancedEndpoint.value; rememberSelection(task); });
    update();
  }

  function sizeFromZ() {
    const text = $("zRes")?.value || "1024x1024";
    const m = text.match(/(\d+)x(\d+)/);
    return m ? `${m[1]}x${m[2]}` : "1024x1024";
  }

  async function runT2I() {
    const key = apiKey();
    const model = currentModel("t2i");
    const prompt = $("zPrompt")?.value?.trim();
    if (!prompt) throw new Error("请输入提示词");
    const n = Math.max(1, Math.min(4, Number.parseInt($("zN")?.value || "1", 10) || 1));
    const body = { prompt, model: model.id, n, size: sizeFromZ(), ...parseExtra("t2i") };
    status(`${model.label} 生成中…`);
    const res = await apiFetch(model.endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let j = await readJson(res);
    if (!res.ok) throw new Error(`${model.label} HTTP ${res.status}: ${j?._text || j?.message || JSON.stringify(j).slice(0,220)}`);
    if (!imageUrlFromResponse(j) && !imageB64FromResponse(j) && j.task_id) {
      const result = await pollTask(j.task_id, key);
      if (result.status !== "success") throw new Error(`${model.label} 任务 ${result.status}`);
      j = result.raw;
    }
    const items = Array.isArray(j.data) ? [...j.data] : Array.isArray(j.images) ? [...j.images] : [];
    if (!items.length && imageUrlFromResponse(j)) items.push({ url: imageUrlFromResponse(j) });
    if (!items.length && imageB64FromResponse(j)) items.push({ b64_json: imageB64FromResponse(j) });
    if (!items.length) throw new Error("API 返回成功，但没有发现图片数据");
    for (let i = 0; i < items.length; i++) {
      let objectUrl;
      let sourceUrl = null;
      let resultMode = "";
      if (items[i].url) {
        sourceUrl = items[i].url;
        const resolved = await resolveImageResult(sourceUrl);
        objectUrl = resolved.url;
        resultMode = resolved.via;
      } else if (items[i].b64_json) {
        const bytes = Uint8Array.from(atob(items[i].b64_json), (c) => c.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
        resultMode = "base64";
      } else continue;
      const img = document.createElement("img");
      img.src = objectUrl;
      if (sourceUrl) img.referrerPolicy = "no-referrer";
      const fallbackNote = resultMode === "direct" ? " · 结果代理失败，已使用原始图片直链" : "";
      addOutput({
        title: `${model.label} · 文生图 #${i+1}`,
        meta: `实际模型=${model.id} · Adapter=${model.adapter || "custom"} · size=${body.size}${fallbackNote}`,
        element: img,
        download: { href: objectUrl, filename: `${model.id.replace(/[^a-z0-9_-]+/gi,"-")}-${ts()}-${i+1}.png` },
        openUrl: sourceUrl,
      });
    }
    status(`${model.label} 生成成功`, "ok");
  }

  function buildEditForm(model, f1, f2, prompt, extra) {
    const fd = new FormData();
    fd.append("prompt", prompt); fd.append("model", model.id); fd.append("image", f1, f1.name); if (f2) fd.append("image", f2, f2.name);
    if (model.adapterImpl?.uiProfile === "qwen") {
      const steps = Math.max(1, Math.min(50, Number.parseInt($("editSteps")?.value || "4", 10) || 4));
      const guidance = Number.parseFloat($("editGuidance")?.value || "1") || 1;
      const types = [...document.querySelectorAll("input[name='editTaskType']:checked")].map((x) => x.value);
      fd.append("num_inference_steps", String(steps)); fd.append("guidance_scale", String(guidance)); for (const t of types) fd.append("task_types", t);
    }
    appendExtraForm(fd, extra);
    return fd;
  }

  async function runEdit() {
    const key = apiKey();
    const model = currentModel("edit");
    const f1 = $("editImg1")?.files?.[0], f2 = $("editImg2")?.files?.[0], prompt = $("editPrompt")?.value?.trim();
    if (!f1 || !prompt) throw new Error("至少上传图1并输入提示词；图2为可选参考图");
    const extra = parseExtra("edit");
    const endpoints = [...new Set([model.endpoint, "async/images/edits", "images/edits"].filter(Boolean))];
    let last = null;
    status(`${model.label} 创建编辑任务…`);
    for (const endpoint of endpoints) {
      const res = await apiFetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: buildEditForm(model, f1, f2, prompt, extra) });
      const j = await readJson(res);
      last = { res, j, endpoint, retryable: isSafeCompatibilityRetry(res, j) };
      if (res.ok || !last.retryable) break;
    }
    if (!last?.res?.ok) throw new Error(`${model.label} HTTP ${last?.res?.status || "?"}: ${last?.j?._text || last?.j?.message || JSON.stringify(last?.j || {}).slice(0,220)}`);
    let raw = last.j;
    if (!imageUrlFromResponse(raw) && !imageB64FromResponse(raw) && raw.task_id) { const result = await pollTask(raw.task_id, key); if (result.status !== "success") throw new Error(`${model.label} 任务 ${result.status}`); raw = result.raw; }
    let objectUrl; const fileUrl = imageUrlFromResponse(raw), b64 = imageB64FromResponse(raw);
    if (fileUrl) objectUrl = (await fetchBlob(fileUrl)).url;
    else if (b64) { const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" })); }
    else throw acceptedWithoutRecognizedResult(model, "图片", last);
    const img = document.createElement("img"); img.src = objectUrl;
    addOutput({ title: `${model.label} · 图像编辑输出`, meta: `实际模型=${model.id} · Adapter=${model.adapter || "custom"} · endpoint=${last.endpoint}`, raw, element: img, download: { href: objectUrl, filename: `${model.id.replace(/[^a-z0-9_-]+/gi,"-")}-${ts()}.png` }, openUrl: $("editOpenUrl")?.checked ? fileUrl : null });
    status(`${model.label} 编辑成功`, "ok");
  }

  function i2vBase() {
    const width = Number.parseInt($("wanW")?.value || "832", 10) || 832, height = Number.parseInt($("wanH")?.value || "480", 10) || 480;
    const duration = Number.parseFloat($("wanDuration")?.value || "5") || 5, fps = Number.parseInt($("wanFps")?.value || "24", 10) || 24;
    const frames = Number.parseInt($("wanFrames")?.value || String(fps * 5), 10) || fps * 5;
    const ratio = $("mmI2VRatio")?.value || (width >= height ? "16:9" : "9:16");
    const resolution = $("mmI2VResolution")?.value || (Math.max(width, height) >= 1200 ? "720P" : "480P");
    return { width, height, duration, fps, frames, ratio, resolution };
  }

  function buildI2VForm(model, image, prompt, extra, mode) {
    const p = i2vBase();
    const fd = new FormData(); fd.append("model", model.id); fd.append("prompt", prompt); fd.append("image", image, image.name);
    const neg = $("wanNeg")?.value?.trim(), seed = Number.parseInt($("wanSeed")?.value || "-1", 10);
    if (mode === "generic") {
      fd.append("resolution", p.resolution); fd.append("duration", String(p.duration)); fd.append("ratio", p.ratio);
      if (Number.isFinite(seed) && seed >= 0) fd.append("seed", String(seed)); if (neg) fd.append("negative_prompt", neg);
    } else {
      fd.append("width", String(p.width)); fd.append("height", String(p.height)); fd.append("num_frames", String(p.frames));
      fd.append("num_inference_steps", String(Number.parseInt($("wanSteps")?.value || "30", 10) || 30));
      fd.append("guidance_scale", String(Number.parseFloat($("wanGuidance")?.value || "5") || 5));
      if (Number.isFinite(seed) && seed >= 0) fd.append("seed", String(seed)); if (neg) fd.append("negative_prompt", neg);
      fd.append("watermark", $("wanWatermark")?.checked ? "true" : "false"); fd.append("prompt_extend", $("wanPromptExtend")?.checked ? "true" : "false");
    }
    appendExtraForm(fd, extra); return fd;
  }

  async function buildI2VJson(model, image, prompt, extra, imageField) {
    const p = i2vBase(), dataUrl = await fileToDataUrl(image), seed = Number.parseInt($("wanSeed")?.value || "-1", 10);
    return { model: model.id, prompt, [imageField]: dataUrl, resolution: p.resolution, duration: p.duration, ratio: p.ratio, ...(Number.isFinite(seed) && seed >= 0 ? { seed } : {}), ...extra };
  }

  async function runI2V() {
    const key = apiKey(), model = currentModel("i2v"), image = $("wanImg")?.files?.[0], prompt = $("wanPrompt")?.value?.trim();
    if (!image || !prompt) throw new Error("请选择图片并输入提示词");
    const extra = parseExtra("i2v"), firstMode = model.adapterImpl?.i2vFormMode || "generic";
    const formAttempts = [ { endpoint: model.endpoint, mode: firstMode }, { endpoint: model.endpoint, mode: firstMode === "wan" ? "generic" : "wan" }, { endpoint: "async/videos/image-to-video", mode: "generic" }, { endpoint: "async/videos/image-to-video", mode: "wan" }, { endpoint: "async/videos/generations", mode: "generic" } ];
    let last = null; const seen = new Set(); status(`${model.label} 创建图生视频任务…`);
    for (const a of formAttempts) {
      const sig = `${a.endpoint}:${a.mode}`; if (seen.has(sig)) continue; seen.add(sig);
      const res = await apiFetch(a.endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: buildI2VForm(model, image, prompt, extra, a.mode) });
      const j = await readJson(res);
      last = { res, j, endpoint: a.endpoint, strategy: `multipart/${a.mode}`, retryable: isSafeCompatibilityRetry(res, j) };
      if (res.ok || !last.retryable) break;
    }
    if (last && !last.res.ok && last.retryable) {
      for (const imageField of ["image", "first_frame"]) {
        const endpoint = model.endpoint || "async/videos/image-to-video", body = await buildI2VJson(model, image, prompt, extra, imageField);
        const res = await apiFetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await readJson(res);
        last = { res, j, endpoint, strategy: `json/${imageField}`, retryable: isSafeCompatibilityRetry(res, j) };
        if (res.ok || !last.retryable) break;
      }
    }
    if (!last?.res?.ok) throw new Error(`${model.label} HTTP ${last?.res?.status || "?"}: ${last?.j?._text || last?.j?.message || JSON.stringify(last?.j || {}).slice(0,220)}`);
    let raw = last.j;
    if (!videoUrlFromResponse(raw) && raw.task_id) { const result = await pollTask(raw.task_id, key); if (result.status !== "success") throw new Error(`${model.label} 任务 ${result.status}`); raw = result.raw; }
    const fileUrl = videoUrlFromResponse(raw); if (!fileUrl) throw acceptedWithoutRecognizedResult(model, "视频", last);
    const dl = await fetchBlob(fileUrl), video = document.createElement("video"); video.src = dl.url; video.controls = true; video.playsInline = true;
    addOutput({ title: `${model.label} · 图生视频输出`, meta: `实际模型=${model.id} · Adapter=${model.adapter || "custom"} · endpoint=${last.endpoint} · 请求策略=${last.strategy}`, raw, element: video, download: { href: dl.url, filename: `${model.id.replace(/[^a-z0-9_-]+/gi,"-")}-${ts()}.mp4` }, openUrl: $("wanOpenUrl")?.checked ? fileUrl : null });
    status(`${model.label} 视频生成成功`, "ok");
  }

  function addT2VCommonUi() {
    const box = $("mmT2VModel")?.closest(".mm-model-box"); if (!box || $("mmT2VDuration")) return;
    const row = document.createElement("div"); row.className = "grid2";
    row.innerHTML = `<div><label class="lab">通用视频分辨率</label><select id="mmT2VResolution" class="input"><option>720P</option><option>480P</option><option>1080P</option></select></div><div><label class="lab">通用视频时长（秒）</label><input id="mmT2VDuration" class="input" type="number" min="1" max="30" value="5" /></div>`;
    box.appendChild(row);
  }

  async function runT2V() {
    const key = apiKey(), model = currentModel("t2v"), prompt = $("hyPrompt")?.value?.trim(); if (!prompt) throw new Error("请输入提示词");
    const negative = $("hyNeg")?.value?.trim(), ratio = $("hyAspect")?.value || "16:9", seed = Math.max(1, Number.parseInt($("hySeed")?.value || "1", 10) || 1), extra = parseExtra("t2v");
    const generic = { prompt, model: model.id, resolution: $("mmT2VResolution")?.value || "720P", duration: Number.parseFloat($("mmT2VDuration")?.value || "5") || 5, ratio, seed, ...(negative ? { negative_prompt: negative } : {}), ...extra };
    const legacy = { prompt, model: model.id, aspect_ratio: ratio, negative_prompt: negative, num_inferenece_steps: Math.max(1, Number.parseInt($("hySteps")?.value || "10", 10) || 10), num_frames: Math.max(1, Number.parseInt($("hyFrames")?.value || "241", 10) || 241), seed, fps: Math.max(1, Number.parseInt($("hyFps")?.value || "24", 10) || 24), ...extra };
    const endpoints = [...new Set([model.endpoint, "async/videos/generations", "async/videos/text-to-video"].filter(Boolean))], bodies = model.adapterImpl?.t2vPreferLegacy ? [legacy, generic] : [generic, legacy];
    let last = null; status(`${model.label} 创建文生视频任务…`);
    outer: for (const endpoint of endpoints) for (const body of bodies) {
      const res = await apiFetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await readJson(res);
      last = { res, j, body, endpoint, retryable: isSafeCompatibilityRetry(res, j) };
      if (res.ok || !last.retryable) break outer;
    }
    if (!last?.res?.ok) throw new Error(`${model.label} HTTP ${last?.res?.status || "?"}: ${last?.j?._text || last?.j?.message || JSON.stringify(last?.j || {}).slice(0,220)}`);
    let raw = last.j; if (!videoUrlFromResponse(raw) && raw.task_id) { const result = await pollTask(raw.task_id, key); if (result.status !== "success") throw new Error(`${model.label} 任务 ${result.status}`); raw = result.raw; }
    const fileUrl = videoUrlFromResponse(raw); if (!fileUrl) throw acceptedWithoutRecognizedResult(model, "视频", last);
    const dl = await fetchBlob(fileUrl), video = document.createElement("video"); video.src = dl.url; video.controls = true; video.playsInline = true;
    addOutput({ title: `${model.label} · 文生视频输出`, meta: `实际模型=${model.id} · Adapter=${model.adapter || "custom"} · endpoint=${last.endpoint}`, raw, element: video, download: { href: dl.url, filename: `${model.id.replace(/[^a-z0-9_-]+/gi,"-")}-${ts()}.mp4` }, openUrl: $("hyOpenUrl")?.checked ? fileUrl : null });
    status(`${model.label} 视频生成成功`, "ok");
  }

  function addSyncedOption(task, entry) {
    const conf = TASKS[task], sel = $(conf.selectId); if (!sel || [...sel.options].some((o) => o.value === entry.id)) return;
    let og = [...sel.querySelectorAll("optgroup")].find((x) => x.label === groupLabel("synced"));
    if (!og) { og = document.createElement("optgroup"); og.label = groupLabel("synced"); const custom = sel.querySelector('option[value="__custom__"]'); if (custom) sel.insertBefore(og, custom); else sel.appendChild(og); }
    const o = document.createElement("option"); o.value = entry.id; o.textContent = `${entry.label} · ${entry.badge}`; og.appendChild(o);
  }

  async function syncModels() {
    const key = apiKey(), note = $("mmSyncStatus"); if (note) note.textContent = "正在尝试 GET /v1/models…"; status("正在尝试从 Gitee API 同步模型列表…");
    try {
      const res = await apiFetch("models", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" }), j = await readJson(res); if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : [], ids = data.map((x) => typeof x === "string" ? x : x?.id || x?.name).filter(Boolean); if (!ids.length) throw new Error("接口可访问，但没有识别到模型数组");
      let merged = 0;
      for (const id of ids) for (const task of REGISTRY.classifyModelId(id)) { const entry = REGISTRY.registerSyncedModel(task, id); if (!entry) continue; addSyncedOption(task, entry); merged += 1; }
      if (note) note.textContent = `同步成功：读取 ${ids.length} 个模型条目，新增 ${merged} 个可安全自动归类条目。视频模型继续使用精选 Registry，避免误混任务类型。`;
      status("Gitee 模型列表同步成功", "ok");
    } catch (e) {
      if (note) note.textContent = `Gitee 当前未确认公开 /v1/models，或此 Token 无权限：${String(e.message || e)}。内置模型与自定义模型不受影响。`;
      status("模型自动同步不可用，继续使用内置模型", "info");
    }
  }

  function addSyncUi() {
    const keyInput = $("apiKey"), row = keyInput?.closest(".row"); if (!row || $("btnSyncModels")) return;
    const b = document.createElement("button"); b.id = "btnSyncModels"; b.type = "button"; b.className = "btn"; b.textContent = "尝试同步 Gitee 模型"; row.appendChild(b);
    const note = document.createElement("div"); note.id = "mmSyncStatus"; note.className = "hint"; note.textContent = "模型清单由 Registry 管理；自动同步只补充可安全归类的图像模型，视频保持精选列表。"; row.parentElement?.appendChild(note);
    b.addEventListener("click", () => syncModels().catch((e) => addOutput({ title: "模型同步失败", meta: String(e) })));
  }

  function updateTopFunctionSelector() {
    const sel = $("modelSel"); if (!sel) return; const h2 = sel.closest(".card")?.querySelector("h2"); if (h2) h2.textContent = "2. 选择功能 / Select Function";
    const names = { "z-image": "文生图 / Text-to-Image", "Edit-2511": "图像编辑 / Image Edit", "Wan2.2-I2V-A14B": "图生视频 / Image-to-Video", "HunyuanVideo-1.5": "文生视频 / Text-to-Video" };
    for (const o of sel.options) if (names[o.value]) o.textContent = names[o.value];
  }

  function overrideButtons() {
    const bind = (id, fn, label) => { const b = $(id); if (!b) return; b.onclick = async () => { try { await fn(); } catch (e) { status(`${label}失败`, "err"); addOutput({ title: `${label}错误`, meta: String(e.message || e) }); } }; };
    bind("btnZRun", runT2I, "文生图"); bind("btnEditRun", runEdit, "图像编辑"); bind("btnWanRun", runI2V, "图生视频"); bind("btnHyRun", runT2V, "文生视频");
  }

  function injectStyle() {
    const style = document.createElement("style"); style.textContent = `.mm-model-box{margin:4px 0 16px;padding:14px;border:1px solid rgba(128,128,128,.22);border-radius:12px;background:rgba(128,128,128,.05)}.mm-model-box details summary{user-select:none}.mm-model-box .hint{line-height:1.55}`; document.head.appendChild(style);
  }

  window.GiteeWorkbenchCore = Object.freeze({ currentModel, runT2I, runEdit, runI2V, runT2V });

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle(); updateTopFunctionSelector(); addSyncUi();
    modelControl("t2i", "文生图模型 / Text-to-Image Model"); modelControl("edit", "图像编辑模型 / Image Edit Model"); modelControl("i2v", "图生视频模型 / Image-to-Video Model"); modelControl("t2v", "文生视频模型 / Text-to-Video Model");
    addT2VCommonUi(); overrideButtons();
  });
})();
