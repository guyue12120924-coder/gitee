(() => {
  "use strict";

  const MOBILE = window.matchMedia("(max-width: 900px)");
  const COMPOSER_INPUTS = new Set(["zPrompt", "editPrompt", "wanPrompt", "hyPrompt"]);
  const WORKFLOW_LABELS = {
    "z-image": "文生图",
    "Edit-2511": "图像编辑",
    "Wan2.2-I2V-A14B": "图生视频",
    "HunyuanVideo-1.5": "文生视频",
  };
  const WORKFLOW_MODELS = {
    "z-image": "mmT2IModel",
    "Edit-2511": "mmEditModel",
    "Wan2.2-I2V-A14B": "mmI2VModel",
    "HunyuanVideo-1.5": "mmT2VModel",
  };
  const INSPIRATIONS = [
    ["人物摄影", "写实人物摄影，主体清晰，自然光，真实皮肤质感，浅景深，专业摄影构图"],
    ["产品广告", "高端产品广告摄影，主体突出，材质细节清晰，柔和棚拍光，简洁背景，商业海报质感"],
    ["动漫插画", "高质量动漫插画，线条干净，色彩协调，角色设计完整，背景具有空间层次"],
    ["电影画面", "电影感画面，明确主体，层次丰富的光影，真实材质，细腻色彩，构图平衡"],
  ];
  let viewportFrame = 0;
  let suppressSearchFocusUntil = 0;

  function ensureViewportMeta() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const tokens = new Set(String(meta.content || "").split(",").map((part) => part.trim()).filter(Boolean));
    tokens.add("width=device-width");
    tokens.add("initial-scale=1");
    tokens.add("viewport-fit=cover");
    tokens.add("interactive-widget=resizes-content");
    meta.content = [...tokens].join(",");
  }

  function updateViewportMetrics() {
    viewportFrame = 0;
    const viewport = window.visualViewport;
    const height = Math.max(320, Math.round(viewport?.height || window.innerHeight || 720));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    const keyboardInset = MOBILE.matches && viewport
      ? Math.max(0, Math.round((window.innerHeight || height) - viewport.height - viewport.offsetTop))
      : 0;
    const keyboardOpen = MOBILE.matches && keyboardInset > 120;
    const compactPhone = MOBILE.matches && window.innerWidth <= 430;

    document.documentElement.style.setProperty("--studio-mobile-vh", `${height}px`);
    document.documentElement.style.setProperty("--studio-viewport-offset-top", `${offsetTop}px`);
    document.documentElement.style.setProperty("--studio-keyboard-inset", `${keyboardInset}px`);
    document.body.classList.toggle("studio-mobile-layout", MOBILE.matches);
    document.body.classList.toggle("studio-keyboard-open", keyboardOpen);
    document.body.classList.toggle("studio-compact-phone", compactPhone);

    const themeButton = document.getElementById("themeToggleBtn");
    if (themeButton) {
      themeButton.hidden = compactPhone;
      themeButton.setAttribute("aria-hidden", compactPhone ? "true" : "false");
    }
  }

  function scheduleViewportMetrics() {
    if (viewportFrame) return;
    viewportFrame = requestAnimationFrame(updateViewportMetrics);
  }

  function closeInspector() {
    document.body.classList.remove("studio-inspector-open");
  }

  function ensureInspectorMask() {
    if (document.getElementById("studioInspectorMask")) return;
    const mask = document.createElement("button");
    mask.id = "studioInspectorMask";
    mask.type = "button";
    mask.className = "studio-inspector-mask";
    mask.tabIndex = -1;
    mask.setAttribute("aria-label", "关闭生成参数");
    mask.addEventListener("click", closeInspector);
    document.body.appendChild(mask);
  }

  function setupMobileSheetBehavior() {
    ensureInspectorMask();
    document.getElementById("modelSel")?.addEventListener("change", closeInspector);
    window.addEventListener("gitee-studio-drawer-open", closeInspector);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeInspector();
    });
    MOBILE.addEventListener?.("change", () => {
      if (!MOBILE.matches) closeInspector();
      scheduleViewportMetrics();
    });
  }

  function setupKeyboardBehavior() {
    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains("studio-model-search") && MOBILE.matches && Date.now() < suppressSearchFocusUntil) {
        target.blur();
        return;
      }
      if (!COMPOSER_INPUTS.has(target.id)) return;
      document.body.classList.add("studio-composer-focus");
      scheduleViewportMetrics();
      setTimeout(() => target.scrollIntoView({ block: "nearest", inline: "nearest" }), 80);
    });

    document.addEventListener("focusout", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !COMPOSER_INPUTS.has(target.id)) return;
      setTimeout(() => {
        if (!COMPOSER_INPUTS.has(document.activeElement?.id || "")) document.body.classList.remove("studio-composer-focus");
        scheduleViewportMetrics();
      }, 80);
    });

    document.addEventListener("pointerdown", (event) => {
      if (!MOBILE.matches) return;
      if (event.target?.closest?.(".studio-model-trigger")) suppressSearchFocusUntil = Date.now() + 700;
    }, true);
  }

  function setupViewportEvents() {
    ensureViewportMeta();
    window.addEventListener("resize", scheduleViewportMetrics, { passive: true });
    window.addEventListener("orientationchange", scheduleViewportMetrics, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleViewportMetrics, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleViewportMetrics, { passive: true });
    scheduleViewportMetrics();
  }

  function activePrompt() {
    const value = document.getElementById("modelSel")?.value || "z-image";
    const id = value === "Edit-2511" ? "editPrompt" : value === "Wan2.2-I2V-A14B" ? "wanPrompt" : value === "HunyuanVideo-1.5" ? "hyPrompt" : "zPrompt";
    return document.getElementById(id);
  }

  function setPrompt(value) {
    const input = activePrompt();
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus({ preventScroll: true });
  }

  function updateTopContext() {
    const context = document.getElementById("studioTopContext");
    if (!context) return;
    const value = document.getElementById("modelSel")?.value || "z-image";
    const label = WORKFLOW_LABELS[value] || "创作";
    const select = document.getElementById(WORKFLOW_MODELS[value]);
    const model = select?.value === "__custom__"
      ? document.getElementById(`mm-${value === "z-image" ? "t2i" : value === "Edit-2511" ? "edit" : value === "Wan2.2-I2V-A14B" ? "i2v" : "t2v"}-custom-id`)?.value?.trim()
      : select?.value;
    context.innerHTML = `<strong>${label}</strong><span>${model || "模型加载中"}</span>`;
  }

  function ensureTopContext() {
    const main = document.querySelector(".studio-topbar .topbar-main");
    if (!main || document.getElementById("studioTopContext")) return;
    const context = document.createElement("div");
    context.id = "studioTopContext";
    context.className = "studio-top-context";
    main.appendChild(context);
    updateTopContext();
  }

  function ensureInspirationActions() {
    const empty = document.getElementById("workspacePreviewEmpty");
    if (!empty || empty.querySelector(".studio-empty-actions")) return;
    const copy = empty.querySelector(":scope > div:last-child") || empty;
    const actions = document.createElement("div");
    actions.className = "studio-empty-actions";
    for (const [label, prompt] of INSPIRATIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "studio-empty-action";
      button.textContent = label;
      button.addEventListener("click", () => setPrompt(prompt));
      actions.appendChild(button);
    }
    copy.appendChild(actions);
  }

  function polishCreatorSurface() {
    const preview = document.getElementById("workspaceWorkflowValue");
    if (preview) preview.textContent = "生成结果";
    const empty = document.getElementById("workspacePreviewEmpty");
    const emptyTitle = empty?.querySelector("strong");
    const emptyText = empty?.querySelector("p");
    if (emptyTitle) emptyTitle.textContent = "开始你的创作之旅";
    if (emptyText) emptyText.textContent = "描述你的想法，或从下面选择一个灵感开始";

    for (const button of document.querySelectorAll(".pt-enhance")) button.textContent = "AI 优化";
    for (const note of document.querySelectorAll(".prompt-toolbox-note")) note.textContent = "AI 优化会在浏览器中补充更完整的画面描述，不会产生额外 API 请求。";
    for (const details of document.querySelectorAll(".workspace-inspector .studio-model-developer-tools")) {
      const summary = details.querySelector(":scope > summary");
      if (summary) summary.textContent = "高级设置";
    }

    document.querySelector(".workspace-rail-utility")?.remove();
    ensureTopContext();
    ensureInspirationActions();
    updateTopContext();
  }

  function bindProductUiState() {
    document.getElementById("modelSel")?.addEventListener("change", () => setTimeout(() => {
      updateTopContext();
      const preview = document.getElementById("workspaceWorkflowValue");
      if (preview) preview.textContent = "生成结果";
    }, 0));
    for (const id of Object.values(WORKFLOW_MODELS)) {
      document.getElementById(id)?.addEventListener("change", () => setTimeout(updateTopContext, 0));
    }
  }

  function init() {
    setupViewportEvents();
    setupMobileSheetBehavior();
    setupKeyboardBehavior();
    polishCreatorSurface();
    bindProductUiState();
    setTimeout(polishCreatorSurface, 120);
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init));
})();