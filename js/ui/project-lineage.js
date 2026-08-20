(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "imageview_project_lineage_v1";
  const FUNCTION_BY_RUN = {
    btnZRun: "z-image",
    btnEditRun: "Edit-2511",
    btnWanRun: "Wan2.2-I2V-A14B",
    btnHyRun: "HunyuanVideo-1.5",
  };
  const TARGET_BY_ACTION = {
    "编辑": { functionValue: "Edit-2511", relation: "edit", label: "编辑自" },
    "生成视频": { functionValue: "Wan2.2-I2V-A14B", relation: "video", label: "视频自" },
  };
  const RELATION_LABEL = {
    root: "起点",
    edit: "编辑自",
    video: "视频自",
    variation: "变体自",
    continue: "继续自",
  };
  const CONTEXT_TTL = 30 * 60 * 1000;
  const RUN_TTL = 10 * 60 * 1000;

  let state = loadState();
  const sourceContext = new Map();
  const activeRun = new Map();

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        media: parsed.media && typeof parsed.media === "object" ? parsed.media : {},
        covers: parsed.covers && typeof parsed.covers === "object" ? parsed.covers : {},
      };
    } catch {
      return { media: {}, covers: {} };
    }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function uid(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function currentFunctionValue() {
    return $("modelSel")?.value || "z-image";
  }

  function mediaSrcFrom(node) {
    const media = node?.querySelector?.("img,video");
    return media?.currentSrc || media?.src || "";
  }

  function snapshotFromResult(item) {
    const mediaSrc = mediaSrcFrom(item);
    return {
      creationId: item?.dataset?.lineageCreationId || state.media[mediaSrc]?.creationId || uid("creation"),
      mediaSrc,
      functionValue: item?.dataset?.ccFunctionValue || currentFunctionValue(),
      task: item?.dataset?.ccTask || "",
      taskLabel: item?.dataset?.ccTaskLabel || "创作",
      prompt: item?.dataset?.ccPrompt || "",
      model: item?.dataset?.ccModel || "",
      createdAt: Number(item?.dataset?.ccCreatedAt || Date.now()),
    };
  }

  function setSourceContext(functionValue, source, relation) {
    if (!functionValue || !source?.mediaSrc) return;
    sourceContext.set(functionValue, {
      source: { ...source },
      relation,
      armedAt: Date.now(),
    });
  }

  function promoteRun(functionValue) {
    const context = sourceContext.get(functionValue);
    if (context && Date.now() - context.armedAt <= CONTEXT_TTL) {
      activeRun.set(functionValue, { ...context, startedAt: Date.now() });
    } else {
      activeRun.delete(functionValue);
    }
    sourceContext.delete(functionValue);
  }

  function lineageFor(functionValue) {
    const run = activeRun.get(functionValue);
    if (!run || Date.now() - run.startedAt > RUN_TTL) return null;
    return run;
  }

  function rememberResult(item) {
    const mediaSrc = mediaSrcFrom(item);
    if (!mediaSrc) return;
    let entry = state.media[mediaSrc];
    if (!entry) {
      const functionValue = item.dataset.ccFunctionValue || currentFunctionValue();
      const lineage = lineageFor(functionValue);
      entry = {
        creationId: uid("creation"),
        parentCreationId: lineage?.source?.creationId || "",
        parentMediaSrc: lineage?.source?.mediaSrc || "",
        relation: lineage?.relation || "root",
        functionValue,
        taskLabel: item.dataset.ccTaskLabel || "创作",
        prompt: item.dataset.ccPrompt || "",
        model: item.dataset.ccModel || "",
        createdAt: Number(item.dataset.ccCreatedAt || Date.now()),
      };
      state.media[mediaSrc] = entry;
      persist();
    }
    item.dataset.lineageCreationId = entry.creationId || "";
    item.dataset.lineageParentCreationId = entry.parentCreationId || "";
    item.dataset.lineageParentSrc = entry.parentMediaSrc || "";
    item.dataset.lineageRelation = entry.relation || "root";
    ensureResultBadge(item, entry);
  }

  function ensureResultBadge(item, entry) {
    if (item.querySelector(":scope > .project-lineage-result-badge")) return;
    const badge = document.createElement("div");
    badge.className = `project-lineage-result-badge is-${entry.relation || "root"}`;
    const label = RELATION_LABEL[entry.relation] || "创作";
    badge.textContent = entry.relation === "root" ? label : `${label}上一作品`;
    badge.title = entry.parentMediaSrc ? "这个结果记录了上一阶段的来源关系" : "创作链起点";
    const media = item.querySelector("img,video");
    if (media) media.insertAdjacentElement("beforebegin", badge);
  }

  function syncOutputLineage() {
    const output = $("output");
    if (!output) return;
    for (const item of output.querySelectorAll(":scope > .item")) {
      if (item.querySelector("img,video")) rememberResult(item);
    }
  }

  function setupOutputObserver() {
    const output = $("output");
    if (!output) return;
    new MutationObserver(() => requestAnimationFrame(syncOutputLineage))
      .observe(output, { childList: true });
    syncOutputLineage();
  }

  function actionSource(event) {
    const item = event.target?.closest?.("#output > .item");
    if (!item) return null;
    rememberResult(item);
    return snapshotFromResult(item);
  }

  function setupActionLineage() {
    document.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button");
      if (!target) return;

      if (target.closest("#output > .item")) {
        const text = target.textContent?.trim() || "";
        const source = actionSource(event);
        if (!source) return;

        const mapped = TARGET_BY_ACTION[text];
        if (mapped) {
          setSourceContext(mapped.functionValue, source, mapped.relation);
          return;
        }
        if (text === "再次生成") {
          setSourceContext(source.functionValue || currentFunctionValue(), source, "variation");
          return;
        }
      }

      if (target.matches("[data-restore]") && target.closest(".continuous-project-item")) {
        const card = target.closest(".continuous-project-item");
        const functionValue = card.dataset.lineageFunctionValue || currentFunctionValue();
        const source = {
          creationId: card.dataset.lineageCreationId || "",
          mediaSrc: card.dataset.lineageMediaSrc || "",
          functionValue,
          taskLabel: card.dataset.lineageTaskLabel || "创作",
          prompt: card.dataset.lineagePrompt || "",
          model: card.dataset.lineageModel || "",
        };
        if (source.mediaSrc) setSourceContext(functionValue, source, "continue");
      }
    }, true);

    for (const [id, functionValue] of Object.entries(FUNCTION_BY_RUN)) {
      $(id)?.addEventListener("click", () => promoteRun(functionValue), true);
    }
  }

  function continuousState() {
    try { return window.GiteeContinuousCreation?.getState?.() || null; }
    catch { return null; }
  }

  function activeProject(ccState) {
    return ccState?.projects?.find((project) => project.id === ccState.activeProjectId) || null;
  }

  function ensureMediaMetadata(item) {
    if (!item?.mediaSrc) return null;
    if (!state.media[item.mediaSrc]) {
      state.media[item.mediaSrc] = {
        creationId: item.creationId || uid("creation"),
        parentCreationId: item.parentCreationId || "",
        parentMediaSrc: item.parentMediaSrc || "",
        relation: item.relation || "root",
        functionValue: item.functionValue || "",
        taskLabel: item.taskLabel || "创作",
        prompt: item.prompt || "",
        model: item.model || "",
        createdAt: item.createdAt || item.addedAt || Date.now(),
      };
      persist();
    }
    return state.media[item.mediaSrc];
  }

  function projectItemLookup(project) {
    const byMedia = new Map();
    const byCreation = new Map();
    for (const item of project?.items || []) {
      const meta = ensureMediaMetadata(item);
      if (!meta) continue;
      byMedia.set(item.mediaSrc, { item, meta });
      byCreation.set(meta.creationId, { item, meta });
    }
    return { byMedia, byCreation };
  }

  function coverSource(project) {
    const explicit = state.covers[project.id];
    if (explicit && project.items.some((item) => item.mediaSrc === explicit)) return explicit;
    return project.items[0]?.mediaSrc || "";
  }

  function setCover(project, mediaSrc) {
    if (!project?.id || !mediaSrc) return;
    state.covers[project.id] = mediaSrc;
    persist();
    syncProjectDrawer();
  }

  function mediaPreview(src, className = "") {
    const wrap = document.createElement("div");
    wrap.className = className;
    if (!src) return wrap;
    const isVideo = /\.(mp4|webm|mov)(?:\?|$)/i.test(src);
    const media = document.createElement(isVideo ? "video" : "img");
    media.src = src;
    if (isVideo) {
      media.preload = "metadata";
      media.muted = true;
    } else {
      media.loading = "lazy";
      media.decoding = "async";
      media.alt = "项目封面";
    }
    wrap.appendChild(media);
    return wrap;
  }

  function ensureProjectCover(body, project) {
    let panel = body.querySelector(":scope > .project-lineage-cover");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "project-lineage-cover";
      const head = body.querySelector(":scope > .continuous-project-head");
      if (head) head.insertAdjacentElement("afterend", panel);
      else body.prepend(panel);
    }
    panel.replaceChildren();
    const src = coverSource(project);
    const preview = mediaPreview(src, "project-lineage-cover-media");
    const copy = document.createElement("div");
    copy.className = "project-lineage-cover-copy";
    const eyebrow = document.createElement("span");
    eyebrow.textContent = "PROJECT COVER";
    const title = document.createElement("strong");
    title.textContent = project.name || "作品项目";
    const detail = document.createElement("p");
    const derived = (project.items || []).filter((item) => (state.media[item.mediaSrc]?.relation || "root") !== "root").length;
    detail.textContent = `${project.items.length} 个作品 · ${derived} 个衍生步骤`;
    copy.append(eyebrow, title, detail);
    panel.append(preview, copy);
  }

  function sourceLabel(project, meta, currentIndex) {
    if (!meta?.parentMediaSrc && !meta?.parentCreationId) return "创作起点";
    const parentIndex = project.items.findIndex((candidate) => {
      const candidateMeta = state.media[candidate.mediaSrc];
      return candidate.mediaSrc === meta.parentMediaSrc ||
        (meta.parentCreationId && candidateMeta?.creationId === meta.parentCreationId);
    });
    const relation = RELATION_LABEL[meta.relation] || "来源";
    if (parentIndex < 0) return `${relation}项目外作品`;
    const step = project.items.length - parentIndex;
    return `${relation}步骤 ${step}`;
  }

  function decorateProjectCard(card, item, meta, project, index) {
    card.dataset.lineageCreationId = meta.creationId || "";
    card.dataset.lineageMediaSrc = item.mediaSrc || "";
    card.dataset.lineageFunctionValue = item.functionValue || meta.functionValue || "";
    card.dataset.lineageTaskLabel = item.taskLabel || meta.taskLabel || "";
    card.dataset.lineagePrompt = item.prompt || meta.prompt || "";
    card.dataset.lineageModel = item.model || meta.model || "";
    card.classList.add("project-lineage-card");
    card.classList.toggle("has-parent", Boolean(meta.parentMediaSrc || meta.parentCreationId));

    let step = card.querySelector(".project-lineage-step");
    if (!step) {
      step = document.createElement("span");
      step.className = "project-lineage-step";
      card.appendChild(step);
    }
    step.textContent = String(project.items.length - index);
    step.title = `创作步骤 ${project.items.length - index}`;

    const copy = card.querySelector(".continuous-project-copy");
    if (!copy) return;
    let relation = copy.querySelector(".project-lineage-relation");
    if (!relation) {
      relation = document.createElement("div");
      relation.className = "project-lineage-relation";
      const modelLine = copy.querySelector(":scope > span");
      if (modelLine) modelLine.insertAdjacentElement("afterend", relation);
      else copy.prepend(relation);
    }
    relation.className = `project-lineage-relation is-${meta.relation || "root"}`;
    relation.textContent = sourceLabel(project, meta, index);

    const actions = copy.querySelector(".continuous-project-item-actions");
    if (actions && !actions.querySelector("[data-set-cover]")) {
      const cover = document.createElement("button");
      cover.type = "button";
      cover.dataset.setCover = "1";
      cover.textContent = state.covers[project.id] === item.mediaSrc ? "当前封面" : "设为封面";
      cover.disabled = state.covers[project.id] === item.mediaSrc;
      cover.addEventListener("click", () => setCover(project, item.mediaSrc));
      actions.insertBefore(cover, actions.firstChild);

      if (meta.parentMediaSrc || meta.parentCreationId) {
        const sourceButton = document.createElement("button");
        sourceButton.type = "button";
        sourceButton.dataset.showSource = "1";
        sourceButton.textContent = "查看来源";
        sourceButton.addEventListener("click", () => {
          const parentIndex = project.items.findIndex((candidate) => {
            const candidateMeta = state.media[candidate.mediaSrc];
            return candidate.mediaSrc === meta.parentMediaSrc ||
              (meta.parentCreationId && candidateMeta?.creationId === meta.parentCreationId);
          });
          if (parentIndex < 0) return;
          const cards = [...document.querySelectorAll("#continuousProjectBody .continuous-project-item")];
          const parentCard = cards[parentIndex];
          parentCard?.scrollIntoView({ behavior: "smooth", block: "center" });
          parentCard?.classList.add("lineage-source-highlight");
          setTimeout(() => parentCard?.classList.remove("lineage-source-highlight"), 1200);
        });
        actions.insertBefore(sourceButton, actions.firstChild);
      }
    } else if (actions) {
      const cover = actions.querySelector("[data-set-cover]");
      if (cover) {
        const current = state.covers[project.id] === item.mediaSrc;
        cover.textContent = current ? "当前封面" : "设为封面";
        cover.disabled = current;
      }
    }
  }

  function syncProjectDrawer() {
    const body = $("continuousProjectBody");
    if (!body) return;
    const ccState = continuousState();
    const project = activeProject(ccState);
    if (!project) return;

    ensureProjectCover(body, project);
    projectItemLookup(project);
    const cards = [...body.querySelectorAll(".continuous-project-item")];
    cards.forEach((card, index) => {
      const item = project.items[index];
      if (!item) return;
      const meta = ensureMediaMetadata(item);
      if (meta) decorateProjectCard(card, item, meta, project, index);
    });
  }

  function setupProjectObserver() {
    const attach = () => {
      const body = $("continuousProjectBody");
      if (!body || body.dataset.lineageObserved === "1") return Boolean(body);
      body.dataset.lineageObserved = "1";
      new MutationObserver(() => requestAnimationFrame(syncProjectDrawer))
        .observe(body, { childList: true });
      syncProjectDrawer();
      return true;
    };
    if (attach()) return;
    window.addEventListener("click", (event) => {
      if (event.target?.closest?.("#continuousProjectBtn")) {
        requestAnimationFrame(() => requestAnimationFrame(attach));
      }
    }, true);
  }

  function setupProjectAddSync() {
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".continuous-project");
      if (!button) return;
      const item = button.closest("#output > .item");
      if (item) rememberResult(item);
      setTimeout(syncProjectDrawer, 40);
    }, true);
  }

  function injectStyles() {
    if ($("projectLineageStyles")) return;
    const style = document.createElement("style");
    style.id = "projectLineageStyles";
    style.textContent = `
      .project-lineage-result-badge{position:absolute;z-index:3;top:10px;left:10px;padding:5px 8px;border-radius:999px;background:rgba(15,23,42,.78);backdrop-filter:blur(8px);color:#fff;font-size:9px;font-weight:750;letter-spacing:.02em;pointer-events:none}
      .project-lineage-result-badge.is-edit{background:rgba(79,70,229,.86)}.project-lineage-result-badge.is-video{background:rgba(8,145,178,.86)}.project-lineage-result-badge.is-variation{background:rgba(147,51,234,.86)}.project-lineage-result-badge.is-continue{background:rgba(22,101,52,.86)}
      .project-lineage-cover{display:grid;grid-template-columns:116px minmax(0,1fr);gap:13px;align-items:center;padding:10px;border:1px solid var(--border-light);border-radius:15px;background:linear-gradient(135deg,var(--studio-soft),var(--card))}
      .project-lineage-cover-media{width:116px;aspect-ratio:16/10;border-radius:11px;overflow:hidden;background:var(--studio-soft)}.project-lineage-cover-media img,.project-lineage-cover-media video{width:100%;height:100%;object-fit:cover;display:block}
      .project-lineage-cover-copy{min-width:0;display:grid;gap:4px}.project-lineage-cover-copy>span{font-size:9px;font-weight:800;letter-spacing:.12em;color:var(--accent)}.project-lineage-cover-copy>strong{font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-lineage-cover-copy>p{margin:0;font-size:10px;color:var(--muted)}
      .continuous-project-list{position:relative}.continuous-project-list::before{content:"";position:absolute;left:25px;top:12px;bottom:12px;width:1px;background:var(--border-light);z-index:0}
      .project-lineage-card{position:relative;margin-left:26px;z-index:1}.project-lineage-step{position:absolute;left:-37px;top:16px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--card);background:var(--studio-soft);box-shadow:0 0 0 1px var(--border-light);color:var(--muted);font-size:9px;font-weight:800}
      .project-lineage-card.has-parent .project-lineage-step{background:rgba(99,102,241,.12);color:var(--accent);box-shadow:0 0 0 1px rgba(99,102,241,.28)}
      .project-lineage-relation{width:max-content;max-width:100%;margin-top:2px;padding:3px 7px;border-radius:999px;background:var(--studio-soft);color:var(--muted);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-lineage-relation.is-edit,.project-lineage-relation.is-variation{background:rgba(99,102,241,.09);color:var(--accent)}.project-lineage-relation.is-video{background:rgba(8,145,178,.10);color:#0891b2}.project-lineage-relation.is-continue{background:rgba(22,163,74,.10);color:#16a34a}
      .continuous-project-item-actions{flex-wrap:wrap}.continuous-project-item-actions button:disabled{opacity:.55;cursor:default}.lineage-source-highlight{animation:lineageSourcePulse 1.2s ease}@keyframes lineageSourcePulse{0%,100%{box-shadow:none}35%{box-shadow:0 0 0 3px rgba(99,102,241,.20);border-color:rgba(99,102,241,.5)}}
      @media(max-width:560px){.project-lineage-cover{grid-template-columns:84px minmax(0,1fr)}.project-lineage-cover-media{width:84px}.project-lineage-card{margin-left:22px}.continuous-project-list::before{left:20px}.project-lineage-step{left:-32px}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    setupOutputObserver();
    setupActionLineage();
    setupProjectObserver();
    setupProjectAddSync();
    window.addEventListener("gitee-history-change", () => requestAnimationFrame(syncProjectDrawer));
  }

  window.GiteeProjectLineage = Object.freeze({
    getState: () => JSON.parse(JSON.stringify(state)),
    sync: syncProjectDrawer,
  });

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init)));
  });
})();