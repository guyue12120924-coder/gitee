(() => {
  "use strict";

  const MOBILE = window.matchMedia("(max-width: 900px)");
  const COMPOSER_INPUTS = new Set(["zPrompt", "editPrompt", "wanPrompt", "hyPrompt"]);
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

    document.documentElement.style.setProperty("--studio-mobile-vh", `${height}px`);
    document.documentElement.style.setProperty("--studio-viewport-offset-top", `${offsetTop}px`);
    document.documentElement.style.setProperty("--studio-keyboard-inset", `${keyboardInset}px`);
    document.body.classList.toggle("studio-mobile-layout", MOBILE.matches);
    document.body.classList.toggle("studio-keyboard-open", keyboardOpen);
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

  function init() {
    setupViewportEvents();
    setupMobileSheetBehavior();
    setupKeyboardBehavior();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init));
})();
