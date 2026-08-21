(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const REGISTRY = window.GiteeModelRegistry;
  const ADAPTERS = window.GiteeModelAdapters;
  if (!REGISTRY || !ADAPTERS) return;

  const TASKS = ["t2i", "edit", "i2v", "t2v"];
  const SELECT_BY_TASK = {
    t2i: "mmT2IModel",
    edit: "mmEditModel",
    i2v: "mmI2VModel",
    t2v: "mmT2VModel",
  };
  const PANEL_BY_TASK = {
    t2i: "modelParams-t2i",
    edit: "modelParams-edit",
    i2v: "modelParams-i2v",
    t2v: "modelParams-t2v",
  };
  const TASK_LABEL = {
    t2i: "文生图",
    edit: "图像编辑",
    i2v: "图生视频",
    t2v: "文生视频",
  };
  const MODEL_SELECT_IDS = new Set([...Object.values(SELECT_BY_TASK), "modelSel"]);
  let syncTimer = 0;

  function modelId(task) {
    return $(SELECT_BY_TASK[task])?.value || "";
  }

  function model(task) {
    try { return REGISTRY.model(task, modelId(task)); }
    catch { return null; }
  }

  function adapter(task) {
    try { return ADAPTERS.forModel(task, modelId(task)); }
    catch { return null; }
  }

  function parameters(task) {
    try { return ADAPTERS.parametersFor(task, modelId(task)) || []; }
    catch { return []; }
  }

  function sourceFor(parameter) {
    return parameter?.sourceId ? $(parameter.sourceId) : null;
  }

  function dispatchValue(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function splitBadges(value) {
    return String(value || "")
      .split(/[·|/]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  function capabilityFor(parameter) {
    const key = String(parameter?.key || "").toLowerCase();
    if (key === "size") return "画面尺寸";
    if (key === "resolution" || key === "resolutionpreset") return "清晰度";
    if (key === "ratio") return "画面比例";
    if (key === "duration") return "视频时长";
    if (key === "count") return "批量生成";
    if (key === "tasktypes") return "编辑方式";
    if (key === "preset") return "原生预设";
    if (key === "steps") return "质量调节";
    if (key === "guidance") return "引导强度";
    if (key === "fps") return "帧率";
    if (key === "frames") return "帧数";
    if (key === "seed") return "随机种子";
    return "";
  }

  function capabilityList(task) {
    const params = parameters(task);
    const simple = [];
    const pro = [];
    const seenSimple = new Set();
    const seenPro = new Set();

    for (const parameter of params) {
      const label = capabilityFor(parameter);
      if (!label) continue;
      if (!seenPro.has(label)) {
        seenPro.add(label);
        pro.push(label);
      }
      if (!parameter.advanced && !["引导强度", "帧率", "帧数", "随机种子"].includes(label) && !seenSimple.has(label)) {
        seenSimple.add(label);
        simple.push(label);
      }
    }

    const currentAdapter = adapter(task);
    if (currentAdapter?.id === "wan-i2v" && !seenSimple.has("分段长视频")) simple.push("分段长视频");

    return { simple: simple.slice(0, 6), pro: pro.slice(0, 10) };
  }

  function statusMeta(currentModel) {
    const state = currentModel?.status?.state || "";
    if (state === "verified") return { className: "is-verified", label: currentModel.status.text || "已验证" };
    if (state === "adapted") return { className: "is-adapted", label: currentModel.status.text || "已适配" };
    if (state === "experimental") return { className: "is-experimental", label: currentModel.status.text || "实验" };
    return { className: "is-neutral", label: "可用模型" };
  }

  function durationText(currentModel) {
    const rule = currentModel?.limits?.duration;
    if (!rule) return "";
    const recommended = rule.recommended ?? rule.min;
    return `${rule.min}–${rule.max} 秒 · 推荐 ${recommended} 秒`;
  }

  function defaultSummary(task) {
    const parts = [];
    for (const parameter of parameters(task)) {
      if (parameter.default === undefined) continue;
      if (["openUrl", "watermark", "promptExtend", "zip", "autoFrames"].includes(parameter.key)) continue;
      const key = String(parameter.key || "");
      const value = String(parameter.default);
      const label = ({
        count: "数量",
        resolution: "清晰度",
        duration: "时长",
        seed: "Seed",
        steps: "Steps",
        guidance: "Guidance",
        fps: "FPS",
        frames: "Frames",
      })[key];
      if (!label) continue;
      parts.push(`${label} ${value}${key === "duration" ? "s" : ""}`);
    }
    return parts.slice(0, 6);
  }

  function buildChips(items, className = "") {
    const root = document.createElement("div");
    root.className = `model-guidance-chips${className ? ` ${className}` : ""}`;
    for (const item of items) {
      const chip = document.createElement("span");
      chip.textContent = item;
      root.appendChild(chip);
    }
    return root;
  }

  function setSource(parameter, value) {
    const source = sourceFor(parameter);
    if (!source) return false;
    if (source.type === "checkbox") source.checked = Boolean(value);
    else source.value = String(value);
    dispatchValue(source);
    return true;
  }

  function standardPreset(parameter) {
    const source = sourceFor(parameter);
    if (!source || source.tagName !== "SELECT") return null;
    return [...source.options].find((option) => /(^|\b)(standard|标准)(\b|$)/i.test(`${option.textContent || ""} ${option.value || ""}`))
      || [...source.options].find((option) => /standard|标准/i.test(`${option.textContent || ""} ${option.value || ""}`))
      || null;
  }

  function resetRecommended(task, button) {
    const params = parameters(task);
    let changed = 0;

    const preset = params.find((parameter) => parameter.key === "preset" && sourceFor(parameter));
    if (preset) {
      const option = standardPreset(preset);
      if (option && setSource(preset, option.value)) {
        changed += 1;
        if (preset.triggerClickId) $(preset.triggerClickId)?.click();
      }
    }

    for (const parameter of params) {
      if (parameter === preset || parameter.default === undefined || !sourceFor(parameter)) continue;
      if (setSource(parameter, parameter.default)) changed += 1;
    }

    window.setTimeout(() => {
      window.GiteeModelParameterUI?.render?.(task);
      window.setTimeout(() => {
        syncTask(task);
        window.GiteeExperienceMode?.sync?.();
        window.GiteeSimplePresets?.rebuild?.();
      }, 0);
    }, 0);

    if (button) {
      const original = button.dataset.originalLabel || button.textContent || "恢复推荐设置";
      button.dataset.originalLabel = original;
      button.textContent = changed ? "已恢复推荐设置" : "当前已是推荐设置";
      button.classList.add("is-done");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-done");
      }, 1500);
    }

    window.dispatchEvent(new CustomEvent("gitee-recommended-settings-reset", {
      detail: { task, modelId: modelId(task), changed },
    }));
  }

  function createCard(task) {
    const panel = $(PANEL_BY_TASK[task]);
    if (!panel) return null;

    let root = $(`modelGuidance-${task}`);
    if (!root) {
      root = document.createElement("section");
      root.id = `modelGuidance-${task}`;
      root.className = "model-guidance-card";
    }

    const currentModel = model(task);
    const currentAdapter = adapter(task);
    const status = statusMeta(currentModel);
    const capabilities = capabilityList(task);
    const badges = splitBadges(currentModel?.badge || currentModel?.note);
    const defaults = defaultSummary(task);
    const duration = durationText(currentModel);

    root.replaceChildren();

    const head = document.createElement("div");
    head.className = "model-guidance-head";

    const identity = document.createElement("div");
    identity.className = "model-guidance-identity";
    const eyebrow = document.createElement("span");
    eyebrow.textContent = `${TASK_LABEL[task]} · 当前模型`;
    const title = document.createElement("strong");
    title.textContent = currentModel?.label || modelId(task) || "自定义模型";
    identity.append(eyebrow, title);

    const actions = document.createElement("div");
    actions.className = "model-guidance-actions";
    const state = document.createElement("span");
    state.className = `model-guidance-status ${status.className}`;
    state.textContent = status.label;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "model-guidance-reset";
    reset.textContent = "恢复推荐设置";
    reset.title = "恢复当前 Adapter 明确定义的推荐/默认参数";
    reset.addEventListener("click", () => resetRecommended(task, reset));
    actions.append(state, reset);
    head.append(identity, actions);
    root.appendChild(head);

    if (badges.length) root.appendChild(buildChips(badges, "model-guidance-badges"));

    const detail = document.createElement("div");
    detail.className = "model-guidance-detail";
    if (duration) {
      const row = document.createElement("div");
      row.innerHTML = `<span>时长范围</span><strong>${duration}</strong>`;
      detail.appendChild(row);
    }
    if (currentModel?.status?.detail) {
      const row = document.createElement("div");
      row.innerHTML = `<span>适配状态</span><strong>${currentModel.status.detail}</strong>`;
      detail.appendChild(row);
    }
    const adapterRow = document.createElement("div");
    adapterRow.className = "model-guidance-pro-detail";
    adapterRow.innerHTML = `<span>Adapter</span><strong>${currentAdapter?.id || "unknown"}</strong>`;
    detail.appendChild(adapterRow);
    root.appendChild(detail);

    if (capabilities.simple.length) {
      const section = document.createElement("div");
      section.className = "model-guidance-capabilities model-guidance-simple-detail";
      const label = document.createElement("span");
      label.textContent = "这个模型支持";
      section.append(label, buildChips(capabilities.simple));
      root.appendChild(section);
    }

    if (capabilities.pro.length) {
      const section = document.createElement("div");
      section.className = "model-guidance-capabilities model-guidance-pro-detail";
      const label = document.createElement("span");
      label.textContent = "可调参数";
      section.append(label, buildChips(capabilities.pro));
      root.appendChild(section);
    }

    if (defaults.length) {
      const section = document.createElement("div");
      section.className = "model-guidance-defaults model-guidance-pro-detail";
      const label = document.createElement("span");
      label.textContent = "推荐默认值";
      section.append(label, buildChips(defaults));
      root.appendChild(section);
    }

    const mpHead = panel.querySelector(":scope > .mp-head");
    if (mpHead) mpHead.insertAdjacentElement("afterend", root);
    else panel.prepend(root);
    return root;
  }

  function syncTask(task) {
    createCard(task);
  }

  function syncAll() {
    TASKS.forEach(syncTask);
  }

  function scheduleSync(delay = 0) {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncAll, delay);
  }

  function setupEvents() {
    document.addEventListener("change", (event) => {
      const id = event.target?.id || "";
      if (MODEL_SELECT_IDS.has(id)) {
        scheduleSync(0);
        window.setTimeout(() => scheduleSync(0), 100);
      }
    });
    window.addEventListener("gitee-experience-mode-change", () => scheduleSync(0));
    window.addEventListener("gitee-studio-drawer-open", () => scheduleSync(0));
  }

  function injectStyles() {
    if ($("modelGuidanceStyles")) return;
    const style = document.createElement("style");
    style.id = "modelGuidanceStyles";
    style.textContent = `
      .model-guidance-card{display:grid;gap:9px;margin:0 0 12px;padding:11px;border:1px solid color-mix(in srgb,var(--accent) 13%,var(--border-light));border-radius:12px;background:color-mix(in srgb,var(--card) 92%,var(--studio-soft))}
      .model-guidance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.model-guidance-identity{display:grid;gap:2px;min-width:0}.model-guidance-identity>span{font-size:8.5px;font-weight:800;letter-spacing:.07em;color:var(--muted)}.model-guidance-identity>strong{overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--text)}
      .model-guidance-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}.model-guidance-status{padding:4px 7px;border-radius:999px;font-size:8.5px;font-weight:800;background:var(--studio-soft);color:var(--muted)}.model-guidance-status.is-verified{background:rgba(16,185,129,.11);color:#059669}.model-guidance-status.is-adapted{background:rgba(59,130,246,.10);color:#2563eb}.model-guidance-status.is-experimental{background:rgba(245,158,11,.11);color:#d97706}
      .model-guidance-reset{height:27px;padding:0 8px;border:1px solid var(--border-light);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:9px;font-weight:750;cursor:pointer;transition:border-color .14s ease,background .14s ease,transform .14s ease}.model-guidance-reset:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--border-light));background:var(--btn-hover-bg);transform:translateY(-1px)}.model-guidance-reset.is-done{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 35%,var(--border-light))}
      .model-guidance-chips{display:flex;gap:5px;flex-wrap:wrap}.model-guidance-chips>span{padding:3px 6px;border-radius:999px;background:var(--studio-soft);color:var(--muted);font-size:8.5px;line-height:1.25}.model-guidance-badges>span{background:color-mix(in srgb,var(--accent) 7%,var(--studio-soft));color:var(--text)}
      .model-guidance-detail{display:grid;gap:5px}.model-guidance-detail>div{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;font-size:9px}.model-guidance-detail>div>span{color:var(--muted);flex:0 0 auto}.model-guidance-detail>div>strong{color:var(--text);font-size:9px;font-weight:650;text-align:right;line-height:1.35}
      .model-guidance-capabilities,.model-guidance-defaults{display:grid;gap:5px;padding-top:7px;border-top:1px dashed var(--border-light)}.model-guidance-capabilities>span,.model-guidance-defaults>span{font-size:8.5px;font-weight:750;color:var(--muted)}
      html[data-experience-mode="simple"] .model-guidance-pro-detail{display:none!important}html[data-experience-mode="pro"] .model-guidance-simple-detail{display:none!important}
      @media(max-width:560px){.model-guidance-head{display:grid}.model-guidance-actions{justify-content:space-between}.model-guidance-reset{min-height:30px}.model-guidance-detail>div{display:grid;gap:2px}.model-guidance-detail>div>strong{text-align:left}}
      @media(prefers-reduced-motion:reduce){.model-guidance-reset{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    setupEvents();
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(syncAll)));
    window.setTimeout(() => scheduleSync(0), 180);
  }

  window.GiteeModelGuidance = Object.freeze({
    sync: () => scheduleSync(0),
    resetRecommended: (task) => resetRecommended(task),
  });

  window.addEventListener("DOMContentLoaded", init);
})();