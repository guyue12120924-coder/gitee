(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TRACKER = window.GiteeTaskTracker;
  const FUNCTION_VALUES = { edit: "Edit-2511", i2v: "Wan2.2-I2V-A14B" };
  const INPUT_IDS = { edit: "editImg1", i2v: "wanImg" };
  const PROMPT_IDS = { "z-image": "zPrompt", "Edit-2511": "editPrompt", "Wan2.2-I2V-A14B": "wanPrompt", "HunyuanVideo-1.5": "hyPrompt" };
  const BUTTON_IDS = { "z-image": "btnZRun", "Edit-2511": "btnEditRun", "Wan2.2-I2V-A14B": "btnWanRun", "HunyuanVideo-1.5": "btnHyRun" };
  const CHOICE_KEYS = new Set(["size", "ratio", "resolution"]);

  function dispatch(el, type = "change") {
    if (el) el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function dispatchValue(el) {
    if (!el) return;
    dispatch(el, "input");
    dispatch(el, "change");
  }

  function showToast(message, kind = "info") {
    let toast = $("studioToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "studioToast";
      toast.className = "studio-toast";
      document.body.appendChild(toast);
    }
    toast.className = `studio-toast is-visible studio-toast-${kind}`;
    toast.textContent = message;
    clearTimeout(window.__studioToastTimer);
    window.__studioToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  async function imageFileFromSrc(src) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`读取生成图片失败 HTTP ${response.status}`);
    const blob = await response.blob();
    const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("jpeg") ? "jpg" : "png";
    return new File([blob], `generated-${Date.now()}.${ext}`, { type: blob.type || "image/png" });
  }

  async function sendImageTo(task, src) {
    const input = $(INPUT_IDS[task]);
    const modelSel = $("modelSel");
    if (!input || !modelSel) return;
    try {
      showToast("正在载入生成图片…");
      const file = await imageFileFromSrc(src);
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      dispatch(input);
      modelSel.value = FUNCTION_VALUES[task];
      dispatch(modelSel);
      setTimeout(() => {
        if (window.innerWidth <= 900) document.body.classList.add("studio-inspector-open");
        input.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      showToast(task === "edit" ? "图片已送入图像编辑" : "图片已送入图生视频", "ok");
    } catch (error) {
      showToast(String(error?.message || error), "err");
    }
  }

  function enhanceResultItem(item) {
    if (!item || item.dataset.resultWorkflowActions === "1") return;
    const image = item.querySelector("img");
    if (!image) return;
    item.dataset.resultWorkflowActions = "1";
    item.classList.add("studio-result-card");
    const actions = document.createElement("div");
    actions.className = "studio-result-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "studio-result-action";
    edit.textContent = "编辑";
    edit.title = "将此图直接用于图像编辑";
    edit.addEventListener("click", (event) => { event.stopPropagation(); sendImageTo("edit", image.currentSrc || image.src); });
    const video = document.createElement("button");
    video.type = "button";
    video.className = "studio-result-action";
    video.textContent = "生成视频";
    video.title = "将此图直接用于图生视频";
    video.addEventListener("click", (event) => { event.stopPropagation(); sendImageTo("i2v", image.currentSrc || image.src); });
    actions.append(edit, video);
    image.insertAdjacentElement("afterend", actions);
  }

  function setupResultActions() {
    const output = $("output");
    if (!output) return;
    const sync = () => [...output.querySelectorAll(":scope > .item")].forEach(enhanceResultItem);
    new MutationObserver(sync).observe(output, { childList: true });
    sync();
  }

  function setupPromptAutosize() {
    const prompts = [...new Set(Object.values(PROMPT_IDS))].map($).filter(Boolean);
    const resize = (input) => {
      input.style.height = "auto";
      const max = window.innerWidth <= 900 ? 96 : 108;
      input.style.height = `${Math.max(52, Math.min(max, input.scrollHeight))}px`;
      input.style.overflowY = input.scrollHeight > max ? "auto" : "hidden";
    };
    for (const prompt of prompts) {
      if (prompt.dataset.studioAutosize === "1") continue;
      prompt.dataset.studioAutosize = "1";
      prompt.addEventListener("input", () => resize(prompt));
      resize(prompt);
    }
    window.addEventListener("resize", () => prompts.forEach(resize), { passive: true });
  }

  function parameterKey(control) {
    return String(control?.id || "").replace(/^mp-(?:t2i|edit|i2v|t2v)-/, "");
  }

  function choiceLabel(text) {
    const value = String(text || "").trim();
    const sized = value.match(/^(\d+:\d+)\s*\((\d+)[x*](\d+)\)/i);
    if (sized) return { main: sized[1], sub: `${sized[2]} × ${sized[3]}` };
    return { main: value.replace(/\s*\([^)]*\)\s*$/, ""), sub: "" };
  }

  function syncDecoratedSelect(select) {
    const source = select.dataset.sourceId ? $(select.dataset.sourceId) : null;
    if (source && source.value !== select.value) select.value = source.value;
    const group = select.parentElement?.querySelector(":scope > .studio-choice-grid");
    if (!group) return;
    for (const button of group.querySelectorAll(".studio-choice-button")) {
      const active = button.dataset.value === select.value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function decorateSelect(select, key) {
    if (!CHOICE_KEYS.has(key) || select.options.length < 2 || select.options.length > 8) return;
    if (select.dataset.studioChoice === "1") {
      syncDecoratedSelect(select);
      return;
    }
    select.dataset.studioChoice = "1";
    select.classList.add("studio-native-parameter-control");
    const field = select.closest(".mp-field");
    const label = field?.querySelector(":scope > .mp-label");
    if (label && key === "size") label.textContent = "画面比例";
    if (label && key === "resolution") label.textContent = "清晰度";

    const group = document.createElement("div");
    group.className = `studio-choice-grid studio-choice-grid-${key}`;
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label?.textContent || "参数选择");
    for (const option of [...select.options]) {
      const parsed = choiceLabel(option.textContent || option.value);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "studio-choice-button";
      button.dataset.value = option.value;
      button.innerHTML = `<strong>${parsed.main}</strong>${parsed.sub ? `<span>${parsed.sub}</span>` : ""}`;
      button.addEventListener("click", () => {
        if (select.value === option.value) return;
        select.value = option.value;
        dispatchValue(select);
        syncDecoratedSelect(select);
      });
      group.appendChild(button);
    }
    select.insertAdjacentElement("afterend", group);
    select.addEventListener("change", () => syncDecoratedSelect(select));
    syncDecoratedSelect(select);
  }

  function syncStepper(input) {
    const stepper = input.parentElement?.querySelector(":scope > .studio-stepper");
    if (!stepper) return;
    const value = stepper.querySelector(".studio-stepper-value");
    if (value) value.textContent = input.value || "1";
  }

  function decorateCountStepper(input, key) {
    if (key !== "count") return;
    if (input.dataset.studioStepper === "1") {
      syncStepper(input);
      return;
    }
    input.dataset.studioStepper = "1";
    input.classList.add("studio-native-parameter-control");
    const stepper = document.createElement("div");
    stepper.className = "studio-stepper";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "studio-stepper-button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "减少生成数量");
    const value = document.createElement("span");
    value.className = "studio-stepper-value";
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "studio-stepper-button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "增加生成数量");
    const change = (direction) => {
      const current = Number.parseFloat(input.value || "1") || 1;
      const step = Number.parseFloat(input.step || "1") || 1;
      const min = input.min === "" ? -Infinity : Number.parseFloat(input.min);
      const max = input.max === "" ? Infinity : Number.parseFloat(input.max);
      input.value = String(Math.min(max, Math.max(min, current + direction * step)));
      dispatchValue(input);
      syncStepper(input);
    };
    minus.addEventListener("click", () => change(-1));
    plus.addEventListener("click", () => change(1));
    stepper.append(minus, value, plus);
    input.insertAdjacentElement("afterend", stepper);
    input.addEventListener("input", () => syncStepper(input));
    syncStepper(input);
  }

  function simplifyParameterPanel(panel) {
    if (!panel) return;
    panel.classList.add("studio-parameter-panel");
    const head = panel.querySelector(":scope > .mp-head");
    if (head) head.hidden = true;
    for (const section of panel.querySelectorAll(":scope > .mp-section")) {
      const summary = section.querySelector(":scope > summary");
      const text = summary?.textContent?.trim() || "";
      if (/常用参数/.test(text)) {
        section.classList.add("studio-primary-params");
        section.open = true;
        if (summary) summary.hidden = true;
      } else {
        section.classList.add("studio-advanced-params");
        if (summary) summary.textContent = "高级设置";
      }
    }
    for (const select of panel.querySelectorAll('select[id^="mp-"]')) decorateSelect(select, parameterKey(select));
    for (const input of panel.querySelectorAll('input[type="number"][id^="mp-"]')) decorateCountStepper(input, parameterKey(input));
  }

  function simplifyInspectorChrome() {
    for (const summary of document.querySelectorAll(".studio-model-developer-tools > summary")) summary.textContent = "开发者设置";
    for (const panel of document.querySelectorAll(".mp-panel")) simplifyParameterPanel(panel);

    const state = $("workspaceInspectorState");
    if (state && state.textContent !== "●") {
      const detail = state.textContent.trim();
      if (detail) state.dataset.statusText = detail;
      state.title = state.title || detail;
      state.setAttribute("aria-label", detail || "模型状态");
      state.textContent = "●";
    }
  }

  function setupParameterPolish() {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        simplifyInspectorChrome();
      });
    };
    schedule();
    const host = $("workspaceInspectorHost") || document.body;
    new MutationObserver(schedule).observe(host, { childList: true, subtree: true });
    const state = $("workspaceInspectorState");
    if (state) new MutationObserver(schedule).observe(state, { childList: true, characterData: true, subtree: true });
    document.addEventListener("change", (event) => {
      const id = event.target?.id || "";
      if (/^(zRes|zN|mmI2VRatio|mmI2VResolution|hyAspect|mmT2VResolution)$/.test(id)) schedule();
    });
  }

  function injectRefinementStyles() {
    if ($("studioRefinementStyles")) return;
    const style = document.createElement("style");
    style.id = "studioRefinementStyles";
    style.textContent = `
      @media (min-width: 1181px) {
        .workspace-shell { grid-template-columns:58px minmax(0,1fr) minmax(300px,318px) !important; gap:8px !important; }
      }
      @media (min-width: 901px) and (max-width: 1180px) {
        .workspace-shell { grid-template-columns:56px minmax(0,1fr) 300px !important; gap:8px !important; }
      }
      .workspace-rail { padding-left:5px !important; padding-right:5px !important; }
      .workspace-inspector-head { min-height:48px !important; padding:9px 12px !important; }
      .workspace-inspector-host { padding:10px 11px !important; }
      .workspace-inspector-state {
        width:8px !important; min-width:8px !important; height:8px !important; min-height:8px !important;
        padding:0 !important; border-radius:50% !important; font-size:0 !important; line-height:0 !important;
        background:#94a3b8 !important; color:transparent !important;
      }
      .workspace-inspector-state.is-pass { background:#22c55e !important; box-shadow:0 0 0 4px rgba(34,197,94,.08); }
      .workspace-inspector-state.is-experimental { background:#f59e0b !important; box-shadow:0 0 0 4px rgba(245,158,11,.08); }
      .workspace-inspector-state.is-fail { background:#ef4444 !important; box-shadow:0 0 0 4px rgba(239,68,68,.08); }
      .workspace-inspector-state.is-custom { background:var(--accent) !important; box-shadow:0 0 0 4px rgba(99,102,241,.08); }
      .workspace-inspector .mm-model-box { padding-bottom:10px !important; margin-bottom:9px !important; }
      .workspace-inspector .mp-panel { padding:0 !important; margin:0 !important; border-bottom:0 !important; }
      .workspace-inspector .mp-head { display:none !important; }
      .studio-primary-params { margin:0 !important; padding:0 !important; border:0 !important; }
      .studio-primary-params > summary { display:none !important; }
      .studio-primary-params > .mp-grid { display:grid !important; grid-template-columns:1fr !important; gap:14px !important; padding:2px 0 0 !important; }
      .studio-primary-params .mp-field-help { display:none !important; }
      .studio-advanced-params { margin:12px 0 0 !important; padding:10px 0 0 !important; border-top:1px solid var(--border-light) !important; }
      .studio-advanced-params > summary,
      .studio-model-developer-tools > summary { padding:3px 0 !important; color:var(--muted) !important; font-size:11px !important; font-weight:650 !important; }
      .studio-model-developer-tools { margin-top:8px !important; padding-top:7px !important; }
      .mp-field { position:relative; }
      .workspace-inspector .mp-label { margin-bottom:7px !important; color:var(--text) !important; font-size:12px !important; font-weight:650 !important; }
      .studio-native-parameter-control {
        position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:0 !important;
        opacity:0 !important; pointer-events:none !important; overflow:hidden !important;
      }
      .studio-choice-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
      .studio-choice-button {
        min-height:46px; padding:6px 5px; border:1px solid var(--border-light); border-radius:10px;
        background:var(--studio-soft); color:var(--muted); cursor:pointer; text-align:center; transition:.14s ease;
      }
      .studio-choice-button:hover { border-color:rgba(99,102,241,.28); color:var(--text); }
      .studio-choice-button.is-active { border-color:rgba(99,102,241,.46); background:rgba(99,102,241,.10); color:var(--accent); box-shadow:inset 0 0 0 1px rgba(99,102,241,.08); }
      .studio-choice-button strong { display:block; font-size:12px; line-height:1.2; font-weight:750; }
      .studio-choice-button span { display:block; margin-top:3px; font-size:9px; line-height:1.1; color:var(--muted); }
      .studio-choice-button.is-active span { color:color-mix(in srgb,var(--accent) 58%,var(--muted)); }
      .studio-stepper { display:grid; grid-template-columns:38px minmax(50px,1fr) 38px; align-items:center; width:min(170px,100%); height:40px; border:1px solid var(--border-light); border-radius:10px; overflow:hidden; background:var(--input-bg); }
      .studio-stepper-button { height:100%; border:0; background:transparent; color:var(--muted); font-size:19px; cursor:pointer; }
      .studio-stepper-button:hover { background:var(--btn-bg); color:var(--text); }
      .studio-stepper-value { text-align:center; color:var(--text); font-size:13px; font-weight:750; }
      .workspace-composer { padding:6px 8px !important; border-radius:14px !important; }
      .workspace-composer-input { min-height:52px !important; max-height:108px !important; padding:9px 11px !important; }
      .workspace-composer-actions { height:46px !important; }
      .workspace-generate-button { width:104px !important; min-width:104px !important; height:46px !important; }
      .workspace-composer .prompt-toolbox { margin-bottom:1px !important; }
      .workspace-composer .prompt-toolbox .btn { min-height:26px !important; padding:3px 7px !important; }
      .studio-model-picker .input { min-height:38px !important; }
      @media (max-width:900px) {
        .workspace-shell { grid-template-columns:1fr !important; grid-template-rows:auto minmax(520px,auto) auto !important; gap:8px !important; }
        .studio-choice-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .workspace-composer-input { min-height:50px !important; max-height:96px !important; }
        .workspace-generate-button { width:92px !important; min-width:92px !important; }
      }
      @media (max-width:560px) {
        .studio-choice-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function setupSettingsExtras() {
    const body = $("studioDrawerBody-settings");
    if (!body || $("studioSettingsExtras")) return;
    const apiTitle = body.querySelector(".workspace-api-card h2");
    if (apiTitle) apiTitle.textContent = "Gitee AI API";
    const box = document.createElement("section");
    box.id = "studioSettingsExtras";
    box.className = "studio-settings-extras";
    box.innerHTML = `<div class="studio-settings-section-title">快捷入口</div><div class="studio-settings-links"><a class="btn" href="https://ai.gitee.com/serverless-api" target="_blank" rel="noopener">API 管理</a><a class="btn" href="https://github.com/MallocPointer/gitee/" target="_blank" rel="noopener">GitHub</a><button type="button" class="btn" id="studioSponsorShortcut">赞助项目</button></div><div class="studio-settings-tip">API Key 仅保存在当前浏览器；生成请求仍通过本站 Cloudflare 代理转发到 Gitee AI。</div>`;
    body.insertBefore(box, body.firstChild);
    $("studioSponsorShortcut")?.addEventListener("click", () => $("donateBtn")?.click());
    document.querySelector('.topbar-right > a[href*="github.com"]')?.classList.add("studio-top-secondary");
    $("donateBtn")?.classList.add("studio-top-secondary");
  }

  function setTaskBadge(count) {
    const targets = [$("studioTaskBtn"), ...document.querySelectorAll('[data-drawer="tasks"]')];
    for (const target of targets) {
      if (!target) continue;
      let badge = target.querySelector(".studio-count-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "studio-count-badge";
        target.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.hidden = count < 1;
    }
  }

  function updateTaskBadge() {
    if (!TRACKER?.list) return;
    const active = TRACKER.list().filter((run) => !run.finishedAt && !["success", "failed", "cancelled"].includes(run.state)).length;
    setTaskBadge(active);
  }

  function setupTaskBadge() {
    updateTaskBadge();
    TRACKER?.subscribe?.(() => updateTaskBadge());
  }

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const active = document.activeElement;
      const typing = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        const value = $("modelSel")?.value || "z-image";
        const button = $(BUTTON_IDS[value]);
        if (button && !button.disabled) {
          event.preventDefault();
          button.click();
        }
        return;
      }
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const value = $("modelSel")?.value || "z-image";
        const prompt = $(PROMPT_IDS[value]);
        if (prompt) {
          event.preventDefault();
          prompt.focus();
        }
      }
      if (event.key === "Escape") document.body.classList.remove("studio-inspector-open");
    });
  }

  function init() {
    injectRefinementStyles();
    setupResultActions();
    setupPromptAutosize();
    setupSettingsExtras();
    setupTaskBadge();
    setupKeyboardShortcuts();
    setupParameterPolish();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init))));
})();
