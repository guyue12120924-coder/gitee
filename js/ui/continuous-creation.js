(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "imageview_continuous_creation_v1";
  const FUNCTION_META = {
    "z-image": { task: "t2i", promptId: "zPrompt", runId: "btnZRun", modelId: "mmT2IModel", label: "文生图" },
    "Edit-2511": { task: "edit", promptId: "editPrompt", runId: "btnEditRun", modelId: "mmEditModel", label: "图像编辑" },
    "Wan2.2-I2V-A14B": { task: "i2v", promptId: "wanPrompt", runId: "btnWanRun", modelId: "mmI2VModel", label: "图生视频" },
    "HunyuanVideo-1.5": { task: "t2v", promptId: "hyPrompt", runId: "btnHyRun", modelId: "mmT2VModel", label: "文生视频" },
  };

  let state = loadState();
  let projectDrawer = null;
  let projectMask = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        activeProjectId: parsed.activeProjectId || "",
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      };
    } catch {
      return { activeProjectId: "", projects: [], favorites: [] };
    }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    syncProjectChrome();
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function dispatchValue(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function toast(message, kind = "info") {
    let node = $("continuousCreationToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "continuousCreationToast";
      node.className = "continuous-creation-toast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.className = `continuous-creation-toast is-visible is-${kind}`;
    clearTimeout(window.__continuousCreationToastTimer);
    window.__continuousCreationToastTimer = setTimeout(() => node.classList.remove("is-visible"), 2400);
  }

  function activeFunctionValue() {
    return $("modelSel")?.value || "z-image";
  }

  function currentSnapshot(mediaSrc = "") {
    const functionValue = activeFunctionValue();
    const meta = FUNCTION_META[functionValue] || FUNCTION_META["z-image"];
    const prompt = $(meta.promptId)?.value || "";
    const model = $(meta.modelId)?.value || "";
    return {
      functionValue,
      task: meta.task,
      taskLabel: meta.label,
      prompt,
      model,
      mediaSrc,
      createdAt: Date.now(),
    };
  }

  function cardSnapshot(item) {
    const media = item.querySelector("img,video");
    const mediaSrc = media?.currentSrc || media?.src || "";
    if (!item.dataset.ccFunctionValue) {
      const snapshot = currentSnapshot(mediaSrc);
      item.dataset.ccFunctionValue = snapshot.functionValue;
      item.dataset.ccTask = snapshot.task;
      item.dataset.ccTaskLabel = snapshot.taskLabel;
      item.dataset.ccPrompt = snapshot.prompt;
      item.dataset.ccModel = snapshot.model;
      item.dataset.ccCreatedAt = String(snapshot.createdAt);
    }
    return {
      functionValue: item.dataset.ccFunctionValue || "z-image",
      task: item.dataset.ccTask || "t2i",
      taskLabel: item.dataset.ccTaskLabel || "创作",
      prompt: item.dataset.ccPrompt || "",
      model: item.dataset.ccModel || "",
      mediaSrc,
      createdAt: Number(item.dataset.ccCreatedAt || Date.now()),
    };
  }

  function findFavorite(mediaSrc) {
    return state.favorites.find((item) => item.mediaSrc === mediaSrc) || null;
  }

  function activeProject() {
    return state.projects.find((project) => project.id === state.activeProjectId) || null;
  }

  function ensureProject() {
    let project = activeProject();
    if (project) return project;
    project = {
      id: uid("project"),
      name: `未命名项目 ${state.projects.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [],
    };
    state.projects.unshift(project);
    state.activeProjectId = project.id;
    persist();
    renderProjects();
    return project;
  }

  function createProject(name = "") {
    const project = {
      id: uid("project"),
      name: String(name || "").trim() || `新项目 ${state.projects.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [],
    };
    state.projects.unshift(project);
    state.activeProjectId = project.id;
    persist();
    renderProjects();
    toast(`已创建项目：${project.name}`, "ok");
    return project;
  }

  function addToProject(snapshot) {
    const project = ensureProject();
    const exists = project.items.some((item) => item.mediaSrc && item.mediaSrc === snapshot.mediaSrc);
    if (exists) {
      toast("这个作品已经在当前项目中", "info");
      return;
    }
    project.items.unshift({ id: uid("item"), ...snapshot, addedAt: Date.now() });
    project.updatedAt = Date.now();
    persist();
    renderProjects();
    toast(`已加入项目：${project.name}`, "ok");
  }

  function toggleFavorite(snapshot, button) {
    const existing = findFavorite(snapshot.mediaSrc);
    if (existing) {
      state.favorites = state.favorites.filter((item) => item.id !== existing.id);
      button?.classList.remove("is-favorite");
      button?.setAttribute("aria-pressed", "false");
      if (button) button.textContent = "收藏";
      toast("已取消收藏");
    } else {
      state.favorites.unshift({ id: uid("favorite"), ...snapshot, savedAt: Date.now() });
      state.favorites = state.favorites.slice(0, 200);
      button?.classList.add("is-favorite");
      button?.setAttribute("aria-pressed", "true");
      if (button) button.textContent = "已收藏";
      toast("已收藏作品", "ok");
    }
    persist();
  }

  function restoreSnapshot(snapshot, autoRun = false) {
    const meta = FUNCTION_META[snapshot.functionValue] || FUNCTION_META["z-image"];
    const functionSelect = $("modelSel");
    if (functionSelect && functionSelect.value !== snapshot.functionValue) {
      functionSelect.value = snapshot.functionValue;
      dispatchValue(functionSelect);
    }
    setTimeout(() => {
      const prompt = $(meta.promptId);
      if (prompt) {
        prompt.value = snapshot.prompt || "";
        dispatchValue(prompt);
      }
      const model = $(meta.modelId);
      if (model && snapshot.model && [...model.options].some((option) => option.value === snapshot.model)) {
        model.value = snapshot.model;
        dispatchValue(model);
      }
      if (autoRun) {
        const run = $(meta.runId);
        if (run && !run.disabled) run.click();
        else toast("当前生成按钮不可用，请检查参数或 API Key", "err");
      } else {
        prompt?.focus();
      }
    }, 80);
  }

  function reusePromptForTarget(targetFunctionValue, sourceSnapshot) {
    const target = FUNCTION_META[targetFunctionValue];
    if (!target || !sourceSnapshot.prompt) return;
    const prompt = $(target.promptId);
    if (!prompt) return;
    prompt.value = sourceSnapshot.prompt;
    dispatchValue(prompt);
  }

  function button(label, className = "") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `studio-result-action continuous-result-action ${className}`.trim();
    node.textContent = label;
    return node;
  }

  function enhanceResultCard(item) {
    if (!item || item.dataset.continuousCreation === "1") return;
    const media = item.querySelector("img,video");
    if (!media) return;
    item.dataset.continuousCreation = "1";
    const snapshot = cardSnapshot(item);

    let actions = item.querySelector(".studio-result-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "studio-result-actions";
      media.insertAdjacentElement("afterend", actions);
    }

    const rerun = button("再次生成", "continuous-rerun");
    rerun.title = "恢复这次创作的模型与提示词并再次生成";
    rerun.addEventListener("click", (event) => {
      event.stopPropagation();
      restoreSnapshot(cardSnapshot(item), true);
    });

    const favorite = button(findFavorite(snapshot.mediaSrc) ? "已收藏" : "收藏", "continuous-favorite");
    favorite.classList.toggle("is-favorite", Boolean(findFavorite(snapshot.mediaSrc)));
    favorite.setAttribute("aria-pressed", findFavorite(snapshot.mediaSrc) ? "true" : "false");
    favorite.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(cardSnapshot(item), favorite);
    });

    const project = button("加入项目", "continuous-project");
    project.title = "把这个结果加入当前作品项目";
    project.addEventListener("click", (event) => {
      event.stopPropagation();
      addToProject(cardSnapshot(item));
    });

    const download = actions.querySelector(".studio-download-action");
    if (download) actions.insertBefore(rerun, download);
    else actions.appendChild(rerun);
    actions.append(favorite, project);

    for (const existing of actions.querySelectorAll("button")) {
      const text = existing.textContent?.trim();
      if (text === "编辑") {
        existing.addEventListener("click", () => reusePromptForTarget("Edit-2511", cardSnapshot(item)), { capture: true });
      } else if (text === "生成视频") {
        existing.addEventListener("click", () => reusePromptForTarget("Wan2.2-I2V-A14B", cardSnapshot(item)), { capture: true });
      }
    }
  }

  function syncResultCards() {
    const output = $("output");
    if (!output) return;
    for (const item of output.querySelectorAll(":scope > .item")) enhanceResultCard(item);
  }

  function setupResultEnhancements() {
    const output = $("output");
    if (!output) return;
    const observer = new MutationObserver(() => requestAnimationFrame(syncResultCards));
    observer.observe(output, { childList: true });
    syncResultCards();
  }

  function projectPreview(item) {
    if (!item.mediaSrc) return "";
    const video = /\.(mp4|webm|mov)(?:\?|$)/i.test(item.mediaSrc);
    return video
      ? `<video src="${escapeAttr(item.mediaSrc)}" preload="metadata" muted></video>`
      : `<img src="${escapeAttr(item.mediaSrc)}" alt="项目作品" loading="lazy" decoding="async" />`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function renderProjects() {
    const body = $("continuousProjectBody");
    if (!body) return;
    const project = activeProject();
    body.replaceChildren();

    const controls = document.createElement("div");
    controls.className = "continuous-project-controls";
    const select = document.createElement("select");
    select.className = "input continuous-project-select";
    if (!state.projects.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "暂无项目";
      select.appendChild(option);
    }
    for (const item of state.projects) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} · ${item.items?.length || 0} 个作品`;
      option.selected = item.id === state.activeProjectId;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      state.activeProjectId = select.value;
      persist();
      renderProjects();
    });
    const create = document.createElement("button");
    create.type = "button";
    create.className = "btn primary";
    create.textContent = "新建项目";
    create.addEventListener("click", () => {
      const name = window.prompt("项目名称", `新项目 ${state.projects.length + 1}`);
      if (name !== null) createProject(name);
    });
    controls.append(select, create);
    body.appendChild(controls);

    if (!project) {
      const empty = document.createElement("div");
      empty.className = "continuous-project-empty";
      empty.innerHTML = `<strong>还没有作品项目</strong><span>生成图片后点击“加入项目”，或者先创建一个新项目。</span>`;
      body.appendChild(empty);
      return;
    }

    const head = document.createElement("div");
    head.className = "continuous-project-head";
    head.innerHTML = `<div><strong>${escapeHtml(project.name)}</strong><span>${project.items.length} 个作品 · ${state.favorites.length} 个收藏</span></div><button type="button" class="btn" data-project-rename>重命名</button>`;
    head.querySelector("[data-project-rename]")?.addEventListener("click", () => {
      const name = window.prompt("修改项目名称", project.name);
      if (!name?.trim()) return;
      project.name = name.trim();
      project.updatedAt = Date.now();
      persist();
      renderProjects();
    });
    body.appendChild(head);

    const list = document.createElement("div");
    list.className = "continuous-project-list";
    for (const item of project.items) {
      const card = document.createElement("article");
      card.className = "continuous-project-item";
      card.innerHTML = `<div class="continuous-project-thumb">${projectPreview(item)}</div><div class="continuous-project-copy"><strong>${escapeHtml(item.taskLabel || "作品")}</strong><span>${escapeHtml(item.model || "默认模型")}</span><p>${escapeHtml(item.prompt || "未记录提示词")}</p><div class="continuous-project-item-actions"><button type="button" data-restore>恢复创作</button><button type="button" data-remove>移除</button></div></div>`;
      card.querySelector("[data-restore]")?.addEventListener("click", () => {
        closeProjectDrawer();
        restoreSnapshot(item, false);
        toast("已恢复这次创作，可继续修改", "ok");
      });
      card.querySelector("[data-remove]")?.addEventListener("click", () => {
        project.items = project.items.filter((entry) => entry.id !== item.id);
        project.updatedAt = Date.now();
        persist();
        renderProjects();
      });
      list.appendChild(card);
    }
    if (!project.items.length) {
      const empty = document.createElement("div");
      empty.className = "continuous-project-empty compact";
      empty.innerHTML = `<strong>这个项目还是空的</strong><span>从任意生成结果点击“加入项目”。</span>`;
      list.appendChild(empty);
    }
    body.appendChild(list);
  }

  function syncProjectChrome() {
    const project = activeProject();
    const button = $("continuousProjectBtn");
    if (button) {
      const label = button.querySelector(".continuous-project-button-label");
      if (label) label.textContent = project ? project.name : "项目";
      button.title = project ? `当前项目：${project.name}` : "作品项目";
    }
  }

  function openProjectDrawer() {
    if (!projectDrawer || !projectMask) return;
    renderProjects();
    projectDrawer.classList.add("is-open");
    projectMask.classList.add("is-open");
    projectDrawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("continuous-project-open");
  }

  function closeProjectDrawer() {
    projectDrawer?.classList.remove("is-open");
    projectMask?.classList.remove("is-open");
    projectDrawer?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("continuous-project-open");
  }

  function setupProjectUI() {
    if ($("continuousProjectBtn")) return;
    const right = document.querySelector(".topbar-right");
    const status = right?.querySelector(".status");
    if (right) {
      const projectButton = document.createElement("button");
      projectButton.id = "continuousProjectBtn";
      projectButton.type = "button";
      projectButton.className = "top-icon-btn continuous-project-button";
      projectButton.innerHTML = `<span class="continuous-project-button-icon">◆</span><span class="continuous-project-button-label">项目</span>`;
      projectButton.addEventListener("click", openProjectDrawer);
      right.insertBefore(projectButton, status || null);
    }

    projectMask = document.createElement("div");
    projectMask.className = "continuous-project-mask";
    projectMask.addEventListener("click", closeProjectDrawer);
    document.body.appendChild(projectMask);

    projectDrawer = document.createElement("aside");
    projectDrawer.className = "continuous-project-drawer";
    projectDrawer.setAttribute("aria-hidden", "true");
    projectDrawer.innerHTML = `<div class="continuous-project-drawer-head"><div><strong>作品项目</strong><span>把生成、编辑和视频串成连续创作</span></div><button type="button" aria-label="关闭">×</button></div><div id="continuousProjectBody" class="continuous-project-body"></div>`;
    projectDrawer.querySelector(".continuous-project-drawer-head button")?.addEventListener("click", closeProjectDrawer);
    document.body.appendChild(projectDrawer);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && projectDrawer?.classList.contains("is-open")) closeProjectDrawer();
    });
    syncProjectChrome();
  }

  function injectStyles() {
    if ($("continuousCreationStyles")) return;
    const style = document.createElement("style");
    style.id = "continuousCreationStyles";
    style.textContent = `
      .continuous-result-action{white-space:nowrap}.continuous-favorite.is-favorite{color:#f59e0b!important;border-color:rgba(245,158,11,.35)!important;background:rgba(245,158,11,.09)!important}
      .continuous-project-button{max-width:190px}.continuous-project-button-label{max-width:116px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.continuous-project-button-icon{font-size:11px;color:var(--accent)}
      .continuous-project-mask{position:fixed;inset:0;z-index:130;background:rgba(15,23,42,.36);opacity:0;pointer-events:none;transition:.18s ease}.continuous-project-mask.is-open{opacity:1;pointer-events:auto}
      .continuous-project-drawer{position:fixed;z-index:131;top:0;right:0;width:min(460px,94vw);height:100dvh;background:var(--card);border-left:1px solid var(--border-light);box-shadow:-24px 0 60px rgba(15,23,42,.18);transform:translateX(104%);transition:transform .22s ease;display:flex;flex-direction:column}.continuous-project-drawer.is-open{transform:translateX(0)}
      .continuous-project-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 14px;border-bottom:1px solid var(--border-light)}.continuous-project-drawer-head>div{display:grid;gap:3px}.continuous-project-drawer-head strong{font-size:16px;color:var(--text)}.continuous-project-drawer-head span{font-size:11px;color:var(--muted)}.continuous-project-drawer-head button{width:34px;height:34px;border:1px solid var(--border-light);border-radius:10px;background:var(--studio-soft);color:var(--text);cursor:pointer;font-size:20px}
      .continuous-project-body{padding:14px;overflow:auto;display:grid;gap:14px}.continuous-project-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.continuous-project-select{min-width:0}.continuous-project-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border:1px solid var(--border-light);border-radius:13px;background:var(--studio-soft)}.continuous-project-head>div{display:grid;gap:3px}.continuous-project-head strong{font-size:14px;color:var(--text)}.continuous-project-head span{font-size:10px;color:var(--muted)}
      .continuous-project-list{display:grid;gap:10px}.continuous-project-item{display:grid;grid-template-columns:104px minmax(0,1fr);gap:11px;padding:9px;border:1px solid var(--border-light);border-radius:14px;background:var(--card)}.continuous-project-thumb{aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:var(--studio-soft)}.continuous-project-thumb img,.continuous-project-thumb video{width:100%;height:100%;object-fit:cover;display:block}.continuous-project-copy{min-width:0;display:grid;align-content:start;gap:3px}.continuous-project-copy strong{font-size:12px;color:var(--text)}.continuous-project-copy>span{font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.continuous-project-copy p{margin:5px 0 4px;font-size:11px;line-height:1.45;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.continuous-project-item-actions{display:flex;gap:6px;margin-top:3px}.continuous-project-item-actions button{border:1px solid var(--border-light);border-radius:8px;background:var(--studio-soft);color:var(--text);font-size:10px;padding:5px 8px;cursor:pointer}.continuous-project-empty{min-height:190px;display:grid;place-content:center;text-align:center;gap:6px;padding:24px;border:1px dashed var(--border-light);border-radius:14px;color:var(--muted)}.continuous-project-empty strong{color:var(--text);font-size:14px}.continuous-project-empty span{font-size:11px}.continuous-project-empty.compact{min-height:120px}
      .continuous-creation-toast{position:fixed;left:50%;bottom:24px;z-index:180;transform:translate(-50%,18px);padding:9px 13px;border-radius:10px;background:rgba(15,23,42,.92);color:#fff;font-size:12px;opacity:0;pointer-events:none;transition:.18s ease;box-shadow:0 12px 32px rgba(15,23,42,.2)}.continuous-creation-toast.is-visible{opacity:1;transform:translate(-50%,0)}.continuous-creation-toast.is-ok{background:rgba(22,101,52,.94)}.continuous-creation-toast.is-err{background:rgba(153,27,27,.94)}
      @media(max-width:900px){.continuous-project-button-label{display:none}.continuous-project-button{width:38px!important;padding-inline:0!important}.continuous-project-drawer{width:100vw}.continuous-project-item{grid-template-columns:88px minmax(0,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    setupProjectUI();
    setupResultEnhancements();
  }

  window.GiteeContinuousCreation = Object.freeze({
    getState: () => JSON.parse(JSON.stringify(state)),
    createProject,
    openProjectDrawer,
    closeProjectDrawer,
  });

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init)));
  });
})();
