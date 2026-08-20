(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const VIEW_KEY = "imageview_project_view_v1";
  const RELATION_LABEL = {
    root: "创作起点",
    edit: "图像编辑",
    video: "生成视频",
    variation: "再次生成",
    continue: "继续创作",
  };

  let currentView = loadView();
  let scheduled = false;

  function loadView() {
    try {
      const value = localStorage.getItem(VIEW_KEY);
      return value === "list" ? "list" : "tree";
    } catch {
      return "tree";
    }
  }

  function saveView(view) {
    currentView = view === "list" ? "list" : "tree";
    try { localStorage.setItem(VIEW_KEY, currentView); } catch {}
  }

  function continuousState() {
    try { return window.GiteeContinuousCreation?.getState?.() || null; }
    catch { return null; }
  }

  function lineageState() {
    try { return window.GiteeProjectLineage?.getState?.() || { media: {} }; }
    catch { return { media: {} }; }
  }

  function activeProject(state) {
    return state?.projects?.find((project) => project.id === state.activeProjectId) || null;
  }

  function mediaKind(src) {
    return /\.(mp4|webm|mov)(?:\?|$)/i.test(String(src || "")) ? "video" : "image";
  }

  function nodePreview(src) {
    const wrap = document.createElement("span");
    wrap.className = "project-tree-thumb";
    if (!src) return wrap;
    const kind = mediaKind(src);
    const media = document.createElement(kind === "video" ? "video" : "img");
    media.src = src;
    if (kind === "video") {
      media.preload = "metadata";
      media.muted = true;
    } else {
      media.loading = "lazy";
      media.decoding = "async";
      media.alt = "创作步骤预览";
    }
    wrap.appendChild(media);
    if (kind === "video") {
      const mark = document.createElement("span");
      mark.className = "project-tree-video-mark";
      mark.textContent = "▶";
      wrap.appendChild(mark);
    }
    return wrap;
  }

  function buildGraph(project, lineage) {
    const items = Array.isArray(project?.items) ? project.items : [];
    const mediaMeta = lineage?.media || {};
    const nodes = items.map((item, index) => {
      const meta = mediaMeta[item.mediaSrc] || {};
      return {
        item,
        meta,
        creationId: meta.creationId || item.creationId || `media:${item.mediaSrc}`,
        parentCreationId: meta.parentCreationId || item.parentCreationId || "",
        parentMediaSrc: meta.parentMediaSrc || item.parentMediaSrc || "",
        relation: meta.relation || item.relation || "root",
        step: items.length - index,
        createdAt: Number(meta.createdAt || item.createdAt || item.addedAt || 0),
        children: [],
      };
    });

    const byCreation = new Map(nodes.map((node) => [node.creationId, node]));
    const byMedia = new Map(nodes.map((node) => [node.item.mediaSrc, node]));
    const roots = [];

    for (const node of nodes) {
      let parent = null;
      if (node.parentCreationId) parent = byCreation.get(node.parentCreationId) || null;
      if (!parent && node.parentMediaSrc) parent = byMedia.get(node.parentMediaSrc) || null;
      if (parent && parent !== node) parent.children.push(node);
      else roots.push(node);
    }

    const sorter = (a, b) => (a.step - b.step) || (a.createdAt - b.createdAt);
    roots.sort(sorter);
    for (const node of nodes) node.children.sort(sorter);
    return { roots, nodes };
  }

  function jumpToList(mediaSrc) {
    setView("list");
    requestAnimationFrame(() => {
      const cards = [...document.querySelectorAll("#continuousProjectBody .continuous-project-item")];
      const target = cards.find((card) => card.dataset.lineageMediaSrc === mediaSrc) || null;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("project-tree-target-highlight");
      setTimeout(() => target.classList.remove("project-tree-target-highlight"), 1400);
    });
  }

  function renderNode(node, visited = new Set()) {
    const li = document.createElement("li");
    li.className = `project-tree-branch is-${node.relation || "root"}`;
    if (visited.has(node.creationId)) {
      li.classList.add("is-cycle");
      return li;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(node.creationId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-tree-node";
    button.dataset.mediaSrc = node.item.mediaSrc || "";
    button.title = "点击后切换到作品列表并定位到这个步骤";

    const preview = nodePreview(node.item.mediaSrc);
    const copy = document.createElement("span");
    copy.className = "project-tree-node-copy";

    const top = document.createElement("span");
    top.className = "project-tree-node-top";
    const step = document.createElement("strong");
    step.textContent = `步骤 ${node.step}`;
    const relation = document.createElement("em");
    relation.className = `is-${node.relation || "root"}`;
    relation.textContent = RELATION_LABEL[node.relation] || "继续创作";
    top.append(step, relation);

    const task = document.createElement("span");
    task.className = "project-tree-task";
    task.textContent = node.item.taskLabel || node.meta.taskLabel || "创作";

    const model = document.createElement("span");
    model.className = "project-tree-model";
    model.textContent = node.item.model || node.meta.model || "默认模型";

    copy.append(top, task, model);
    button.append(preview, copy);

    if (node.children.length) {
      const count = document.createElement("span");
      count.className = "project-tree-child-count";
      count.textContent = `${node.children.length} 个分支`;
      button.appendChild(count);
    }

    button.addEventListener("click", () => jumpToList(node.item.mediaSrc));
    li.appendChild(button);

    if (node.children.length) {
      const children = document.createElement("ul");
      children.className = "project-tree-children";
      for (const child of node.children) children.appendChild(renderNode(child, nextVisited));
      li.appendChild(children);
    }
    return li;
  }

  function renderTree(panel, project) {
    panel.replaceChildren();
    const graph = buildGraph(project, lineageState());
    if (!graph.nodes.length) {
      const empty = document.createElement("div");
      empty.className = "project-tree-empty";
      empty.innerHTML = "<strong>还没有创作链</strong><span>生成作品并加入项目后，这里会自动显示父子关系和分支。</span>";
      panel.appendChild(empty);
      return;
    }

    const summary = document.createElement("div");
    summary.className = "project-tree-summary";
    const branches = graph.nodes.filter((node) => node.children.length > 1).length;
    const derived = graph.nodes.filter((node) => node.relation !== "root").length;
    summary.innerHTML = `<span>${graph.nodes.length} 个步骤</span><span>${derived} 个衍生</span><span>${branches} 个分叉点</span>`;
    panel.appendChild(summary);

    const tree = document.createElement("ul");
    tree.className = "project-tree-root";
    for (const root of graph.roots) tree.appendChild(renderNode(root));
    panel.appendChild(tree);
  }

  function ensureViewControls(body, project) {
    let controls = body.querySelector(":scope > .project-tree-view-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "project-tree-view-controls";
      controls.innerHTML = `<div class="project-tree-view-copy"><strong>创作流程</strong><span>查看作品之间的来源和分支</span></div><div class="project-tree-segment"><button type="button" data-project-view="tree">创作树</button><button type="button" data-project-view="list">作品列表</button></div>`;
      controls.addEventListener("click", (event) => {
        const button = event.target?.closest?.("[data-project-view]");
        if (button) setView(button.dataset.projectView);
      });
      const cover = body.querySelector(":scope > .project-lineage-cover");
      const head = body.querySelector(":scope > .continuous-project-head");
      (cover || head)?.insertAdjacentElement("afterend", controls);
      if (!cover && !head) body.prepend(controls);
    }

    let tree = body.querySelector(":scope > .project-tree-panel");
    if (!tree) {
      tree = document.createElement("section");
      tree.className = "project-tree-panel";
      controls.insertAdjacentElement("afterend", tree);
    }
    renderTree(tree, project);
    return { controls, tree };
  }

  function applyView(body) {
    const tree = body.querySelector(":scope > .project-tree-panel");
    const list = body.querySelector(":scope > .continuous-project-list");
    const controls = body.querySelector(":scope > .project-tree-view-controls");
    if (tree) tree.hidden = currentView !== "tree";
    if (list) list.hidden = currentView !== "list";
    for (const button of controls?.querySelectorAll?.("[data-project-view]") || []) {
      const active = button.dataset.projectView === currentView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function setView(view) {
    saveView(view);
    const body = $("continuousProjectBody");
    if (body) applyView(body);
  }

  function sync() {
    scheduled = false;
    const body = $("continuousProjectBody");
    if (!body) return;
    const state = continuousState();
    const project = activeProject(state);
    if (!project) return;
    ensureViewControls(body, project);
    applyView(body);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function attachObserver() {
    const body = $("continuousProjectBody");
    if (!body || body.dataset.projectTreeObserved === "1") return Boolean(body);
    body.dataset.projectTreeObserved = "1";
    new MutationObserver(scheduleSync).observe(body, { childList: true });
    scheduleSync();
    return true;
  }

  function setupLifecycle() {
    if (!attachObserver()) {
      document.addEventListener("click", (event) => {
        if (event.target?.closest?.("#continuousProjectBtn")) {
          requestAnimationFrame(() => requestAnimationFrame(attachObserver));
        }
      }, true);
    }
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(".continuous-project")) setTimeout(scheduleSync, 60);
    }, true);
    window.addEventListener("gitee-history-change", scheduleSync);
  }

  function injectStyles() {
    if ($("projectTreeStyles")) return;
    const style = document.createElement("style");
    style.id = "projectTreeStyles";
    style.textContent = `
      .project-tree-view-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 2px 0}.project-tree-view-copy{display:grid;gap:2px}.project-tree-view-copy strong{font-size:12px;color:var(--text)}.project-tree-view-copy span{font-size:9px;color:var(--muted)}
      .project-tree-segment{display:grid;grid-template-columns:1fr 1fr;padding:2px;border:1px solid var(--border-light);border-radius:10px;background:var(--studio-soft)}.project-tree-segment button{min-height:30px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:10px;font-weight:700;cursor:pointer}.project-tree-segment button.is-active{background:var(--card);color:var(--accent);box-shadow:0 1px 4px rgba(15,23,42,.08)}
      .project-tree-panel{min-width:0;padding:10px 0 2px;overflow-x:hidden}.project-tree-summary{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.project-tree-summary span{padding:4px 7px;border:1px solid var(--border-light);border-radius:999px;background:var(--studio-soft);color:var(--muted);font-size:9px}
      .project-tree-root,.project-tree-children{list-style:none;margin:0;padding:0}.project-tree-root{display:grid;gap:9px}.project-tree-children{position:relative;display:grid;gap:8px;margin:8px 0 0 24px;padding-left:16px;border-left:1px solid color-mix(in srgb,var(--accent) 24%,var(--border-light))}.project-tree-branch{position:relative;min-width:0}.project-tree-children>.project-tree-branch::before{content:"";position:absolute;left:-16px;top:28px;width:14px;height:1px;background:color-mix(in srgb,var(--accent) 24%,var(--border-light))}
      .project-tree-node{position:relative;width:100%;display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:9px;align-items:center;padding:7px;border:1px solid var(--border-light);border-radius:13px;background:var(--card);color:var(--text);text-align:left;cursor:pointer;transition:.15s ease}.project-tree-node:hover{border-color:rgba(99,102,241,.38);background:color-mix(in srgb,var(--card) 94%,var(--accent));transform:translateY(-1px)}
      .project-tree-thumb{position:relative;width:58px;aspect-ratio:1/1;border-radius:9px;overflow:hidden;background:var(--studio-soft)}.project-tree-thumb img,.project-tree-thumb video{width:100%;height:100%;object-fit:cover;display:block}.project-tree-video-mark{position:absolute;right:4px;bottom:4px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:rgba(15,23,42,.72);color:#fff;font-size:8px}
      .project-tree-node-copy{min-width:0;display:grid;gap:3px}.project-tree-node-top{display:flex;align-items:center;gap:6px;min-width:0}.project-tree-node-top strong{font-size:11px;color:var(--text)}.project-tree-node-top em{padding:2px 6px;border-radius:999px;background:var(--studio-soft);color:var(--muted);font-style:normal;font-size:8px;font-weight:750}.project-tree-node-top em.is-edit,.project-tree-node-top em.is-variation{background:rgba(99,102,241,.10);color:var(--accent)}.project-tree-node-top em.is-video{background:rgba(8,145,178,.10);color:#0891b2}.project-tree-node-top em.is-continue{background:rgba(22,163,74,.10);color:#16a34a}
      .project-tree-task{font-size:10px;font-weight:650;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-tree-model{font-size:9px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-tree-child-count{align-self:start;padding:3px 6px;border-radius:999px;background:rgba(99,102,241,.08);color:var(--accent);font-size:8px;white-space:nowrap}
      .project-tree-empty{min-height:150px;display:grid;place-content:center;text-align:center;gap:5px;padding:20px;border:1px dashed var(--border-light);border-radius:13px;color:var(--muted)}.project-tree-empty strong{color:var(--text);font-size:13px}.project-tree-empty span{max-width:280px;font-size:10px;line-height:1.5}.project-tree-target-highlight{animation:projectTreeTarget 1.4s ease}@keyframes projectTreeTarget{0%,100%{box-shadow:none}30%,65%{box-shadow:0 0 0 3px rgba(99,102,241,.22);border-color:rgba(99,102,241,.55)}}
      @media(max-width:560px){.project-tree-view-controls{align-items:flex-start}.project-tree-view-copy span{display:none}.project-tree-node{grid-template-columns:50px minmax(0,1fr)}.project-tree-thumb{width:50px}.project-tree-child-count{grid-column:2;justify-self:start}.project-tree-children{margin-left:18px;padding-left:13px}.project-tree-children>.project-tree-branch::before{left:-13px;width:11px}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    setupLifecycle();
  }

  window.GiteeProjectTree = Object.freeze({
    sync: scheduleSync,
    setView,
    getView: () => currentView,
  });

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init)));
  });
})();