(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const REGISTRY = window.GiteeModelRegistry;
  const TASK_BY_SELECT = {
    mmT2IModel: "t2i",
    mmEditModel: "edit",
    mmI2VModel: "i2v",
    mmT2VModel: "t2v",
  };

  const ICONS = {
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5.5 17 4.5-4 3.2 2.8 2.4-2.2 3 3.4"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.7-10.7a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 7.5 3 3"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2v8l-4-2"/></svg>',
    textVideo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h6M7 13h4"/><path d="m15 11 3 2-3 2Z"/></svg>',
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7L3.5 8.5"/><path d="M3.5 4.5v4h4"/><path d="M12 7.5V12l3 2"/></svg>',
    task: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.1M12 19.1v2.1M4.8 4.8l1.5 1.5M17.7 17.7l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.8 19.2l1.5-1.5M17.7 6.3l1.5-1.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/></svg>',
    model: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4-7 4-7-4 7-4Z"/><path d="m5 12 7 4 7-4"/><path d="m5 17 7 4 7-4"/></svg>',
  };

  function dispatchValue(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function plainModelLabel(text) {
    return String(text || "")
      .replace(/^[✅❌🧪⚙️🟡]\s*/, "")
      .replace(/\s+·\s+.+$/, "")
      .trim();
  }

  function modelMeta(task, id, option) {
    if (id === "__custom__") return { label: "自定义模型", meta: "填写 Gitee model ID", state: "adapted" };
    const model = REGISTRY?.model?.(task, id);
    const state = model?.status?.state || "adapted";
    return {
      label: model?.label || plainModelLabel(option?.textContent || id),
      meta: model?.badge || (state === "verified" ? "已验证" : state === "experimental" ? "实验模型" : "已适配"),
      state,
    };
  }

  function setupUnifiedIcons() {
    const workflowIcons = {
      "z-image": ICONS.image,
      "Edit-2511": ICONS.edit,
      "Wan2.2-I2V-A14B": ICONS.video,
      "HunyuanVideo-1.5": ICONS.textVideo,
    };
    for (const button of document.querySelectorAll(".workspace-rail-button[data-function-value]")) {
      const holder = button.querySelector(".workspace-rail-icon");
      const icon = workflowIcons[button.dataset.functionValue];
      if (holder && icon && holder.innerHTML !== icon) holder.innerHTML = icon;
    }
    const history = document.querySelector('.workspace-rail-button[data-drawer="history"] .workspace-rail-icon');
    if (history) history.innerHTML = ICONS.history;
    const task = $("studioTaskBtn")?.querySelector(".studio-top-icon");
    if (task) task.innerHTML = ICONS.task;
    const settings = $("studioSettingsBtn")?.querySelector(".studio-top-icon");
    if (settings) settings.innerHTML = ICONS.settings;
    const mobileHistory = $("studioHistoryBtn")?.querySelector(".studio-top-icon");
    if (mobileHistory) mobileHistory.innerHTML = ICONS.history;
  }

  function nativeActionRows(item) {
    return [...item.children].filter((node) => node.classList?.contains("row") && !node.classList.contains("studio-result-actions"));
  }

  function ensureDownloadAction(item, image) {
    const actions = item.querySelector(".studio-result-actions");
    if (!actions || actions.querySelector(".studio-download-action")) return;
    const download = item.querySelector('a[download]');
    if (!download) return;
    const link = document.createElement("a");
    link.className = "studio-result-action studio-download-action";
    link.href = download.href;
    link.download = download.download || "";
    link.target = "_blank";
    link.rel = "noopener";
    link.title = "下载作品";
    link.innerHTML = `${ICONS.download}<span>下载</span>`;
    link.addEventListener("click", (event) => event.stopPropagation());
    actions.appendChild(link);
    if (image) actions.dataset.mediaSrc = image.currentSrc || image.src || "";
  }

  function collapseNativeActions(item) {
    if (item.querySelector(":scope > .studio-media-native-actions")) return;
    const rows = nativeActionRows(item);
    if (!rows.length) return;
    const details = document.createElement("details");
    details.className = "studio-media-native-actions";
    const summary = document.createElement("summary");
    summary.textContent = "更多";
    const body = document.createElement("div");
    body.className = "studio-media-native-body";
    for (const row of rows) body.appendChild(row);
    details.append(summary, body);
    item.appendChild(details);
  }

  function decorateMediaCard(item) {
    const media = item.querySelector("img,video");
    item.classList.toggle("studio-media-card", Boolean(media));
    item.classList.toggle("studio-system-card", !media);
    if (!media || item.dataset.productMediaDecorated === "1") return;
    item.dataset.productMediaDecorated = "1";
    const image = media.tagName === "IMG" ? media : null;
    if (image) {
      image.loading = "lazy";
      image.decoding = "async";
    } else if (media.tagName === "VIDEO") {
      media.preload = "metadata";
    }
    requestAnimationFrame(() => {
      ensureDownloadAction(item, image);
      collapseNativeActions(item);
    });
  }

  function syncGalleryMode() {
    const output = $("output");
    if (!output) return;
    for (const item of output.querySelectorAll(":scope > .item")) decorateMediaCard(item);
  }

  function setupFocusGallery() {
    const output = $("output");
    if (!output) return;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.matches?.(".item")) decorateMediaCard(node);
        }
      }
    }).observe(output, { childList: true });
    syncGalleryMode();
  }

  function matchingMediaCard(src) {
    if (!src) return null;
    return [...document.querySelectorAll("#output .studio-media-card")].find((item) => {
      const media = item.querySelector("img,video");
      return media && (media.currentSrc || media.src) === src;
    }) || null;
  }

  function syncLightboxActions() {
    const lightbox = $("studioLightbox");
    if (!lightbox?.classList.contains("is-open")) return;
    const src = lightbox.querySelector("img")?.src || "";
    const card = matchingMediaCard(src);
    let actions = lightbox.querySelector(".studio-lightbox-actions");
    if (!card) {
      actions?.remove();
      return;
    }
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "studio-lightbox-actions";
      lightbox.appendChild(actions);
    }
    const sourceActions = [...card.querySelectorAll(".studio-result-actions .studio-result-action")];
    const signature = sourceActions.map((source) => source.textContent?.trim() || source.title || "操作").join("|");
    if (actions.dataset.signature === signature) return;
    actions.dataset.signature = signature;
    actions.replaceChildren();
    for (const source of sourceActions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "studio-lightbox-action";
      button.textContent = source.textContent?.trim() || source.title || "操作";
      button.addEventListener("click", () => source.click());
      actions.appendChild(button);
    }
  }

  function setupLightboxObserver() {
    document.addEventListener("click", (event) => {
      if (event.target?.matches?.("#output img.studio-preview-media")) requestAnimationFrame(syncLightboxActions);
    }, true);
  }

  function closeAllModelMenus(except = null) {
    for (const picker of document.querySelectorAll(".studio-model-selector.is-open")) {
      if (picker === except) continue;
      picker.classList.remove("is-open");
      picker.querySelector(".studio-model-trigger")?.setAttribute("aria-expanded", "false");
    }
  }

  function syncModelPicker(select) {
    const picker = select.parentElement?.querySelector(":scope > .studio-model-selector");
    if (!picker) return;
    const task = TASK_BY_SELECT[select.id];
    const option = select.selectedOptions?.[0];
    const meta = modelMeta(task, select.value, option);
    const strong = picker.querySelector(".studio-model-trigger-copy strong");
    const sub = picker.querySelector(".studio-model-trigger-copy span");
    if (strong && strong.textContent !== meta.label) strong.textContent = meta.label;
    if (sub && sub.textContent !== meta.meta) sub.textContent = meta.meta;
    for (const modelButton of picker.querySelectorAll(".studio-model-option")) {
      modelButton.classList.toggle("is-active", modelButton.dataset.value === select.value);
    }
  }

  function filterModelMenu(picker, term) {
    const query = String(term || "").trim().toLowerCase();
    for (const button of picker.querySelectorAll(".studio-model-option")) {
      const haystack = `${button.dataset.search || ""}`.toLowerCase();
      button.hidden = Boolean(query) && !haystack.includes(query);
    }
    for (const group of picker.querySelectorAll(".studio-model-group")) {
      group.hidden = ![...group.querySelectorAll(".studio-model-option")].some((button) => !button.hidden);
    }
  }

  function appendModelOption(group, select, option, task, picker) {
    const meta = modelMeta(task, option.value, option);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "studio-model-option";
    button.dataset.value = option.value;
    button.dataset.search = `${meta.label} ${meta.meta} ${option.value}`;
    const copy = document.createElement("span");
    copy.className = "studio-model-option-copy";
    const strong = document.createElement("strong");
    strong.textContent = meta.label;
    const sub = document.createElement("span");
    sub.textContent = meta.meta;
    copy.append(strong, sub);
    const status = document.createElement("span");
    status.className = `studio-model-option-status is-${meta.state === "verified" ? "verified" : meta.state === "experimental" ? "experimental" : "adapted"}`;
    button.append(copy, status);
    button.addEventListener("click", () => {
      if (select.value !== option.value) {
        select.value = option.value;
        dispatchValue(select);
      }
      syncModelPicker(select);
      picker.classList.remove("is-open");
      picker.querySelector(".studio-model-trigger")?.setAttribute("aria-expanded", "false");
    });
    group.appendChild(button);
  }

  function modelOptionsSignature(select) {
    return [...select.options].map((option) => `${option.value}\u0000${option.textContent || ""}`).join("\u0001");
  }

  function rebuildModelMenu(select, picker) {
    const signature = modelOptionsSignature(select);
    if (picker.dataset.optionsSignature === signature) {
      syncModelPicker(select);
      return;
    }
    picker.dataset.optionsSignature = signature;
    const task = TASK_BY_SELECT[select.id];
    const menu = picker.querySelector(".studio-model-menu");
    if (!menu) return;
    menu.replaceChildren();
    const currentOptions = [...select.options];
    if (currentOptions.length > 8) {
      const input = document.createElement("input");
      input.className = "studio-model-search";
      input.type = "search";
      input.placeholder = "搜索模型…";
      input.addEventListener("input", () => filterModelMenu(picker, input.value));
      menu.appendChild(input);
    }

    const optgroups = [...select.querySelectorAll(":scope > optgroup")];
    for (const source of optgroups) {
      const options = [...source.querySelectorAll(":scope > option")];
      if (!options.length) continue;
      const group = document.createElement("section");
      group.className = "studio-model-group";
      const label = document.createElement("div");
      label.className = "studio-model-group-label";
      label.textContent = source.label || "更多模型";
      group.appendChild(label);
      for (const option of options) appendModelOption(group, select, option, task, picker);
      menu.appendChild(group);
    }

    const standalone = [...select.children].filter((node) => node.tagName === "OPTION");
    if (standalone.length || !optgroups.length) {
      const options = optgroups.length ? standalone : currentOptions;
      if (options.length) {
        const group = document.createElement("section");
        group.className = "studio-model-group";
        if (optgroups.length) {
          const label = document.createElement("div");
          label.className = "studio-model-group-label";
          label.textContent = "其他";
          group.appendChild(label);
        }
        for (const option of options) appendModelOption(group, select, option, task, picker);
        menu.appendChild(group);
      }
    }
    syncModelPicker(select);
  }

  function decorateModelSelect(select) {
    if (!select) return;
    if (select.dataset.productPicker === "1") {
      syncModelPicker(select);
      return;
    }
    const task = TASK_BY_SELECT[select.id];
    if (!task) return;
    select.dataset.productPicker = "1";
    select.classList.add("studio-model-select-native");
    const picker = document.createElement("div");
    picker.className = "studio-model-selector";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "studio-model-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="studio-model-mark">${ICONS.model}</span><span class="studio-model-trigger-copy"><strong></strong><span></span></span><span class="studio-model-chevron">⌄</span>`;
    const menu = document.createElement("div");
    menu.className = "studio-model-menu";
    picker.append(trigger, menu);
    select.insertAdjacentElement("afterend", picker);
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = !picker.classList.contains("is-open");
      closeAllModelMenus(picker);
      if (next) rebuildModelMenu(select, picker);
      picker.classList.toggle("is-open", next);
      trigger.setAttribute("aria-expanded", next ? "true" : "false");
      if (next) requestAnimationFrame(() => picker.querySelector(".studio-model-search")?.focus());
    });
    select.addEventListener("change", () => syncModelPicker(select));
    let queued = false;
    new MutationObserver(() => {
      picker.dataset.optionsSignature = "";
      syncModelPicker(select);
      if (!picker.classList.contains("is-open") || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        rebuildModelMenu(select, picker);
      });
    }).observe(select, { childList: true, subtree: true });
    syncModelPicker(select);
  }

  function setupModelSelectors() {
    // Important: do not observe workspaceInspectorHost and then resync every picker.
    // syncModelPicker updates text nodes inside that host, which can create a MutationObserver feedback loop.
    for (const id of Object.keys(TASK_BY_SELECT)) decorateModelSelect($(id));
    document.addEventListener("click", () => closeAllModelMenus());
  }

  function currentThemeMode() {
    const mode = localStorage.getItem("moark_theme_mode");
    if (["system", "light", "dark"].includes(mode)) return mode;
    return localStorage.getItem("moark_theme") ? localStorage.getItem("moark_theme") : "system";
  }

  function resolvedSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyThemeMode(mode) {
    const normalized = ["system", "light", "dark"].includes(mode) ? mode : "system";
    localStorage.setItem("moark_theme_mode", normalized);
    const resolved = normalized === "system" ? resolvedSystemTheme() : normalized;
    if (normalized === "system") localStorage.removeItem("moark_theme");
    else localStorage.setItem("moark_theme", normalized);
    document.documentElement.setAttribute("data-theme", resolved);
    window.updateThemeIcon?.(resolved);
    syncThemeChoices();
  }

  function syncThemeChoices() {
    const mode = currentThemeMode();
    for (const button of document.querySelectorAll(".studio-theme-choice")) {
      button.classList.toggle("is-active", button.dataset.themeMode === mode);
    }
  }

  function buildSettings() {
    const body = $("studioDrawerBody-settings");
    const apiCard = body?.querySelector(".workspace-api-card");
    if (!body || !apiCard || $("studioProductSettings")) return false;
    $("studioSettingsExtras")?.remove();

    const root = document.createElement("div");
    root.id = "studioProductSettings";
    root.className = "studio-product-settings";

    const appearance = document.createElement("section");
    appearance.className = "studio-settings-block";
    appearance.innerHTML = `<div class="studio-settings-block-head">外观</div><div class="studio-theme-segment"><button type="button" class="studio-theme-choice" data-theme-mode="system">跟随系统</button><button type="button" class="studio-theme-choice" data-theme-mode="light">浅色</button><button type="button" class="studio-theme-choice" data-theme-mode="dark">深色</button></div>`;
    for (const button of appearance.querySelectorAll(".studio-theme-choice")) {
      button.addEventListener("click", () => applyThemeMode(button.dataset.themeMode));
    }

    const api = document.createElement("section");
    api.className = "studio-settings-block studio-settings-api";
    const apiHead = document.createElement("div");
    apiHead.className = "studio-settings-block-head";
    apiHead.textContent = "API 连接";
    api.append(apiHead, apiCard);
    const apiTitle = apiCard.querySelector("h2");
    if (apiTitle) apiTitle.textContent = "Gitee AI API";

    const links = document.createElement("section");
    links.className = "studio-settings-block";
    links.innerHTML = `<div class="studio-settings-block-head">其他</div><div class="studio-settings-links-product"><a class="studio-settings-link" href="https://ai.gitee.com/serverless-api" target="_blank" rel="noopener">API 管理</a><a class="studio-settings-link" href="https://github.com/MallocPointer/gitee/" target="_blank" rel="noopener">GitHub</a><button type="button" class="studio-settings-link" id="studioProductSponsor">赞助项目</button></div>`;
    links.querySelector("#studioProductSponsor")?.addEventListener("click", () => $("donateBtn")?.click());

    root.append(appearance, api, links);
    const developer = body.querySelector(".studio-settings-developer");
    if (developer) {
      const summary = developer.querySelector(":scope > summary");
      if (summary) summary.textContent = "开发者设置";
      root.appendChild(developer);
    }
    body.prepend(root);
    if (currentThemeMode() === "system") applyThemeMode("system");
    else syncThemeChoices();
    return true;
  }

  function setupSettingsProduct() {
    buildSettings();
    window.addEventListener("gitee-studio-drawer-open", (event) => {
      if (event.detail?.name === "settings") buildSettings();
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", () => {
      if (currentThemeMode() === "system") applyThemeMode("system");
    });
    $("themeToggleBtn")?.addEventListener("click", () => {
      setTimeout(() => {
        const explicit = document.documentElement.getAttribute("data-theme") || "light";
        localStorage.setItem("moark_theme_mode", explicit);
        syncThemeChoices();
      }, 0);
    });
  }

  function init() {
    setupUnifiedIcons();
    setupFocusGallery();
    setupLightboxObserver();
    setupModelSelectors();
    setupSettingsProduct();
  }

  window.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init)));
  });
})();
