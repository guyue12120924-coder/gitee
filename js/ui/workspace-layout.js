(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const REGISTRY = window.GiteeModelRegistry;
  const FUNCTION_TASKS = {
    "z-image": { task: "t2i", title: "文生图", sub: "Text to Image", icon: "✦", selectId: "mmT2IModel", panelId: "panelZ", promptId: "zPrompt", buttonId: "btnZRun" },
    "Edit-2511": { task: "edit", title: "图像编辑", sub: "Image Edit", icon: "◐", selectId: "mmEditModel", panelId: "panelEdit", promptId: "editPrompt", buttonId: "btnEditRun" },
    "Wan2.2-I2V-A14B": { task: "i2v", title: "图生视频", sub: "Image to Video", icon: "▶", selectId: "mmI2VModel", panelId: "panelWan", promptId: "wanPrompt", buttonId: "btnWanRun" },
    "HunyuanVideo-1.5": { task: "t2v", title: "文生视频", sub: "Text to Video", icon: "◆", selectId: "mmT2VModel", panelId: "panelHunyuan", promptId: "hyPrompt", buttonId: "btnHyRun" },
  };

  let shell;
  let rail;
  let canvas;
  let inspector;
  let inspectorHost;
  let composer;
  let composerSlots;
  let previewWorkflow;
  let previewModel;
  let emptyPreview;
  let outputObserver;
  let utilityObserver;
  let drawerMask;
  let openDrawerName = "";

  function activeValue() {
    return $("modelSel")?.value || "z-image";
  }

  function activeFunction() {
    return FUNCTION_TASKS[activeValue()] || FUNCTION_TASKS["z-image"];
  }

  function currentModelText() {
    const conf = activeFunction();
    const select = $(conf.selectId);
    if (!select) return "模型加载中";
    if (select.value === "__custom__") return $(`mm-${conf.task}-custom-id`)?.value?.trim() || "自定义模型";
    return select.value || select.selectedOptions?.[0]?.textContent || "未选择";
  }

  function dispatch(el, type = "change") {
    if (el) el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function createTopActions() {
    const right = document.querySelector(".topbar-right");
    if (!right || $("studioTaskBtn")) return;
    const status = right.querySelector(".status");
    const make = (id, label, drawer, icon, extraClass = "") => {
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = `top-icon-btn studio-top-action ${extraClass}`.trim();
      button.dataset.drawer = drawer;
      button.title = label;
      button.setAttribute("aria-label", label);
      button.innerHTML = `<span class="studio-top-icon">${icon}</span><span>${label}</span>`;
      button.addEventListener("click", () => toggleDrawer(drawer));
      return button;
    };
    const nodes = [
      make("studioTaskBtn", "任务", "tasks", "◷"),
      make("studioHistoryBtn", "历史", "history", "◫", "studio-history-top-action"),
      make("studioSettingsBtn", "设置", "settings", "⚙"),
    ];
    for (const node of nodes) right.insertBefore(node, status || right.firstChild);
  }

  function createDrawers() {
    if ($("studioDrawerMask")) return;
    drawerMask = document.createElement("div");
    drawerMask.id = "studioDrawerMask";
    drawerMask.className = "studio-drawer-mask";
    drawerMask.addEventListener("click", closeDrawers);
    document.body.appendChild(drawerMask);

    for (const [name, title] of [["tasks", "生成任务"], ["history", "历史记录"], ["settings", "设置"]]) {
      const drawer = document.createElement("aside");
      drawer.id = `studioDrawer-${name}`;
      drawer.className = `studio-drawer studio-drawer-${name}`;
      drawer.setAttribute("aria-hidden", "true");
      const subtitle = name === "tasks" ? "查看当前生成进度" : name === "history" ? "查找和复用历史创作" : "连接、外观与开发设置";
      drawer.innerHTML = `<div class="studio-drawer-head"><div><strong>${title}</strong><span>${subtitle}</span></div><button type="button" class="studio-drawer-close" aria-label="关闭">×</button></div><div class="studio-drawer-body" id="studioDrawerBody-${name}"></div>`;
      drawer.querySelector(".studio-drawer-close")?.addEventListener("click", closeDrawers);
      document.body.appendChild(drawer);
    }
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawers(); });
  }

  function toggleDrawer(name) {
    if (openDrawerName === name) closeDrawers();
    else openDrawer(name);
  }

  function openDrawer(name) {
    closeDrawers(false);
    const drawer = $(`studioDrawer-${name}`);
    if (!drawer) return;
    openDrawerName = name;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    drawerMask?.classList.add("is-open");
    document.body.classList.add("studio-drawer-open");
    for (const button of document.querySelectorAll(`[data-drawer="${name}"]`)) button.classList.add("is-active");
    window.dispatchEvent(new CustomEvent("gitee-studio-drawer-open", { detail: { name } }));
  }

  function closeDrawers(clearName = true) {
    for (const drawer of document.querySelectorAll(".studio-drawer")) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
    drawerMask?.classList.remove("is-open");
    document.body.classList.remove("studio-drawer-open");
    for (const button of document.querySelectorAll("[data-drawer]")) button.classList.remove("is-active");
    if (clearName) openDrawerName = "";
  }

  function createStructure(container) {
    if ($("workspaceShell")) return;
    shell = document.createElement("section");
    shell.id = "workspaceShell";
    shell.className = "workspace-shell studio-shell";

    rail = document.createElement("nav");
    rail.id = "workspaceRail";
    rail.className = "workspace-rail";
    rail.setAttribute("aria-label", "创作工作流");

    canvas = document.createElement("main");
    canvas.id = "workspaceMain";
    canvas.className = "workspace-main studio-canvas";

    inspector = document.createElement("aside");
    inspector.id = "workspaceInspector";
    inspector.className = "workspace-inspector";
    inspector.innerHTML = `<div class="workspace-inspector-head"><div class="workspace-inspector-title"><span>生成设置</span><strong id="workspaceInspectorTitle">文生图</strong></div><div class="workspace-inspector-head-actions"><span id="workspaceInspectorState" class="workspace-inspector-state">已适配</span><button type="button" class="workspace-inspector-mobile-close" aria-label="关闭参数">×</button></div></div>`;
    inspectorHost = document.createElement("div");
    inspectorHost.id = "workspaceInspectorHost";
    inspectorHost.className = "workspace-inspector-host";
    inspector.appendChild(inspectorHost);
    inspector.querySelector(".workspace-inspector-mobile-close")?.addEventListener("click", () => document.body.classList.remove("studio-inspector-open"));

    composer = document.createElement("section");
    composer.id = "workspaceComposer";
    composer.className = "workspace-composer";
    composer.innerHTML = `<div class="workspace-composer-top"><span class="workspace-composer-caption">描述你的想法</span><button type="button" class="btn studio-inspector-toggle" id="studioInspectorToggle">参数</button></div><div id="workspaceComposerSlots" class="workspace-composer-slots"></div>`;
    composerSlots = composer.querySelector("#workspaceComposerSlots");
    composer.querySelector("#studioInspectorToggle")?.addEventListener("click", () => document.body.classList.toggle("studio-inspector-open"));

    shell.append(rail, canvas, inspector, composer);
    const loading = $("globalLoading");
    if (loading?.nextSibling) container.insertBefore(shell, loading.nextSibling);
    else container.appendChild(shell);
  }

  function createRail() {
    if (!rail || rail.childElementCount) return;
    const workflows = document.createElement("div");
    workflows.className = "workspace-rail-workflows";
    for (const [value, conf] of Object.entries(FUNCTION_TASKS)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-rail-button";
      button.dataset.functionValue = value;
      button.title = `${conf.title} / ${conf.sub}`;
      button.innerHTML = `<span class="workspace-rail-icon">${conf.icon}</span><span class="workspace-rail-label">${conf.title}</span>`;
      button.addEventListener("click", () => {
        const select = $("modelSel");
        if (!select || select.value === value) return;
        select.value = value;
        dispatch(select);
      });
      workflows.appendChild(button);
    }
    rail.appendChild(workflows);

    const utility = document.createElement("div");
    utility.className = "workspace-rail-utility";
    const history = document.createElement("button");
    history.type = "button";
    history.className = "workspace-rail-button workspace-rail-utility-button";
    history.dataset.drawer = "history";
    history.title = "历史记录";
    history.innerHTML = `<span class="workspace-rail-icon">◫</span><span class="workspace-rail-label">历史</span>`;
    history.addEventListener("click", () => toggleDrawer("history"));
    utility.appendChild(history);
    rail.appendChild(utility);
  }

  function createPreviewHeader(outputCard) {
    if ($("workspacePreviewSummary")) return;
    const header = document.createElement("div");
    header.id = "workspacePreviewSummary";
    header.className = "workspace-preview-summary";
    header.innerHTML = `<div class="workspace-preview-title"><span id="workspaceWorkflowValue">文生图</span><strong id="workspaceModelValue">模型加载中</strong></div><div class="workspace-preview-actions"><button type="button" class="workspace-preview-action" id="studioCompareToggle">对比</button><span class="workspace-preview-clear-host"></span></div>`;
    outputCard.insertBefore(header, outputCard.firstChild);
    previewWorkflow = $("workspaceWorkflowValue");
    previewModel = $("workspaceModelValue");

    const clearButton = $("btnClearOutput");
    const clearHost = header.querySelector(".workspace-preview-clear-host");
    if (clearButton && clearHost) {
      clearButton.classList.add("workspace-preview-action");
      clearButton.textContent = "清空";
      clearHost.appendChild(clearButton);
    }
    header.querySelector("#studioCompareToggle")?.addEventListener("click", () => {
      const panel = $("modelComparePanel");
      if (!panel || panel.hidden) return;
      panel.open = !panel.open;
      if (panel.open) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function createEmptyPreview(outputCard) {
    const output = $("output");
    if (!output || $("workspacePreviewEmpty")) return;
    emptyPreview = document.createElement("div");
    emptyPreview.id = "workspacePreviewEmpty";
    emptyPreview.className = "workspace-preview-empty";
    emptyPreview.innerHTML = `<div class="workspace-empty-art"><span>✦</span></div><div><strong>描述你的想法</strong><p>输入 Prompt，然后开始创作。</p></div>`;
    outputCard.insertBefore(emptyPreview, output);
    const sync = () => {
      const items = [...output.querySelectorAll(":scope > .item")];
      emptyPreview.hidden = items.length > 0;
      for (const item of items) enhanceOutputItem(item);
    };
    outputObserver?.disconnect();
    outputObserver = new MutationObserver(sync);
    outputObserver.observe(output, { childList: true });
    sync();
  }

  function enhanceOutputItem(item) {
    if (!item || item.dataset.studioEnhanced === "1") return;
    item.dataset.studioEnhanced = "1";
    const pre = item.querySelector(":scope > pre");
    if (pre) {
      const details = document.createElement("details");
      details.className = "studio-output-debug";
      const summary = document.createElement("summary");
      summary.textContent = "调试信息";
      pre.insertAdjacentElement("beforebegin", details);
      details.append(summary, pre);
    }
    const image = item.querySelector("img");
    if (image) {
      image.loading = "lazy";
      image.decoding = "async";
      image.classList.add("studio-preview-media");
      image.addEventListener("click", () => openLightbox(image.src, item.querySelector("h3")?.textContent || "生成结果"));
    }
    const video = item.querySelector("video");
    if (video) video.preload = "metadata";
  }

  function openLightbox(src, title) {
    if (!src) return;
    let lightbox = $("studioLightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "studioLightbox";
      lightbox.className = "studio-lightbox";
      lightbox.innerHTML = `<button type="button" class="studio-lightbox-close" aria-label="关闭">×</button><div class="studio-lightbox-stage"><img alt="生成结果预览" decoding="async" /></div><div class="studio-lightbox-title"></div>`;
      lightbox.addEventListener("click", (event) => { if (event.target === lightbox) lightbox.classList.remove("is-open"); });
      lightbox.querySelector(".studio-lightbox-close")?.addEventListener("click", () => lightbox.classList.remove("is-open"));
      document.body.appendChild(lightbox);
    }
    lightbox.querySelector("img").src = src;
    lightbox.querySelector(".studio-lightbox-title").textContent = title;
    lightbox.classList.add("is-open");
  }

  function prepareComposerSlot(value, conf) {
    const panel = $(conf.panelId);
    const prompt = $(conf.promptId);
    const button = $(conf.buttonId);
    if (!panel || !prompt || !button || $(`workspaceComposer-${conf.task}`)) return;

    const slot = document.createElement("div");
    slot.id = `workspaceComposer-${conf.task}`;
    slot.className = "workspace-composer-slot";
    slot.dataset.functionValue = value;

    const promptLabel = prompt.previousElementSibling?.classList?.contains("lab") ? prompt.previousElementSibling : null;
    if (promptLabel) {
      promptLabel.classList.add("workspace-composer-label");
      slot.appendChild(promptLabel);
    }
    prompt.classList.add("workspace-composer-input");
    slot.appendChild(prompt);

    const actionRow = button.closest(".row") || button.parentElement;
    if (actionRow) {
      actionRow.classList.add("workspace-composer-actions");
      button.classList.add("workspace-generate-button");
      button.textContent = conf.task.includes("2v") ? "生成视频" : conf.task === "edit" ? "开始编辑" : "生成图片";
      slot.appendChild(actionRow);
    }
    composerSlots?.appendChild(slot);
  }

  function modelStatus(conf) {
    const select = $(conf.selectId);
    if (!select || select.value === "__custom__") return { text: "自定义", state: "custom", detail: "使用自定义模型配置" };
    const health = $(`mmHealth-${conf.task}`)?.textContent?.trim() || "";
    if (/失败|fail/i.test(health)) return { text: "需检查", state: "fail", detail: health };
    if (/通过|verified|成功/i.test(health)) return { text: "已验证", state: "pass", detail: health };
    const model = REGISTRY?.model?.(conf.task, select.value);
    const state = model?.status?.state || "adapted";
    if (state === "verified") return { text: "已验证", state: "pass", detail: model?.badge || "稳定模型" };
    if (state === "experimental") return { text: "实验", state: "experimental", detail: model?.badge || "建议先小规模测试" };
    return { text: "已适配", state: "adapted", detail: model?.badge || "已接入当前工作流" };
  }

  function updateModelSummary(conf) {
    const status = modelStatus(conf);
    const state = $("workspaceInspectorState");
    if (state) {
      state.textContent = status.text;
      state.className = `workspace-inspector-state is-${status.state}`;
      state.title = status.detail;
    }
    const summary = $(`studioModelSummary-${conf.task}`);
    if (!summary) return;
    const model = REGISTRY?.model?.(conf.task, $(conf.selectId)?.value);
    const strong = summary.querySelector("strong");
    const span = summary.querySelector("span");
    if (strong) strong.textContent = currentModelText();
    if (span) span.textContent = $(conf.selectId)?.value === "__custom__" ? "自定义模型配置" : (model?.badge || status.detail || "Gitee AI 模型");
  }

  function simplifyInspectorPanel(conf) {
    const panel = $(conf.panelId);
    const modelBox = $(conf.selectId)?.closest(".mm-model-box");
    if (!panel || !modelBox || modelBox.dataset.studioSimplified === "1") return;
    modelBox.dataset.studioSimplified = "1";

    const pickerGrid = modelBox.querySelector(":scope > .grid2");
    const picker = pickerGrid?.children?.[0];
    const technicalNote = pickerGrid?.children?.[1];
    if (pickerGrid) pickerGrid.classList.add("studio-model-picker-grid");
    if (picker) {
      picker.classList.add("studio-model-picker");
      const label = picker.querySelector(".lab");
      if (label) label.textContent = "模型";
    }

    const summary = document.createElement("div");
    summary.id = `studioModelSummary-${conf.task}`;
    summary.className = "studio-model-summary";
    summary.innerHTML = `<div><strong></strong><span></span></div>`;
    pickerGrid?.insertAdjacentElement("afterend", summary);

    const advanced = document.createElement("details");
    advanced.className = "studio-model-developer-tools";
    advanced.innerHTML = `<summary>高级与诊断</summary><div class="studio-model-developer-body"></div>`;
    const body = advanced.querySelector(".studio-model-developer-body");
    const endpointDetails = [...modelBox.children].find((node) => node.tagName === "DETAILS" && node !== advanced);
    const health = modelBox.querySelector(":scope > .mm-health-row");
    const trial = modelBox.querySelector(":scope > [data-video-trial-notice]");
    if (technicalNote) {
      technicalNote.classList.add("studio-model-tech-note");
      body?.appendChild(technicalNote);
    }
    if (endpointDetails) body?.appendChild(endpointDetails);
    if (health) body?.appendChild(health);
    if (trial) body?.appendChild(trial);
    modelBox.appendChild(advanced);
    updateModelSummary(conf);
  }

  function moveCorePanels() {
    const apiCard = $("apiKey")?.closest(".card");
    const functionCard = $("modelSel")?.closest(".card");
    const outputCard = $("output")?.closest(".card");
    if (!apiCard || !functionCard || !outputCard || !canvas || !inspectorHost) return false;

    apiCard.classList.add("workspace-api-card");
    functionCard.classList.add("workspace-function-card", "studio-compat-card");
    const settingsBody = $("studioDrawerBody-settings");
    if (settingsBody) {
      settingsBody.appendChild(apiCard);
      const developer = document.createElement("details");
      developer.className = "studio-settings-developer";
      developer.innerHTML = `<summary>开发者选项</summary><div class="studio-settings-developer-body"></div>`;
      developer.querySelector(".studio-settings-developer-body")?.appendChild(functionCard);
      settingsBody.appendChild(developer);
    }

    for (const [value, conf] of Object.entries(FUNCTION_TASKS)) {
      const panel = $(conf.panelId);
      if (!panel) continue;
      panel.classList.add("workspace-inspector-panel");
      inspectorHost.appendChild(panel);
      simplifyInspectorPanel(conf);
      prepareComposerSlot(value, conf);
    }

    outputCard.classList.add("workspace-output-card");
    canvas.appendChild(outputCard);
    createPreviewHeader(outputCard);
    createEmptyPreview(outputCard);
    adoptUtilityPanels();
    return true;
  }

  function adoptUtilityPanels() {
    const taskCenter = $("taskCenter");
    const historyCenter = $("historyCenter");
    const taskBody = $("studioDrawerBody-tasks");
    const historyBody = $("studioDrawerBody-history");
    if (taskCenter && taskBody && taskCenter.parentElement !== taskBody) taskBody.appendChild(taskCenter);
    if (historyCenter && historyBody && historyCenter.parentElement !== historyBody) historyBody.appendChild(historyCenter);
    return Boolean(taskCenter && historyCenter && taskBody && historyBody && taskCenter.parentElement === taskBody && historyCenter.parentElement === historyBody);
  }

  function syncActiveUi() {
    const value = activeValue();
    const conf = activeFunction();
    for (const button of document.querySelectorAll(".workspace-rail-button[data-function-value]")) {
      const active = button.dataset.functionValue === value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    }
    for (const panel of document.querySelectorAll(".workspace-inspector-panel")) panel.hidden = panel.id !== conf.panelId;
    for (const slot of document.querySelectorAll(".workspace-composer-slot")) slot.hidden = slot.dataset.functionValue !== value;
    const title = $("workspaceInspectorTitle");
    if (title) title.textContent = conf.title;
    if (previewWorkflow) previewWorkflow.textContent = conf.title;
    if (previewModel) previewModel.textContent = currentModelText();
    const compareButton = $("studioCompareToggle");
    if (compareButton) compareButton.hidden = conf.task !== "t2i";
    updateModelSummary(conf);
  }

  function bindState() {
    $("modelSel")?.addEventListener("change", () => setTimeout(syncActiveUi, 0));
    for (const conf of Object.values(FUNCTION_TASKS)) {
      $(conf.selectId)?.addEventListener("change", () => setTimeout(syncActiveUi, 0));
      $(`mm-${conf.task}-custom-id`)?.addEventListener("input", syncActiveUi);
      const health = $(`mmHealth-${conf.task}`);
      if (health) new MutationObserver(() => updateModelSummary(conf)).observe(health, { childList: true, subtree: true, characterData: true });
    }
    const container = document.querySelector("main.container");
    if (container && !adoptUtilityPanels()) {
      utilityObserver?.disconnect();
      utilityObserver = new MutationObserver(() => {
        if (!adoptUtilityPanels()) return;
        utilityObserver?.disconnect();
        utilityObserver = null;
      });
      utilityObserver.observe(container, { childList: true });
    }
  }

  function simplifyTopbar() {
    document.querySelector(".topbar-sub")?.classList.add("studio-hidden-topbar-sub");
    document.querySelector(".topbar")?.classList.add("studio-topbar");
  }

  function init() {
    const container = document.querySelector("main.container");
    if (!container || container.classList.contains("workspace-ready")) return;
    simplifyTopbar();
    createTopActions();
    createDrawers();
    createStructure(container);
    createRail();
    if (!moveCorePanels()) return;
    container.classList.add("workspace-ready", "studio-ready");
    bindState();
    syncActiveUi();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init));
  window.GiteeWorkspaceLayout = Object.freeze({ init, updateSummary: syncActiveUi, adoptBottomPanels: adoptUtilityPanels, adoptUtilityPanels, openDrawer, closeDrawers });
})();
