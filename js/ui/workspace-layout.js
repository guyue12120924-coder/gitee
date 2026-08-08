(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const FUNCTION_TASKS = {
    "z-image": { task: "t2i", title: "文生图", sub: "Text to Image", icon: "✦", selectId: "mmT2IModel" },
    "Edit-2511": { task: "edit", title: "图像编辑", sub: "Image Edit", icon: "◐", selectId: "mmEditModel" },
    "Wan2.2-I2V-A14B": { task: "i2v", title: "图生视频", sub: "Image to Video", icon: "▶", selectId: "mmI2VModel" },
    "HunyuanVideo-1.5": { task: "t2v", title: "文生视频", sub: "Text to Video", icon: "◆", selectId: "mmT2VModel" },
  };
  const PANEL_IDS = ["panelZ", "panelEdit", "panelWan", "panelHunyuan"];

  let shell;
  let sidebar;
  let main;
  let bottom;
  let summaryWorkflow;
  let summaryModel;
  let summaryStatus;
  let emptyPreview;
  let outputObserver;

  function activeFunction() {
    return FUNCTION_TASKS[$("modelSel")?.value] || FUNCTION_TASKS["z-image"];
  }

  function currentModelText() {
    const conf = activeFunction();
    const select = $(conf.selectId);
    if (!select) return "等待模型初始化";
    if (select.value === "__custom__") {
      return $(`mm-${conf.task}-custom-id`)?.value?.trim() || "自定义模型";
    }
    return select.value || select.selectedOptions?.[0]?.textContent || "未选择";
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function createHero(container, anchor) {
    if ($("workspaceHero")) return $("workspaceHero");
    const hero = document.createElement("section");
    hero.id = "workspaceHero";
    hero.className = "workspace-hero";
    hero.innerHTML = `
      <div class="workspace-hero-copy">
        <div class="workspace-eyebrow">Gitee AI Creation Workbench</div>
        <h1>多模型创作工作台</h1>
        <p>左侧配置模型与参数，右侧查看生成结果；任务进度与历史记录集中在下方。</p>
      </div>
      <div class="workspace-hero-badges">
        <span>Model Registry</span><span>Adapter Driven</span><span>Task Tracking</span><span>Local History</span>
      </div>`;
    if (anchor?.nextSibling) container.insertBefore(hero, anchor.nextSibling);
    else container.prepend(hero);
    return hero;
  }

  function createTabs(functionCard) {
    const select = $("modelSel");
    if (!select || $("workspaceTabs")) return;
    const sourceRow = select.closest(".row");
    sourceRow?.classList.add("workspace-function-source");
    functionCard.classList.add("workspace-function-card");
    const h2 = functionCard.querySelector("h2");
    if (h2) h2.textContent = "工作流 / Workflow";

    const tabs = document.createElement("div");
    tabs.id = "workspaceTabs";
    tabs.className = "workspace-tabs";
    for (const [value, conf] of Object.entries(FUNCTION_TASKS)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-tab";
      button.dataset.functionValue = value;
      button.innerHTML = `<span class="workspace-tab-icon">${conf.icon}</span><span class="workspace-tab-title">${conf.title}</span><span class="workspace-tab-sub">${conf.sub}</span>`;
      button.addEventListener("click", () => {
        if (select.value === value) return;
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      tabs.appendChild(button);
    }
    h2?.insertAdjacentElement("afterend", tabs);
    updateTabs();
  }

  function updateTabs() {
    const value = $("modelSel")?.value;
    for (const tab of document.querySelectorAll(".workspace-tab")) {
      const active = tab.dataset.functionValue === value;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function createSummary(outputCard) {
    if ($("workspacePreviewSummary")) return;
    const summary = document.createElement("div");
    summary.id = "workspacePreviewSummary";
    summary.className = "workspace-preview-summary";
    summary.innerHTML = `
      <div class="workspace-stat"><span class="workspace-stat-label">当前工作流</span><span class="workspace-stat-value" id="workspaceWorkflowValue">—</span></div>
      <div class="workspace-stat"><span class="workspace-stat-label">当前模型</span><span class="workspace-stat-value" id="workspaceModelValue">—</span></div>
      <div class="workspace-stat"><span class="workspace-stat-label">运行状态</span><span class="workspace-stat-value" id="workspaceStatusValue">准备就绪</span></div>`;
    outputCard.insertBefore(summary, outputCard.firstChild);
    summaryWorkflow = $("workspaceWorkflowValue");
    summaryModel = $("workspaceModelValue");
    summaryStatus = $("workspaceStatusValue");
  }

  function createEmptyPreview(outputCard) {
    const output = $("output");
    if (!output || $("workspacePreviewEmpty")) return;
    emptyPreview = document.createElement("div");
    emptyPreview.id = "workspacePreviewEmpty";
    emptyPreview.className = "workspace-preview-empty";
    emptyPreview.innerHTML = `<div><span class="workspace-empty-icon">✦</span><strong>结果会显示在这里</strong><p>从左侧选择工作流和模型，填写 Prompt 后开始生成。实时任务进度会在工作区下方持续更新。</p></div>`;
    outputCard.insertBefore(emptyPreview, output);

    const sync = () => {
      const hasMedia = Boolean(output.querySelector(".item"));
      emptyPreview.hidden = hasMedia;
    };
    outputObserver?.disconnect();
    outputObserver = new MutationObserver(sync);
    outputObserver.observe(output, { childList: true, subtree: false });
    sync();
  }

  function createStructure(container) {
    if ($("workspaceShell")) return;
    const loading = $("globalLoading");
    createHero(container, loading);

    shell = document.createElement("section");
    shell.id = "workspaceShell";
    shell.className = "workspace-shell";
    sidebar = document.createElement("aside");
    sidebar.id = "workspaceSidebar";
    sidebar.className = "workspace-sidebar";
    main = document.createElement("section");
    main.id = "workspaceMain";
    main.className = "workspace-main";
    shell.append(sidebar, main);

    const hero = $("workspaceHero");
    hero.insertAdjacentElement("afterend", shell);

    const label = document.createElement("div");
    label.className = "workspace-section-label";
    label.textContent = "Tasks & History";
    shell.insertAdjacentElement("afterend", label);

    bottom = document.createElement("section");
    bottom.id = "workspaceBottom";
    bottom.className = "workspace-bottom";
    label.insertAdjacentElement("afterend", bottom);
  }

  function moveCards() {
    const apiCard = $("apiKey")?.closest(".card");
    const functionCard = $("modelSel")?.closest(".card");
    const outputCard = $("output")?.closest(".card");
    if (!sidebar || !main || !apiCard || !functionCard || !outputCard) return false;

    apiCard.classList.add("workspace-api-card");
    const apiTitle = apiCard.querySelector("h2");
    if (apiTitle) apiTitle.textContent = "连接设置 / API";
    sidebar.append(apiCard, functionCard);
    for (const panelId of PANEL_IDS) {
      const panel = $(panelId);
      if (panel) sidebar.appendChild(panel);
    }

    outputCard.classList.add("workspace-output-card");
    main.appendChild(outputCard);
    createTabs(functionCard);
    createSummary(outputCard);
    createEmptyPreview(outputCard);
    adoptBottomPanels();
    return true;
  }

  function adoptBottomPanels() {
    if (!bottom) return;
    const taskCenter = $("taskCenter");
    const historyCenter = $("historyCenter");
    if (taskCenter && taskCenter.parentElement !== bottom) bottom.appendChild(taskCenter);
    if (historyCenter && historyCenter.parentElement !== bottom) bottom.appendChild(historyCenter);
  }

  function updateSummary() {
    const conf = activeFunction();
    setText(summaryWorkflow || $("workspaceWorkflowValue"), `${conf.title} · ${conf.sub}`);
    setText(summaryModel || $("workspaceModelValue"), currentModelText());
    setText(summaryStatus || $("workspaceStatusValue"), $("statusBadge")?.textContent?.trim() || "准备就绪");
    updateTabs();
  }

  function bindState() {
    $("modelSel")?.addEventListener("change", () => setTimeout(updateSummary, 0));
    for (const conf of Object.values(FUNCTION_TASKS)) {
      $(conf.selectId)?.addEventListener("change", () => setTimeout(updateSummary, 0));
      $(`mm-${conf.task}-custom-id`)?.addEventListener("input", updateSummary);
    }
    const badge = $("statusBadge");
    if (badge) new MutationObserver(updateSummary).observe(badge, { childList: true, subtree: true, characterData: true });

    const container = document.querySelector("main.container");
    if (container) {
      new MutationObserver(() => adoptBottomPanels()).observe(container, { childList: true });
    }
  }

  function init() {
    const container = document.querySelector("main.container");
    if (!container || container.classList.contains("workspace-ready")) return;
    createStructure(container);
    if (!moveCards()) return;
    container.classList.add("workspace-ready");
    bindState();
    updateSummary();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init));
  window.GiteeWorkspaceLayout = Object.freeze({ init, updateSummary, adoptBottomPanels });
})();
