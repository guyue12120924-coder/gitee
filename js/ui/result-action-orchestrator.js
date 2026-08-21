(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ROLE_ORDER = ["edit", "video", "rerun", "favorite", "project", "download"];
  const PRIMARY_LABEL = {
    edit: "继续编辑",
    video: "生成视频",
    rerun: "再次生成",
    favorite: "收藏",
    project: "加入项目",
    download: "下载",
  };
  const ROLE_TITLE = {
    edit: "继续编辑这张图片",
    video: "用这张图片生成视频",
    rerun: "使用相同模型与提示词再次生成",
    favorite: "收藏或取消收藏这个作品",
    project: "把作品加入当前项目",
    download: "下载作品",
  };

  const scheduledCards = new WeakSet();

  function mediaKind(item) {
    if (item?.querySelector("video")) return "video";
    if (item?.querySelector("img")) return "image";
    return "none";
  }

  function roleFor(action) {
    if (!action) return "";
    if (action.dataset.resultActionRole) return action.dataset.resultActionRole;
    if (action.classList.contains("continuous-rerun")) return "rerun";
    if (action.classList.contains("continuous-favorite")) return "favorite";
    if (action.classList.contains("continuous-project")) return "project";
    if (action.classList.contains("studio-download-action")) return "download";
    const text = action.textContent?.trim() || "";
    if (["编辑", "继续编辑", "编辑图片"].includes(text)) return "edit";
    if (["生成视频", "做成视频"].includes(text)) return "video";
    return "";
  }

  function setRole(action, role) {
    if (!action || !role) return;
    action.dataset.resultActionRole = role;
    action.classList.add("smart-result-action");
    action.classList.remove("smart-action-primary", "smart-action-secondary", "smart-action-utility", "smart-utility-start");

    if (role === "edit") action.textContent = PRIMARY_LABEL.edit;
    else if (role === "video") action.textContent = PRIMARY_LABEL.video;
    else if (role === "rerun") action.textContent = PRIMARY_LABEL.rerun;

    action.title = ROLE_TITLE[role] || action.title || "作品操作";
    action.setAttribute("aria-label", ROLE_TITLE[role] || PRIMARY_LABEL[role] || "作品操作");
  }

  function visibleActionRoles(kind, roleMap) {
    const primary = [];
    const secondary = [];
    const utility = [];

    if (kind === "image") {
      if (roleMap.has("edit")) primary.push("edit");
      if (roleMap.has("video")) secondary.push("video");
      if (roleMap.has("rerun")) secondary.push("rerun");
    } else if (kind === "video") {
      if (roleMap.has("rerun")) primary.push("rerun");
    }

    for (const role of ["favorite", "project", "download"]) {
      if (roleMap.has(role)) utility.push(role);
    }
    return { primary, secondary, utility };
  }

  function markHierarchy(actions, kind) {
    const roleMap = new Map();
    for (const action of actions) {
      const role = roleFor(action);
      if (!role) continue;
      setRole(action, role);
      if (!roleMap.has(role)) roleMap.set(role, action);
    }

    const groups = visibleActionRoles(kind, roleMap);
    for (const role of groups.primary) roleMap.get(role)?.classList.add("smart-action-primary");
    for (const role of groups.secondary) roleMap.get(role)?.classList.add("smart-action-secondary");
    groups.utility.forEach((role, index) => {
      const action = roleMap.get(role);
      action?.classList.add("smart-action-utility");
      if (index === 0) action?.classList.add("smart-utility-start");
    });
    return roleMap;
  }

  function orderActions(actionsEl, roleMap) {
    const ordered = [];
    const used = new Set();
    for (const role of ROLE_ORDER) {
      const action = roleMap.get(role);
      if (action) {
        ordered.push(action);
        used.add(action);
      }
    }
    for (const action of actionsEl.querySelectorAll(":scope > .studio-result-action")) {
      if (!used.has(action)) ordered.push(action);
    }

    const current = [...actionsEl.children].filter((node) => node.matches?.(".studio-result-action"));
    const same = current.length === ordered.length && current.every((node, index) => node === ordered[index]);
    if (!same) ordered.forEach((action) => actionsEl.appendChild(action));
  }

  function addToolbarHint(item, kind) {
    let hint = item.querySelector(":scope > .smart-result-hint");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "smart-result-hint";
      const media = item.querySelector("img,video");
      if (media) media.insertAdjacentElement("afterend", hint);
    }
    if (!hint) return;
    hint.textContent = kind === "video" ? "继续创作：再次生成或保存作品" : "继续创作：编辑图片、生成视频或再次生成";
  }

  function syncFavoriteState(actionsEl) {
    const favorite = actionsEl.querySelector('[data-result-action-role="favorite"]');
    if (!favorite) return;
    const active = favorite.classList.contains("is-favorite") || /已收藏/.test(favorite.textContent || "");
    favorite.dataset.favoriteState = active ? "saved" : "idle";
    favorite.title = active ? "取消收藏" : ROLE_TITLE.favorite;
    favorite.setAttribute("aria-label", active ? "取消收藏这个作品" : ROLE_TITLE.favorite);
  }

  function normalizeCard(item) {
    if (!item || !item.matches?.("#output > .item")) return;
    const kind = mediaKind(item);
    if (kind === "none") return;
    const actionsEl = item.querySelector(":scope > .studio-result-actions");
    if (!actionsEl) return;

    actionsEl.classList.add("smart-result-actions");
    actionsEl.dataset.mediaKind = kind;
    const actions = [...actionsEl.querySelectorAll(":scope > .studio-result-action")];
    const roleMap = markHierarchy(actions, kind);
    orderActions(actionsEl, roleMap);
    syncFavoriteState(actionsEl);
    addToolbarHint(item, kind);

    item.classList.add("smart-result-card");
    item.dataset.smartResultActions = "1";
  }

  function scheduleCard(item) {
    if (!item || scheduledCards.has(item)) return;
    scheduledCards.add(item);
    requestAnimationFrame(() => {
      scheduledCards.delete(item);
      normalizeCard(item);
    });
  }

  function observeCard(item) {
    if (!item || item.dataset.smartResultObserved === "1") return;
    item.dataset.smartResultObserved = "1";
    const observer = new MutationObserver(() => scheduleCard(item));
    observer.observe(item, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    scheduleCard(item);
  }

  function syncOutput() {
    const output = $("output");
    if (!output) return;
    for (const item of output.querySelectorAll(":scope > .item")) observeCard(item);
  }

  function setupOutputObserver() {
    const output = $("output");
    if (!output) return;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.matches?.(".item")) observeCard(node);
        }
      }
    }).observe(output, { childList: true });
    syncOutput();
  }

  function setupFavoriteSync() {
    document.addEventListener("click", (event) => {
      const favorite = event.target?.closest?.(".continuous-favorite");
      if (!favorite) return;
      const card = favorite.closest("#output > .item");
      setTimeout(() => scheduleCard(card), 0);
    });
  }

  function injectStyles() {
    if ($("resultActionOrchestratorStyles")) return;
    const style = document.createElement("style");
    style.id = "resultActionOrchestratorStyles";
    style.textContent = `
      .smart-result-card{position:relative}
      .smart-result-hint{position:absolute;left:14px;bottom:58px;z-index:4;max-width:min(420px,calc(100% - 28px));padding:5px 8px;border:1px solid var(--border-light);border-radius:9px;background:color-mix(in srgb,var(--card) 88%,transparent);color:var(--muted);font-size:9px;line-height:1.25;opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity .14s ease,transform .14s ease;backdrop-filter:blur(10px)}
      .smart-result-card:hover>.smart-result-hint,.smart-result-card:focus-within>.smart-result-hint{opacity:1;transform:translateY(0)}
      .studio-media-card .studio-result-actions.smart-result-actions{display:flex!important;align-items:center;gap:6px!important;padding:6px!important;border:1px solid color-mix(in srgb,var(--border-light) 80%,transparent);border-radius:13px;background:color-mix(in srgb,var(--card) 82%,transparent);box-shadow:0 10px 30px rgba(0,0,0,.16);backdrop-filter:blur(16px)}
      .smart-result-actions .smart-result-action{min-height:34px!important;border-radius:9px!important;border:1px solid transparent!important;background:transparent!important;color:var(--muted)!important;font-size:10px!important;font-weight:700!important;transition:background .14s ease,border-color .14s ease,color .14s ease,transform .14s ease}
      .smart-result-actions .smart-result-action:hover{background:var(--btn-hover-bg)!important;border-color:var(--border-light)!important;color:var(--text)!important;transform:translateY(-1px)}
      .smart-result-actions .smart-action-primary{padding-inline:12px!important;background:color-mix(in srgb,var(--accent) 15%,var(--card))!important;border-color:color-mix(in srgb,var(--accent) 32%,transparent)!important;color:var(--accent)!important}
      .smart-result-actions .smart-action-primary:hover{background:color-mix(in srgb,var(--accent) 23%,var(--card))!important;border-color:color-mix(in srgb,var(--accent) 46%,transparent)!important;color:var(--accent)!important}
      .smart-result-actions .smart-action-secondary{padding-inline:10px!important;color:var(--text)!important}
      .smart-result-actions .smart-action-utility{width:34px!important;min-width:34px!important;padding:0!important;font-size:0!important;color:var(--muted)!important}
      .smart-result-actions .smart-action-utility svg{display:none!important}
      .smart-result-actions .smart-action-utility::before{display:block;font-size:15px;line-height:1}
      .smart-result-actions [data-result-action-role="favorite"]::before{content:"☆"}
      .smart-result-actions [data-result-action-role="favorite"][data-favorite-state="saved"]::before{content:"★";color:#f59e0b}
      .smart-result-actions [data-result-action-role="project"]::before{content:"◇"}
      .smart-result-actions [data-result-action-role="download"]::before{content:"↓";font-size:17px}
      .smart-result-actions .smart-utility-start{margin-inline-start:auto!important}
      .smart-result-actions [data-result-action-role="edit"]::before{content:"✎";margin-right:5px;font-size:13px}
      .smart-result-actions [data-result-action-role="video"]::before{content:"▶";margin-right:5px;font-size:10px}
      .smart-result-actions [data-result-action-role="rerun"]::before{content:"↻";margin-right:5px;font-size:14px}
      .studio-lightbox-actions{max-width:calc(100vw - 24px);flex-wrap:wrap;justify-content:center}
      @media(max-width:900px){
        .studio-media-card .studio-result-actions.smart-result-actions{pointer-events:auto!important;left:8px!important;right:8px!important;bottom:8px!important;gap:5px!important;padding:5px!important}
        .smart-result-hint{display:none}
        .smart-result-actions .smart-result-action{min-height:36px!important}
        .smart-result-actions .smart-action-primary{padding-inline:10px!important}
        .smart-result-actions .smart-action-secondary{padding-inline:8px!important}
        .smart-result-actions .smart-action-utility{width:36px!important;min-width:36px!important}
      }
      @media(max-width:560px){
        .studio-media-card .studio-result-actions.smart-result-actions{flex-wrap:wrap!important;justify-content:flex-start!important}
        .smart-result-actions .smart-action-primary{flex:1 1 118px!important}
        .smart-result-actions .smart-action-secondary{flex:1 1 92px!important}
        .smart-result-actions .smart-utility-start{margin-inline-start:0!important}
      }
      @media(prefers-reduced-motion:reduce){.smart-result-action,.smart-result-hint{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    setupOutputObserver();
    setupFavoriteSync();
  }

  window.GiteeResultActions = Object.freeze({
    sync: syncOutput,
    normalizeCard,
  });

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init)));
  });
})();