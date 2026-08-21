(() => {
  "use strict";

  const VERSION = "20260821-t2i-fix4";
  const MIGRATION_KEY = `moark_t2i_compat_guard:${VERSION}`;
  const $ = (id) => document.getElementById(id);
  let activeModel = "";
  let applying = false;

  function modelId() {
    return $("mmT2IModel")?.value || "";
  }

  function adapter() {
    try { return window.GiteeModelAdapters?.forModel?.("t2i", modelId()) || null; }
    catch { return null; }
  }

  function preferredSize() {
    const options = adapter()?.ui?.sizes || [];
    return options.find((value) => /(^|\D)1024x1024(\D|$)/.test(String(value))) || options[0] || "";
  }

  function dispatchValue(el) {
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    el?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyStableDefaults(force = false) {
    if (applying) return;
    const id = modelId();
    const res = $("zRes");
    if (!id || !res) return;

    const changedModel = id !== activeModel;
    if (!force && !changedModel) return;
    activeModel = id;

    applying = true;
    try {
      const preferred = preferredSize();
      if (preferred && [...res.options].some((option) => option.value === preferred) && res.value !== preferred) {
        res.value = preferred;
        dispatchValue(res);
      }

      const count = $("zN");
      if (count && adapter()?.allowBatch === false) {
        count.value = "1";
        count.max = "1";
        count.disabled = true;
      }
    } finally {
      applying = false;
    }
  }

  function clearStaleFailuresOnce() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === "1") return;
      const models = window.GiteeModelRegistry?.task?.("t2i")?.models || [];
      for (const model of models) {
        const key = `moark_model_health_v1:t2i:${model.id}`;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.state === "fail") localStorage.removeItem(key);
        } catch {}
      }
      localStorage.setItem(MIGRATION_KEY, "1");
    } catch {}
  }

  function markRuntimeVersion() {
    document.documentElement.dataset.t2iCompat = VERSION;
    const note = $("mm-t2i-note");
    if (note && !note.textContent.includes("稳定兼容 v4")) {
      note.textContent = `${note.textContent} · 稳定兼容 v4`;
    }
  }

  function init() {
    clearStaleFailuresOnce();
    activeModel = "";
    applyStableDefaults(true);
    markRuntimeVersion();

    $("mmT2IModel")?.addEventListener("change", () => {
      window.setTimeout(() => {
        applyStableDefaults(true);
        markRuntimeVersion();
      }, 0);
    });

    window.addEventListener("gitee-experience-mode-change", () => window.setTimeout(markRuntimeVersion, 0));
  }

  window.GiteeT2ICompatGuard = Object.freeze({
    version: VERSION,
    apply: () => applyStableDefaults(true),
  });

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(init)));
})();
