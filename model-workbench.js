(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const STATIC_STATUS = {
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
  };

  const SELECT_IDS = {
    t2i: "mmT2IModel",
    edit: "mmEditModel",
    i2v: "mmI2VModel",
    t2v: "mmT2VModel",
  };

  function currentModelId(task) {
    return $(SELECT_IDS[task])?.value || "";
  }

  function localTestKey(task, modelId) {
    return `moark_model_health_v1:${task}:${modelId}`;
  }

  function readLocalTest(task, modelId) {
    try {
      const raw = localStorage.getItem(localTestKey(task, modelId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocalTest(task, modelId, state, detail = "") {
    if (!modelId || modelId === "__custom__") return;
    try {
      localStorage.setItem(localTestKey(task, modelId), JSON.stringify({ state, detail, at: Date.now() }));
    } catch {}
    decorateSelect(task);
    refreshHealth(task);
  }

  function staticStatus(task, modelId) {
    if (modelId === "__custom__") return { state: "custom", text: "自定义", detail: "按自定义 Endpoint / 参数调用" };
    const exact = STATIC_STATUS[task]?.[modelId];
    if (exact) return exact;
    return { state: "adapted", text: "待实测", detail: "已加入兼容层，尚未在当前浏览器确认" };
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

  function decorateSelect(task) {
    const sel = $(SELECT_IDS[task]);
    if (!sel) return;
    for (const opt of sel.options) {
      if (!opt.dataset.mmBaseText) opt.dataset.mmBaseText = opt.textContent.replace(/^[✅❌🧪⚙️🟡]\s*/, "");
      const st = effectiveStatus(task, opt.value);
      opt.textContent = `${statusIcon(st.state)} ${opt.dataset.mmBaseText}`;
    }
  }

  function refreshHealth(task) {
    const el = $(`mmHealth-${task}`);
    if (!el) return;
    const st = effectiveStatus(task, currentModelId(task));
    el.className = `mm-health mm-health-${st.state}`;
    el.innerHTML = `<strong>${statusIcon(st.state)} ${st.text}</strong><span>${st.detail}</span>`;
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
    box.innerHTML = `<h3></h3><div class="meta"></div>`;
    box.querySelector("h3").textContent = title;
    box.querySelector(".meta").textContent = meta;
    out.prepend(box);
  }

  function inspectNewOutput(before) {
    const items = [...document.querySelectorAll("#output .item")].filter((item) => !before.has(item));
    const error = items.find((item) => /错误|失败|error|failed/i.test(item.querySelector("h3")?.textContent || ""));
    const media = items.find((item) => item.querySelector("img,video"));
    if (error) return { state: "fail", detail: error.querySelector(".meta")?.textContent || error.textContent.slice(0, 180) };
    if (media) return { state: "pass", detail: "最近一次完整生成成功" };
    return { state: "unknown", detail: "未发现明确结果" };
  }

  function wrapButtonForHealth(id, task) {
    const button = $(id);
    if (!button || typeof button.onclick !== "function" || button.dataset.mmHealthWrapped === "1") return;
    const original = button.onclick;
    button.dataset.mmHealthWrapped = "1";
    button.onclick = async function (event) {
      const modelId = currentModelId(task);
      const before = new Set(document.querySelectorAll("#output .item"));
      const result = await original.call(this, event);
      const detected = inspectNewOutput(before);
      if (["pass", "fail"].includes(detected.state)) writeLocalTest(task, modelId, detected.state, detected.detail);
      return result;
    };
  }

  function addHealthRow(task, buttonText, noteText) {
    const box = $(SELECT_IDS[task])?.closest(".mm-model-box");
    if (!box || $(`mmHealth-${task}`)) return;
    const row = document.createElement("div");
    row.className = "mm-health-row";
    row.innerHTML = `
      <div id="mmHealth-${task}" class="mm-health"></div>
      <button type="button" class="btn" id="mmTest-${task}">${buttonText}</button>
      <span class="hint mm-test-note">${noteText}</span>`;
    box.appendChild(row);
  }

  function setVisible(el, show) {
    if (!el) return;
    if (el.dataset.mmOriginalDisplay === undefined) el.dataset.mmOriginalDisplay = el.style.display || "";
    el.style.display = show ? el.dataset.mmOriginalDisplay : "none";
  }

  function fieldParent(id) {
    const el = $(id);
    if (!el) return null;
    return el.closest("label") || el.parentElement;
  }

  function updateT2IParameterUi() {
    const modelId = currentModelId("t2i");
    const nInput = $("zN");
    if (nInput) {
      const allowMulti = modelId === "z-image-turbo" || modelId === "Z-Image";
      nInput.disabled = !allowMulti;
      nInput.max = allowMulti ? "4" : "1";
      if (!allowMulti) nInput.value = "1";
      nInput.title = allowMulti ? "当前模型允许一次生成多张" : "为提高跨模型兼容性，当前模型固定 n=1";
    }
    refreshHealth("t2i");
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
      <div class="hint">Vidu / HappyHorse 等模型显示通用参数；程序会同步到兼容请求并自动重试常见字段格式。</div>`;
    modelBox.appendChild(box);
    for (const id of ["mmI2VResolution", "mmI2VRatio", "mmI2VDuration"]) {
      $(id)?.addEventListener("change", syncGenericI2VToLegacy);
      $(id)?.addEventListener("input", syncGenericI2VToLegacy);
    }
  }

  function syncGenericI2VToLegacy() {
    const resolution = $("mmI2VResolution")?.value || "720P";
    const ratio = $("mmI2VRatio")?.value || "16:9";
    const duration = Math.max(1, Number.parseFloat($("mmI2VDuration")?.value || "5") || 5);
    const dims = {
      "720P": { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1280, 1280] },
      "480P": { "16:9": [832, 480], "9:16": [480, 832], "1:1": [768, 768] },
    };
    const [w, h] = dims[resolution]?.[ratio] || dims["720P"]["16:9"];
    if ($("wanW")) $("wanW").value = String(w);
    if ($("wanH")) $("wanH").value = String(h);
    if ($("wanDuration")) $("wanDuration").value = String(duration);
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
    refreshHealth("i2v");
  }

  function updateT2VParameterUi() {
    const isHunyuan = currentModelId("t2v") === "HunyuanVideo-1.5";
    setVisible($("mmT2VResolution")?.closest(".grid2"), !isHunyuan);
    setVisible(fieldParent("hySteps"), isHunyuan);
    setVisible(fieldParent("hyFps"), isHunyuan);
    setVisible(fieldParent("hyFrames"), isHunyuan);
    refreshHealth("t2v");
  }

  async function runModelDiagnostic(task) {
    if (!$("apiKey")?.value?.trim()) {
      addInfo("模型检测未开始", "请先输入 Gitee AI API Key");
      return;
    }
    const testBtn = $(`mmTest-${task}`);
    if (testBtn) testBtn.disabled = true;
    try {
      if (task === "t2i") {
        const prompt = $("zPrompt");
        const n = $("zN");
        const oldPrompt = prompt?.value || "";
        const oldN = n?.value || "1";
        if (prompt && !prompt.value.trim()) prompt.value = "A red ceramic sphere on a clean white studio background, realistic lighting";
        if (n) n.value = "1";
        await $("btnZRun")?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt;
        if (n) n.value = oldN;
        return;
      }
      if (task === "i2v") {
        if (!$("wanImg")?.files?.[0]) {
          addInfo("图生视频模型检测未开始", "请先上传一张测试图片，再点击检测当前模型");
          return;
        }
        const prompt = $("wanPrompt");
        const oldPrompt = prompt?.value || "";
        if (prompt && !prompt.value.trim()) prompt.value = "Slow cinematic camera push-in, subtle natural motion, stable subject";
        if (currentModelId("i2v") !== "Wan2_2-I2V-A14B") {
          if ($("mmI2VDuration")) $("mmI2VDuration").value = "1";
          syncGenericI2VToLegacy();
        }
        await $("btnWanRun")?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt;
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
        } else if ($("mmT2VDuration")) {
          $("mmT2VDuration").value = "1";
        }
        await $("btnHyRun")?.onclick?.(new Event("click"));
        if (prompt) prompt.value = oldPrompt;
        if ($("hyFrames") && oldFrames != null) $("hyFrames").value = oldFrames;
        if ($("mmT2VDuration") && oldDuration != null) $("mmT2VDuration").value = oldDuration;
      }
    } finally {
      if (testBtn) testBtn.disabled = false;
      refreshHealth(task);
    }
  }

  function injectStyle() {
    const style = document.createElement("style");
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

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    createI2VGenericControls();
    addHealthRow("t2i", "检测当前文生图模型", "会实际生成 1 张测试图");
    addHealthRow("i2v", "检测当前图生视频模型", "需先上传图片，会实际调用 API");
    addHealthRow("t2v", "检测当前文生视频模型", "会提交短视频任务，可能产生费用");
    addLegend();

    for (const task of ["t2i", "edit", "i2v", "t2v"]) decorateSelect(task);
    updateT2IParameterUi();
    updateI2VParameterUi();
    updateT2VParameterUi();

    $("mmT2IModel")?.addEventListener("change", () => { decorateSelect("t2i"); updateT2IParameterUi(); });
    $("mmI2VModel")?.addEventListener("change", () => { decorateSelect("i2v"); updateI2VParameterUi(); });
    $("mmT2VModel")?.addEventListener("change", () => { decorateSelect("t2v"); updateT2VParameterUi(); });
    $("mmEditModel")?.addEventListener("change", () => decorateSelect("edit"));

    $("mmTest-t2i")?.addEventListener("click", () => runModelDiagnostic("t2i"));
    $("mmTest-i2v")?.addEventListener("click", () => runModelDiagnostic("i2v"));
    $("mmTest-t2v")?.addEventListener("click", () => runModelDiagnostic("t2v"));

    wrapButtonForHealth("btnZRun", "t2i");
    wrapButtonForHealth("btnEditRun", "edit");
    wrapButtonForHealth("btnWanRun", "i2v");
    wrapButtonForHealth("btnHyRun", "t2v");

    refreshHealth("t2i");
    refreshHealth("i2v");
    refreshHealth("t2v");
  });
})();
