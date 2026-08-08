(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const DURATION_RULES = {
    "ViduQ3-Pro": { min: 5, max: 16, recommended: 5 },
    "ViduQ3-Turbo": { min: 5, max: 16, recommended: 5 },
    "ViduQ2-Pro": { min: 5, max: 10, recommended: 5 },
    "ViduQ2-Turbo": { min: 5, max: 10, recommended: 5 },
    "HappyHorse-1.0": { min: 3, max: 15, recommended: 5 },
    "HappyHorse-1.1": { min: 3, max: 15, recommended: 5 },
    "Wan2.7": { min: 3, max: 15, recommended: 5 },
  };

  const AFFECTED_MODELS = Object.keys(DURATION_RULES);

  function currentModel() {
    return $("mmI2VModel")?.value || "";
  }

  function clamp(value, min, max) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function updateHint(modelId, rule) {
    const controls = $("mmI2VGenericControls");
    const hint = controls?.querySelector(".hint");
    if (!hint || !rule) return;
    hint.textContent = `${modelId} 时长范围：${rule.min}–${rule.max} 秒；推荐先用 ${rule.recommended} 秒测试。程序会在提交前自动校正非法时长。`;
  }

  function applyDurationRule({ forceRecommended = false } = {}) {
    const modelId = currentModel();
    const rule = DURATION_RULES[modelId];
    if (!rule) return;

    const genericDuration = $("mmI2VDuration");
    const legacyDuration = $("wanDuration");

    if (genericDuration) {
      genericDuration.min = String(rule.min);
      genericDuration.max = String(rule.max);
      genericDuration.step = "1";
      const next = forceRecommended
        ? rule.recommended
        : clamp(genericDuration.value, rule.min, rule.max);
      genericDuration.value = String(next);
    }

    const source = genericDuration?.value ?? legacyDuration?.value ?? rule.recommended;
    const validDuration = forceRecommended
      ? rule.recommended
      : clamp(source, rule.min, rule.max);

    if (genericDuration) genericDuration.value = String(validDuration);
    if (legacyDuration) legacyDuration.value = String(validDuration);

    updateHint(modelId, rule);
  }

  function clearFalseDurationFailuresOnce() {
    const migrationKey = "moark_i2v_duration_validation_fix_v1";
    try {
      if (localStorage.getItem(migrationKey) === "1") return;
      for (const modelId of AFFECTED_MODELS) {
        const key = `moark_model_health_v1:i2v:${modelId}`;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.state === "fail" && /duration|时长|参数范围/i.test(parsed?.detail || "")) {
            localStorage.removeItem(key);
          }
        } catch {}
      }
      localStorage.setItem(migrationKey, "1");
    } catch {}
  }

  function wrapI2VRunButton() {
    const button = $("btnWanRun");
    if (!button || typeof button.onclick !== "function" || button.dataset.durationFixWrapped === "1") return;
    const original = button.onclick;
    button.dataset.durationFixWrapped = "1";
    button.onclick = async function (event) {
      applyDurationRule();
      return await original.call(this, event);
    };
  }

  function bindModelChanges() {
    const sel = $("mmI2VModel");
    if (!sel || sel.dataset.durationFixBound === "1") return;
    sel.dataset.durationFixBound = "1";
    sel.addEventListener("change", () => {
      const rule = DURATION_RULES[currentModel()];
      if (rule) applyDurationRule({ forceRecommended: true });
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    clearFalseDurationFailuresOnce();
    bindModelChanges();
    applyDurationRule();
    wrapI2VRunButton();

    // Refresh the health/status UI after removing false failures created by
    // the previous 1-second diagnostic request.
    const sel = $("mmI2VModel");
    if (sel) sel.dispatchEvent(new Event("change"));
  });
})();
