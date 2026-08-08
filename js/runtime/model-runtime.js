(() => {
  "use strict";

  const REGISTRY = window.GiteeModelRegistry;
  const ADAPTERS = window.GiteeModelAdapters;
  if (!REGISTRY || !ADAPTERS) throw new Error("Model Registry / Adapter layer must load before model-runtime.js");

  const $ = (id) => document.getElementById(id);
  const nativeFetch = window.fetch.bind(window);
  const SELECT_IDS = { t2i: "mmT2IModel", edit: "mmEditModel", i2v: "mmI2VModel", t2v: "mmT2VModel" };
  const BUTTON_IDS = { t2i: "btnZRun", edit: "btnEditRun", i2v: "btnWanRun", t2v: "btnHyRun" };

  function addInfo(title, meta = "") {
    if (typeof window.addOutputItem === "function") return window.addOutputItem({ title, meta });
    const out = $("output");
    if (!out) return;
    const box = document.createElement("div");
    box.className = "item";
    box.innerHTML = "<h3></h3><div class='meta'></div>";
    box.querySelector("h3").textContent = title;
    box.querySelector(".meta").textContent = meta;
    out.prepend(box);
  }

  function rememberKeyNow() {
    const key = $("apiKey")?.value?.trim();
    if (!key) return;
    try { if ($("rememberKey")?.checked) localStorage.setItem("moark_api_key", key); } catch {}
  }

  function setLoading(show) {
    if (typeof window.showLoading === "function") return window.showLoading(show);
    const el = $("globalLoading");
    if (el) el.style.display = show ? "block" : "none";
  }

  function clamp(value, min, max) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function headerValue(headers, name) {
    if (!headers) return "";
    if (headers instanceof Headers) return headers.get(name) || "";
    return String(headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "");
  }

  function parseJsonBody(init) {
    if (!init || typeof init.body !== "string") return null;
    const type = headerValue(init.headers, "Content-Type");
    if (type && !type.includes("application/json")) return null;
    try {
      const obj = JSON.parse(init.body);
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
    } catch { return null; }
  }

  async function shouldRetryResponse(res) {
    if (res.ok || ![400, 404, 405, 415, 422].includes(res.status)) return false;
    let text = "";
    try { text = await res.clone().text(); } catch {}
    return !text || /参数|parameter|invalid|unsupported|size|field|format|request|method|endpoint/i.test(text);
  }

  async function fetchWithJsonVariants(input, init, variants) {
    let last = null;
    for (const body of variants || []) {
      const res = await nativeFetch(input, { ...init, body: JSON.stringify(body) });
      last = res;
      if (res.ok || !(await shouldRetryResponse(res))) return res;
    }
    return last || nativeFetch(input, init);
  }

  function inferTaskForJson(url, body) {
    if (/\/api\/images\/generations(?:\?|$)/.test(url)) return "t2i";
    if (/\/api\/async\/videos\//.test(url)) {
      return body?.image || body?.first_frame || body?.image_url ? "i2v" : "t2v";
    }
    return null;
  }

  window.fetch = async function adapterAwareFetch(input, init = {}) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const body = parseJsonBody(init);
    if (!body?.model) return nativeFetch(input, init);
    const task = inferTaskForJson(url, body);
    if (!task) return nativeFetch(input, init);
    const adapter = ADAPTERS.forModel(task, String(body.model));
    if (!adapter?.jsonVariants) return nativeFetch(input, init);
    return fetchWithJsonVariants(input, init, adapter.jsonVariants(body));
  };

  function currentModelId(task) { return $(SELECT_IDS[task])?.value || ""; }
  function currentRegistryModel(task) { return REGISTRY.model(task, currentModelId(task)); }
  function currentAdapter(task) { return ADAPTERS.forModel(task, currentModelId(task)); }

  function splitSize(size) {
    const m = String(size || "").match(/(\d+)[x*](\d+)/i);
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
  }

  function refillT2ISizes() {
    const res = $("zRes");
    if (!res) return;
    const adapter = currentAdapter("t2i") || ADAPTERS.get("generic-image");
    const options = adapter?.ui?.sizes || ["1:1 (1024x1024)"];
    const oldDims = splitSize(res.value);
    res.innerHTML = "";
    for (const label of options) {
      const option = document.createElement("option"); option.value = label; option.textContent = label; res.appendChild(option);
    }
    const compatible = oldDims && [...res.options].find((o) => o.value.includes(`${oldDims.width}x${oldDims.height}`));
    res.value = compatible?.value || options[0];
    const note = $("mm-t2i-note");
    if (note) {
      const base = note.textContent.split(" · 参数适配：")[0];
      note.textContent = `${base} · 参数适配：${adapter?.ui?.note || "使用通用图像参数"}`;
    }
  }

  function setEndpointInputs(task, endpoint) {
    const normal = $(`mm-${task}-endpoint`), advanced = $(`mm-${task}-endpoint-advanced`);
    if (normal) normal.value = endpoint;
    if (advanced) advanced.value = endpoint;
  }

  function applyAdapterEndpoint(task) {
    const modelId = currentModelId(task);
    if (!modelId || modelId === "__custom__") return;
    const endpoint = currentRegistryModel(task)?.endpoint || currentAdapter(task)?.defaultEndpoint || REGISTRY.task(task)?.defaultEndpoint;
    if (endpoint) setEndpointInputs(task, endpoint);
  }

  function setVisible(el, show) {
    if (!el) return;
    if (el.dataset.mmOriginalDisplay === undefined) el.dataset.mmOriginalDisplay = el.style.display || "";
    el.style.display = show ? el.dataset.mmOriginalDisplay : "none";
  }
  function fieldParent(id) { const el = $(id); return el ? (el.closest("label") || el.parentElement) : null; }

  function createI2VGenericControls() {
    if ($("mmI2VGenericControls")) return;
    const modelBox = $("mmI2VModel")?.closest(".mm-model-box");
    if (!modelBox) return;
    const box = document.createElement("div");
    box.id = "mmI2VGenericControls";
    box.className = "mm-dynamic-controls";
    box.innerHTML = `<div class="grid3"><div><label class="lab">通用分辨率</label><select id="mmI2VResolution" class="input"><option>720P</option><option>480P</option></select></div><div><label class="lab">画面比例</label><select id="mmI2VRatio" class="input"><option>16:9</option><option>9:16</option><option>1:1</option></select></div><div><label class="lab">时长（秒）</label><input id="mmI2VDuration" class="input" type="number" min="1" max="16" step="1" value="5" /></div></div><div class="hint">通用视频模型显示简化参数；模型限制由 Registry 提供，请求字段由 Adapter 处理。</div>`;
    modelBox.appendChild(box);
    for (const id of ["mmI2VResolution", "mmI2VRatio", "mmI2VDuration"]) {
      $(id)?.addEventListener("change", syncGenericI2VToLegacy);
      $(id)?.addEventListener("input", syncGenericI2VToLegacy);
    }
  }

  function syncGenericI2VToLegacy() {
    const resolution = $("mmI2VResolution")?.value || "720P", ratio = $("mmI2VRatio")?.value || "16:9", duration = Number.parseFloat($("mmI2VDuration")?.value || "5") || 5;
    const dims = { "720P": { "16:9": [1280,720], "9:16": [720,1280], "1:1": [1280,1280] }, "480P": { "16:9": [832,480], "9:16": [480,832], "1:1": [768,768] } };
    const [w,h] = dims[resolution]?.[ratio] || dims["720P"]["16:9"];
    if ($("wanW")) $("wanW").value = String(w);
    if ($("wanH")) $("wanH").value = String(h);
    if ($("wanDuration")) $("wanDuration").value = String(duration);
  }

  function durationRule(task) { return currentRegistryModel(task)?.limits?.duration || null; }
  function durationInput(task) { return $(task === "i2v" ? "mmI2VDuration" : "mmT2VDuration"); }

  function applyDurationRule(task, { forceRecommended = false } = {}) {
    const rule = durationRule(task);
    if (!rule) return;
    const modelId = currentModelId(task), input = durationInput(task), legacy = task === "i2v" ? $("wanDuration") : null;
    const source = input?.value ?? legacy?.value ?? rule.recommended;
    const valid = forceRecommended ? rule.recommended : clamp(source, rule.min, rule.max);
    if (input) { input.min = String(rule.min); input.max = String(rule.max); input.step = "1"; input.value = String(valid); }
    if (legacy) legacy.value = String(valid);
    const hint = task === "i2v" ? $("mmI2VGenericControls")?.querySelector(".hint") : $("mm-t2v-note");
    const text = `${modelId} 时长范围：${rule.min}–${rule.max} 秒；推荐先用 ${rule.recommended} 秒。`;
    if (hint) {
      if (task === "t2v") { const base = hint.textContent.split(" · 时长适配：")[0]; hint.textContent = `${base} · 时长适配：${text}`; }
      else hint.textContent = text;
    }
  }

  function clearFalseDurationFailuresOnce() {
    const migrationKey = "moark_video_registry_adapter_v4";
    try {
      if (localStorage.getItem(migrationKey) === "1") return;
      for (const task of ["i2v", "t2v"]) for (const model of REGISTRY.task(task)?.models || []) {
        if (!model.limits?.duration) continue;
        const key = `moark_model_health_v1:${task}:${model.id}`, raw = localStorage.getItem(key);
        if (!raw) continue;
        try { const parsed = JSON.parse(raw); if (parsed?.state === "fail" && /duration|时长|参数范围/i.test(parsed?.detail || "")) localStorage.removeItem(key); } catch {}
      }
      localStorage.setItem(migrationKey, "1");
    } catch {}
  }

  function updateT2IParameterUi() {
    const nInput = $("zN"), allowBatch = Boolean(currentAdapter("t2i")?.allowBatch);
    if (nInput) { nInput.disabled = !allowBatch; nInput.max = allowBatch ? "4" : "1"; if (!allowBatch) nInput.value = "1"; nInput.title = allowBatch ? "当前 Adapter 允许一次生成多张" : "当前 Adapter 固定 n=1 以提高兼容性"; }
    refreshHealth("t2i");
  }

  function updateI2VParameterUi() {
    const isWan = currentAdapter("i2v")?.uiProfile === "wan";
    setVisible($("mmI2VGenericControls"), !isWan);
    setVisible($("wanPreset")?.closest(".grid3"), isWan);
    setVisible($("wanResPreset")?.closest(".grid3"), isWan);
    setVisible($("wanFps")?.closest(".grid3"), isWan);
    setVisible(fieldParent("wanSteps"), isWan); setVisible(fieldParent("wanGuidance"), isWan); setVisible(fieldParent("wanWatermark"), isWan); setVisible(fieldParent("wanPromptExtend"), isWan); setVisible(fieldParent("wanAutoFrames"), isWan); setVisible(fieldParent("wanZipSegments"), isWan);
    if (!isWan) syncGenericI2VToLegacy();
    applyDurationRule("i2v"); refreshHealth("i2v");
  }

  function updateT2VParameterUi() {
    const isHunyuan = currentAdapter("t2v")?.uiProfile === "hunyuan";
    setVisible($("mmT2VResolution")?.closest(".grid2"), !isHunyuan);
    setVisible(fieldParent("hySteps"), isHunyuan); setVisible(fieldParent("hyFps"), isHunyuan); setVisible(fieldParent("hyFrames"), isHunyuan);
    applyDurationRule("t2v"); refreshHealth("t2v");
  }

  function localTestKey(task, modelId) { return `moark_model_health_v1:${task}:${modelId}`; }
  function readLocalTest(task, modelId) { try { const raw = localStorage.getItem(localTestKey(task, modelId)); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function writeLocalTest(task, modelId, state, detail = "") { if (!modelId || modelId === "__custom__") return; try { localStorage.setItem(localTestKey(task, modelId), JSON.stringify({ state, detail, at: Date.now() })); } catch {} decorateSelect(task); refreshHealth(task); }
  function staticStatus(task, modelId) { if (modelId === "__custom__") return { state: "custom", text: "自定义", detail: "按自定义 Endpoint / 参数调用" }; return REGISTRY.model(task, modelId)?.status || { state: "adapted", text: "待实测", detail: "已由 Registry 绑定 Adapter，尚未在当前浏览器确认" }; }
  function effectiveStatus(task, modelId) { const local = readLocalTest(task, modelId); if (local?.state === "pass") return { state: "pass", text: "本机已通过", detail: local.detail || "最近一次调用成功" }; if (local?.state === "fail") return { state: "fail", text: "最近失败", detail: local.detail || "最近一次调用失败" }; return staticStatus(task, modelId); }
  function statusIcon(state) { if (["verified","pass"].includes(state)) return "✅"; if (state === "fail") return "❌"; if (state === "experimental") return "🧪"; if (state === "custom") return "⚙️"; return "🟡"; }

  function decorateSelect(task) {
    const select = $(SELECT_IDS[task]); if (!select) return;
    for (const option of select.options) { if (!option.dataset.mmBaseText) option.dataset.mmBaseText = option.textContent.replace(/^[✅❌🧪⚙️🟡]\s*/, ""); option.textContent = `${statusIcon(effectiveStatus(task, option.value).state)} ${option.dataset.mmBaseText}`; }
  }
  function refreshHealth(task) {
    const el = $(`mmHealth-${task}`); if (!el) return;
    const st = effectiveStatus(task, currentModelId(task));
    el.className = `mm-health mm-health-${st.state}`;
    const strong = document.createElement("strong");
    strong.textContent = `${statusIcon(st.state)} ${st.text}`;
    const span = document.createElement("span");
    span.textContent = st.detail || "";
    el.replaceChildren(strong, span);
  }
  function inspectNewOutput(before) { const items = [...document.querySelectorAll("#output .item")].filter((item) => !before.has(item)); const error = items.find((item) => /错误|失败|error|failed/i.test(item.querySelector("h3")?.textContent || "")); const media = items.find((item) => item.querySelector("img,video")); if (error) return { state: "fail", detail: error.querySelector(".meta")?.textContent || error.textContent.slice(0,180) }; if (media) return { state: "pass", detail: "最近一次完整生成成功" }; return { state: "unknown", detail: "未发现明确结果" }; }

  function addHealthRow(task, buttonText, noteText) {
    const box = $(SELECT_IDS[task])?.closest(".mm-model-box"); if (!box || $(`mmHealth-${task}`)) return;
    const row = document.createElement("div"); row.className = "mm-health-row"; row.innerHTML = `<div id="mmHealth-${task}" class="mm-health"></div><button type="button" class="btn" id="mmTest-${task}">${buttonText}</button><span class="hint mm-test-note">${noteText}</span>`; box.appendChild(row);
  }

  function addTrialNotice(task) {
    const box = $(SELECT_IDS[task])?.closest(".mm-model-box"); if (!box || box.querySelector(`[data-video-trial-notice="${task}"]`)) return;
    const notice = document.createElement("div"); notice.dataset.videoTrialNotice = task; notice.className = "hint"; notice.style.marginTop = "10px"; notice.textContent = "ℹ 视频模型由 Registry 精选并绑定独立 Adapter。Gitee 页面可提供免费体验；直接 API 调用是否消耗体验额度或产生费用以账户规则为准。"; box.appendChild(notice);
  }

  async function runModelDiagnostic(task) {
    if (!$("apiKey")?.value?.trim()) return addInfo("模型检测未开始", "请先输入 Gitee AI API Key");
    const testBtn = $(`mmTest-${task}`); if (testBtn) testBtn.disabled = true;
    try {
      if (["i2v","t2v"].includes(task)) { const ok = window.confirm(`将真实提交 ${currentModelId(task)} 视频生成任务，可能消耗体验额度。是否继续？`); if (!ok) return; }
      if (task === "t2i") {
        const prompt = $("zPrompt"), n = $("zN"), oldPrompt = prompt?.value || "", oldN = n?.value || "1";
        if (prompt && !prompt.value.trim()) prompt.value = "A red ceramic sphere on a clean white studio background, realistic lighting"; if (n) n.value = "1";
        await $(BUTTON_IDS.t2i)?.onclick?.(new Event("click")); if (prompt) prompt.value = oldPrompt; if (n) n.value = oldN; return;
      }
      if (task === "i2v") {
        if (!$("wanImg")?.files?.[0]) return addInfo("图生视频模型检测未开始", "请先上传一张测试图片，再点击检测当前模型");
        const prompt = $("wanPrompt"), oldPrompt = prompt?.value || "", oldDuration = $("mmI2VDuration")?.value;
        if (prompt && !prompt.value.trim()) prompt.value = "Slow cinematic camera push-in, subtle natural motion, stable subject";
        applyDurationRule("i2v", { forceRecommended: true }); syncGenericI2VToLegacy(); await $(BUTTON_IDS.i2v)?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt; if ($("mmI2VDuration") && oldDuration != null) $("mmI2VDuration").value = oldDuration; return;
      }
      if (task === "t2v") {
        const prompt = $("hyPrompt"), oldPrompt = prompt?.value || "", oldFrames = $("hyFrames")?.value, oldDuration = $("mmT2VDuration")?.value;
        if (prompt && !prompt.value.trim()) prompt.value = "A red paper airplane glides slowly through a bright studio, smooth camera movement";
        if (currentAdapter("t2v")?.uiProfile === "hunyuan") { if ($("hyFrames")) $("hyFrames").value = "81"; } else applyDurationRule("t2v", { forceRecommended: true });
        await $(BUTTON_IDS.t2v)?.onclick?.(new Event("click")); if (prompt) prompt.value = oldPrompt; if ($("hyFrames") && oldFrames != null) $("hyFrames").value = oldFrames; if ($("mmT2VDuration") && oldDuration != null) $("mmT2VDuration").value = oldDuration;
      }
    } finally { if (testBtn) testBtn.disabled = false; refreshHealth(task); }
  }

  function syncWanAutoFrames() { if (!$("wanAutoFrames")?.checked) return; const fps = Math.max(1,Math.min(60,Number.parseInt($("wanFps")?.value || "24",10) || 24)); if ($("wanFrames")) $("wanFrames").value = String(Math.max(1,Math.min(300,fps*5))); }
  async function ensureZip() { if (window.JSZip) return window.JSZip; const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"; script.crossOrigin = "anonymous"; document.head.appendChild(script); await new Promise((resolve,reject) => { script.onload = resolve; script.onerror = () => reject(new Error("加载 JSZip 失败")); }); return window.JSZip; }
  function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1500); }
  async function zipVideos(items) { if (!items.length) return; const JSZip = await ensureZip(), zip = new JSZip(); for (const item of items) zip.file(item.name,item.blob); downloadBlob(await zip.generateAsync({type:"blob"}), `wan_segments_${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14)}.zip`); }

  async function runSegmentedVideo(original, event, requested, secondsPerSegment) {
    const input = $("wanDuration"), originalDuration = input?.value || String(secondsPerSegment), count = Math.max(1,Math.ceil(requested/secondsPerSegment)), zipItems = [];
    addInfo("Wan2.2 长视频分段模式", `总时长=${requested}s · 分段数=${count} · 每段最多${secondsPerSegment}s`);
    try {
      for (let i=0;i<count;i++) {
        const remaining = Math.max(0.5,Math.min(secondsPerSegment,requested-i*secondsPerSegment)); if (input) input.value = String(remaining); syncWanAutoFrames();
        const before = new Set(document.querySelectorAll("#output video")); if (typeof window.setStatus === "function") window.setStatus(`Wan2.2 分段 ${i+1}/${count} 生成中…`);
        await original.call($(BUTTON_IDS.i2v),event);
        const fresh = [...document.querySelectorAll("#output video")].find((v) => !before.has(v)); if (!fresh?.src) throw new Error(`Wan2.2 第 ${i+1}/${count} 段没有生成视频，已停止后续分段`);
        if ($("wanZipSegments")?.checked) { const res = await fetch(fresh.src); if (res.ok) zipItems.push({name:`wan_segment_${String(i+1).padStart(2,"0")}.mp4`,blob:await res.blob()}); }
      }
      if ($("wanZipSegments")?.checked && zipItems.length>1) { if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段完成，正在打包 ZIP…"); await zipVideos(zipItems); addInfo("Wan2.2 分段 ZIP 已生成", `已打包 ${zipItems.length} 个视频片段`); }
      if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段生成完成","ok");
    } finally { if (input) input.value = originalDuration; }
  }

  function wrapGenerateButton(task) {
    const button = $(BUTTON_IDS[task]); if (!button || typeof button.onclick !== "function" || button.dataset.modelRuntimeWrapped === "1") return;
    const original = button.onclick; button.dataset.modelRuntimeWrapped = "1";
    button.onclick = async function(event) {
      rememberKeyNow();
      if (task === "i2v") { syncWanAutoFrames(); applyDurationRule("i2v"); if (currentAdapter("i2v")?.uiProfile !== "wan") syncGenericI2VToLegacy(); }
      if (task === "t2v") applyDurationRule("t2v");
      const modelId = currentModelId(task), before = new Set(document.querySelectorAll("#output .item")); setLoading(true); button.disabled = true;
      try {
        const segmentSeconds = task === "i2v" ? currentAdapter("i2v")?.segmentSeconds : null;
        const requested = task === "i2v" ? (Number.parseFloat($("wanDuration")?.value || String(segmentSeconds || 5)) || (segmentSeconds || 5)) : 0;
        if (segmentSeconds && requested > segmentSeconds) await runSegmentedVideo(original,event,requested,segmentSeconds); else await original.call(this,event);
      } catch (e) { addInfo(`${task === "i2v" ? "图生视频" : "模型"}运行错误`, String(e?.message || e)); }
      finally { button.disabled = false; setLoading(false); const detected = inspectNewOutput(before); if (["pass","fail"].includes(detected.state)) writeLocalTest(task,modelId,detected.state,detected.detail); }
    };
  }

  function preferRegistryDefaults() {
    try {
      const migrationKey = "moark_registry_defaults_v4"; if (localStorage.getItem(migrationKey) === "1") return;
      for (const task of ["t2i","i2v","t2v"]) { const conf = REGISTRY.task(task), sel = $(SELECT_IDS[task]); if (!localStorage.getItem(conf.storageKey) && sel && conf.defaultModel && [...sel.options].some((o) => o.value === conf.defaultModel)) { sel.value = conf.defaultModel; sel.dispatchEvent(new Event("change")); } }
      localStorage.setItem(migrationKey,"1");
    } catch {}
  }

  function injectStyle() {
    if ($("modelRuntimeStyle")) return;
    const style = document.createElement("style"); style.id = "modelRuntimeStyle"; style.textContent = `.mm-health-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0 4px;padding-top:12px;border-top:1px dashed rgba(128,128,128,.25)}.mm-health{display:flex;gap:8px;align-items:center;min-width:220px;padding:8px 10px;border-radius:10px;background:rgba(128,128,128,.07)}.mm-health strong{white-space:nowrap}.mm-health span{font-size:12px;opacity:.8}.mm-health-verified,.mm-health-pass{background:rgba(34,197,94,.10)}.mm-health-fail{background:rgba(239,68,68,.10)}.mm-health-experimental{background:rgba(245,158,11,.10)}.mm-dynamic-controls{margin:12px 0 4px;padding:12px;border-radius:10px;background:rgba(128,128,128,.06)}.mm-test-note{margin:0!important}.mm-legend{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 0;font-size:12px;opacity:.85}`; document.head.appendChild(style);
  }
  function addLegend() { const syncStatus = $("mmSyncStatus"); if (!syncStatus || $("mmStatusLegend")) return; const legend = document.createElement("div"); legend.id = "mmStatusLegend"; legend.className = "mm-legend"; legend.innerHTML = `<span>✅ 已验证/本机通过</span><span>🟡 Registry+Adapter 已适配</span><span>🧪 实验模型</span><span>❌ 最近测试失败</span>`; syncStatus.insertAdjacentElement("afterend",legend); }

  function bindModelChanges() {
    $("mmT2IModel")?.addEventListener("change", () => { applyAdapterEndpoint("t2i"); refillT2ISizes(); decorateSelect("t2i"); updateT2IParameterUi(); });
    $("mmEditModel")?.addEventListener("change", () => { applyAdapterEndpoint("edit"); decorateSelect("edit"); });
    $("mmI2VModel")?.addEventListener("change", () => { applyAdapterEndpoint("i2v"); decorateSelect("i2v"); updateI2VParameterUi(); applyDurationRule("i2v", { forceRecommended: true }); });
    $("mmT2VModel")?.addEventListener("change", () => { applyAdapterEndpoint("t2v"); decorateSelect("t2v"); updateT2VParameterUi(); applyDurationRule("t2v", { forceRecommended: true }); });
  }

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle(); clearFalseDurationFailuresOnce(); preferRegistryDefaults(); createI2VGenericControls(); syncWanAutoFrames();
    for (const task of ["t2i","edit","i2v","t2v"]) applyAdapterEndpoint(task);
    refillT2ISizes(); applyDurationRule("i2v"); applyDurationRule("t2v");
    addHealthRow("t2i","检测当前文生图模型","会实际生成 1 张测试图"); addHealthRow("i2v","检测当前图生视频模型","需先上传图片，会实际调用 API"); addHealthRow("t2v","检测当前文生视频模型","会提交短视频任务，可能消耗体验额度");
    addTrialNotice("i2v"); addTrialNotice("t2v"); addLegend();
    for (const task of ["t2i","edit","i2v","t2v"]) decorateSelect(task);
    updateT2IParameterUi(); updateI2VParameterUi(); updateT2VParameterUi(); bindModelChanges();
    $("mmTest-t2i")?.addEventListener("click", () => runModelDiagnostic("t2i")); $("mmTest-i2v")?.addEventListener("click", () => runModelDiagnostic("i2v")); $("mmTest-t2v")?.addEventListener("click", () => runModelDiagnostic("t2v"));
    for (const task of ["t2i","edit","i2v","t2v"]) wrapGenerateButton(task);
    refreshHealth("t2i"); refreshHealth("i2v"); refreshHealth("t2v");
  });
})();
