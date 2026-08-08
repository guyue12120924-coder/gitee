(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
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
  let previewStatus;
  let emptyPreview;
  let outputObserver;
  let quickModel;
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
    const make = (id, label, drawer, icon) => {
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "top-icon-btn studio-top-action";
      button.dataset.drawer = drawer;
      button.innerHTML = `<span class="studio-top-icon">${icon}</span><span>${label}</span>`;
      button.addEventListener("click", () => toggleDrawer(drawer));
      return button;
    };
    const nodes = [
      make("studioTaskBtn", "任务", "tasks", "◷"),
      make("studioHistoryBtn", "历史", "history", "◫"),
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
      drawer.innerHTML = `<div class="studio-drawer-head"><div><strong>${title}</strong><span>${name === "tasks" ? "查看当前生成进度" : name === "history" ? "查找和复用历史创作" : "连接、外观与开发设置"}</span></div><button type="button" class="studio-drawer-close" aria-label="关闭">×</button></div><div class="studio-drawer-body" id="studioDrawerBody-${name}"></div>`;
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
    document.querySelector(`[data-drawer="${name}"]`)?.classList.add("is-active");
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
    inspector.innerHTML = `<div class="workspace-inspector-head"><div><span>生成设置</span><strong id="workspaceInspectorTitle">文生图</strong></div><button type="button" class="workspace-inspector-mobile-close" aria-label="关闭参数">×</button></div>`;
    inspectorHost = document.createElement("div");
    inspectorHost.id = "workspaceInspectorHost";
    inspectorHost.className = "workspace-inspector-host";
    inspector.appendChild(inspectorHost);
    inspector.querySelector(".workspace-inspector-mobile-close")?.addEventListener("click", () => document.body.classList.remove("studio-inspector-open"));

    composer = document.createElement("section");
    composer.id = "workspaceComposer";
    composer.className = "workspace-composer";
    composer.innerHTML = `<div class="workspace-composer-top"><div class="workspace-composer-model"><span>模型</span><select id="studioQuickModel" class="studio-quick-model" aria-label="快速选择模型"></select></div><button type="button" class="btn studio-inspector-toggle" id="studioInspectorToggle">参数</button></div><div id="workspaceComposerSlots" class="workspace-composer-slots"></div>`;
    composerSlots = composer.querySelector("#workspaceComposerSlots");
    quickModel = composer.querySelector("#studioQuickModel");
    quickModel.addEventListener("change", () => {
      const conf = activeFunction();
      const select = $(conf.selectId);
      if (!select || select.value === quickModel.value) return;
      select.value = quickModel.value;
      dispatch(select);
    });
    composer.querySelector("#studioInspectorToggle")?.addEventListener("click", () => document.body.classList.toggle("studio-inspector-open"));

    shell.append(rail, canvas, inspector, composer);
    const loading = $("globalLoading");
    if (loading?.nextSibling) container.insertBefore(shell, loading.nextSibling);
    else container.appendChild(shell);
  }

  function createRail() {
    if (!rail || rail.childElementCount) return;
    const logo = document.createElement("div");
    logo.className = "workspace-rail-mark";
    logo.textContent = "AI";
    rail.appendChild(logo);
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
    for (const [label, name, icon] of [["任务", "tasks", "◷"], ["历史", "history", "◫"], ["设置", "settings", "⚙"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-rail-button workspace-rail-utility-button";
      button.dataset.drawer = name;
      button.innerHTML = `<span class="workspace-rail-icon">${icon}</span><span class="workspace-rail-label">${label}</span>`;
      button.addEventListener("click", () => toggleDrawer(name));
      utility.appendChild(button);
    }
    rail.appendChild(utility);
  }

  function createPreviewHeader(outputCard) {
    if ($("workspacePreviewSummary")) return;
    const header = document.createElement("div");
    header.id = "workspacePreviewSummary";
    header.className = "workspace-preview-summary";
    header.innerHTML = `<div class="workspace-preview-title"><span id="workspaceWorkflowValue">文生图</span><strong id="workspaceModelValue">模型加载中</strong></div><div class="workspace-preview-status"><span class="workspace-status-dot"></span><span id="workspaceStatusValue">准备就绪</span></div>`;
    outputCard.insertBefore(header, outputCard.firstChild);
    previewWorkflow = $("workspaceWorkflowValue");
    previewModel = $("workspaceModelValue");
    previewStatus = $("workspaceStatusValue");
  }

  function createEmptyPreview(outputCard) {
    const output = $("output");
    if (!output || $("workspacePreviewEmpty")) return;
    emptyPreview = document.createElement("div");
    emptyPreview.id = "workspacePreviewEmpty";
    emptyPreview.className = "workspace-preview-empty";
    emptyPreview.innerHTML = `<div class="workspace-empty-art"><span>✦</span></div><div><strong>从一个想法开始</strong><p>在下方写下你想生成的内容，选择模型后点击生成。作品会直接出现在这里。</p></div>`;
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
    const media = item.querySelector("img");
    if (media) {
      media.classList.add("studio-preview-media");
      media.addEventListener("click", () => openLightbox(media.src, item.querySelector("h3")?.textContent || "生成结果"));
    }
  }

  function openLightbox(src, title) {
    if (!src) return;
    let lightbox = $("studioLightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "studioLightbox";
      lightbox.className = "studio-lightbox";
      lightbox.innerHTML = `<button type="button" class="studio-lightbox-close" aria-label="关闭">×</button><div class="studio-lightbox-stage"><img alt="生成结果预览" /></div><div class="studio-lightbox-title"></div>`;
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
      if (panel) {
        panel.classList.add("workspace-inspector-panel");
        inspectorHost.appendChild(panel);
        prepareComposerSlot(value, conf);
      }
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
  }

  function syncQuickModel() {
    if (!quickModel) return;
    const conf = activeFunction();
    const source = $(conf.selectId);
    if (!source) return;
    const current = source.value;
    quickModel.replaceChildren(...[...source.options].map((option) => {
      const clone = document.createElement("option");
      clone.value = option.value;
      clone.textContent = (option.textContent || option.value).replace(/^[✅❌🧪⚙️🟡]\s*/, "");
      return clone;
    }));
    quickModel.value = [...quickModel.options].some((option) => option.value === current) ? current : quickModel.options[0]?.value || "";
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
    if (previewStatus) previewStatus.textContent = $("statusBadge")?.textContent?.trim() || "准备就绪";
    syncQuickModel();
  }

  function bindState() {
    $("modelSel")?.addEventListener("change", () => setTimeout(syncActiveUi, 0));
    for (const conf of Object.values(FUNCTION_TASKS)) {
      $(conf.selectId)?.addEventListener("change", () => setTimeout(syncActiveUi, 0));
      $(`mm-${conf.task}-custom-id`)?.addEventListener("input", syncActiveUi);
    }
    const badge = $("statusBadge");
    if (badge) new MutationObserver(syncActiveUi).observe(badge, { childList: true, subtree: true, characterData: true });
    const container = document.querySelector("main.container");
    if (container) new MutationObserver(adoptUtilityPanels).observe(container, { childList: true });
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
