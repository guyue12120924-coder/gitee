(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "imageview_experience_mode_v1";
  const SIMPLE = "simple";
  const PRO = "pro";
  const MODEL_SELECT_IDS = new Set(["mmT2IModel", "mmEditModel", "mmI2VModel", "mmT2VModel", "modelSel"]);
  const TECHNICAL_KEY = /(?:^|[-_])(seed|steps?|guidance|guidanceScale|fps|frames?|numFrames|num_frames|width|height|watermark|promptExtend|prompt_extend|zipSegments|openUrl)(?:$|[-_])/i;
  const TECHNICAL_LABEL = /(随机种子|\bseed\b|推理步数|\bsteps?\b|guidance|引导系数|\bfps\b|帧数|num[_ ]?frames?|width|height|宽度|高度|watermark|水印|prompt[_ ]?extend|自动扩写|打开 file_url|zip)/i;

  let mode = loadMode();
  let syncTimer = 0;

  function loadMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === PRO ? PRO : SIMPLE;
    } catch {
      return SIMPLE;
    }
  }

  function persistMode() {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }

  function modeLabel(value = mode) {
    return value === PRO ? "专业模式" : "简洁模式";
  }

  function fieldIdentity(field) {
    const control = field?.querySelector?.('[id^="mp-"]');
    const id = control?.id || "";
    const label = field?.querySelector?.(".mp-label")?.textContent?.trim() || "";
    return `${id} ${label}`;
  }

  function shouldStaySimple(field) {
    if (!field) return false;
    return field.matches?.(".studio-hunyuan-duration-field,.studio-wan-format-field") ||
      Boolean(field.querySelector?.(".studio-human-duration,.studio-friendly-options,.studio-choice-grid,.studio-stepper"));
  }

  function classifyField(field) {
    if (!field?.classList) return;
    field.classList.remove("experience-technical-field");
    if (shouldStaySimple(field)) return;
    const identity = fieldIdentity(field);
    if (TECHNICAL_KEY.test(identity) || TECHNICAL_LABEL.test(identity)) field.classList.add("experience-technical-field");
  }

  function classifyLayers() {
    for (const section of document.querySelectorAll(".studio-advanced-params")) section.classList.add("experience-advanced-layer");
    for (const section of document.querySelectorAll(".studio-model-developer-tools")) section.classList.add("experience-developer-layer");
    for (const section of document.querySelectorAll(".studio-secondary-field")) section.classList.add("experience-secondary-layer");
    for (const field of document.querySelectorAll(".mp-panel .mp-field")) classifyField(field);

    for (const panel of document.querySelectorAll(".mp-panel")) {
      panel.dataset.experienceLayered = "1";
      const advanced = panel.querySelector(".experience-advanced-layer");
      if (advanced && mode === PRO && !advanced.hasAttribute("data-experience-opened")) {
        advanced.open = false;
        advanced.dataset.experienceOpened = "1";
      }
    }
  }

  function syncSwitch() {
    const switcher = $("experienceModeSwitch");
    if (!switcher) return;
    for (const button of switcher.querySelectorAll("[data-experience-mode]")) {
      const active = button.dataset.experienceMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    switcher.dataset.mode = mode;
    switcher.title = mode === SIMPLE
      ? "简洁模式只显示常用设置；切换到专业模式可查看完整技术参数"
      : "专业模式显示完整模型参数与开发者设置";

    const note = $("experienceModeNote");
    if (note) note.textContent = mode === SIMPLE ? "只显示常用设置" : "完整参数与开发者设置";
  }

  function applyMode(nextMode, options = {}) {
    const normalized = nextMode === PRO ? PRO : SIMPLE;
    const changed = normalized !== mode;
    mode = normalized;
    document.documentElement.dataset.experienceMode = mode;
    document.body?.classList.toggle("studio-experience-simple", mode === SIMPLE);
    document.body?.classList.toggle("studio-experience-pro", mode === PRO);
    syncSwitch();
    classifyLayers();
    if (options.persist !== false) persistMode();

    if (changed || options.forceEvent) {
      window.dispatchEvent(new CustomEvent("gitee-experience-mode-change", {
        detail: { mode, label: modeLabel() },
      }));
    }
  }

  function setMode(nextMode) {
    applyMode(nextMode, { persist: true, forceEvent: true });
  }

  function createSwitcher() {
    if ($("experienceModeSwitch")) return true;
    const actions = document.querySelector("#workspaceInspector .workspace-inspector-head-actions");
    if (!actions) return false;

    const root = document.createElement("div");
    root.id = "experienceModeSwitch";
    root.className = "experience-mode-switch";
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "参数显示模式");

    const simple = document.createElement("button");
    simple.type = "button";
    simple.dataset.experienceMode = SIMPLE;
    simple.textContent = "简洁";
    simple.addEventListener("click", () => setMode(SIMPLE));

    const pro = document.createElement("button");
    pro.type = "button";
    pro.dataset.experienceMode = PRO;
    pro.textContent = "专业";
    pro.addEventListener("click", () => setMode(PRO));

    root.append(simple, pro);
    const state = $("workspaceInspectorState");
    actions.insertBefore(root, state || actions.firstChild);

    const head = document.querySelector("#workspaceInspector .workspace-inspector-head");
    if (head && !$("experienceModeNote")) {
      const note = document.createElement("span");
      note.id = "experienceModeNote";
      note.className = "experience-mode-note";
      head.appendChild(note);
    }
    syncSwitch();
    return true;
  }

  function scheduleLayerSync(delay = 0) {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      createSwitcher();
      classifyLayers();
      syncSwitch();
    }, delay);
  }

  function setupChangeSync() {
    document.addEventListener("change", (event) => {
      if (!MODEL_SELECT_IDS.has(event.target?.id || "")) return;
      scheduleLayerSync(0);
      window.setTimeout(() => scheduleLayerSync(0), 80);
    });

    window.addEventListener("gitee-studio-drawer-open", () => scheduleLayerSync(0));
  }

  function waitForInspector(frame = 0) {
    if (createSwitcher()) {
      classifyLayers();
      syncSwitch();
      return;
    }
    if (frame < 90) requestAnimationFrame(() => waitForInspector(frame + 1));
  }

  function injectStyles() {
    if ($("experienceModeStyles")) return;
    const style = document.createElement("style");
    style.id = "experienceModeStyles";
    style.textContent = `
      .experience-mode-switch{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--border-light);border-radius:9px;background:var(--studio-soft)}
      .experience-mode-switch>button{height:25px;min-width:42px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:9.5px;font-weight:700;cursor:pointer;transition:background .14s ease,color .14s ease,box-shadow .14s ease}
      .experience-mode-switch>button:hover{color:var(--text)}
      .experience-mode-switch>button.is-active{background:var(--card);color:var(--text);box-shadow:0 1px 5px rgba(0,0,0,.10)}
      .experience-mode-note{display:none;color:var(--muted);font-size:9px;white-space:nowrap}

      html[data-experience-mode="simple"] .experience-advanced-layer,
      html[data-experience-mode="simple"] .experience-developer-layer,
      html[data-experience-mode="simple"] .experience-secondary-layer,
      html[data-experience-mode="simple"] .experience-technical-field{display:none!important}

      html[data-experience-mode="simple"] .workspace-inspector-host{gap:10px}
      html[data-experience-mode="simple"] .studio-primary-params{margin-top:0!important}
      html[data-experience-mode="simple"] .studio-primary-params>.mp-grid{gap:12px!important}
      html[data-experience-mode="pro"] .experience-advanced-layer,
      html[data-experience-mode="pro"] .experience-developer-layer,
      html[data-experience-mode="pro"] .experience-secondary-layer{display:block}

      @media(max-width:900px){
        .experience-mode-switch>button{height:28px;min-width:46px;font-size:10px}
        .workspace-inspector-head{flex-wrap:wrap}
      }
      @media(max-width:430px){
        .experience-mode-switch{margin-left:auto}
        .experience-mode-note{display:none}
      }
      @media(prefers-reduced-motion:reduce){.experience-mode-switch>button{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    applyMode(mode, { persist: false });
    setupChangeSync();
    waitForInspector();
    window.setTimeout(() => scheduleLayerSync(0), 120);
  }

  window.GiteeExperienceMode = Object.freeze({
    getMode: () => mode,
    setMode,
    sync: () => scheduleLayerSync(0),
    isSimple: () => mode === SIMPLE,
    isPro: () => mode === PRO,
  });

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(init));
  });
})();