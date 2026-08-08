(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Ranges confirmed by Gitee errors from real I2V requests. The same Vidu /
  // HappyHorse / Wan2.7 model families use the same safe minimum when selected
  // in the generic T2V flow, preventing the diagnostic button from submitting
  // the old invalid 1-second request.
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

  function clamp(value, min, max) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function currentModel(task) {
    return $(task === "i2v" ? "mmI2VModel" : "mmT2VModel")?.value || "";
  }

  function durationInput(task) {
    return $(task === "i2v" ? "mmI2VDuration" : "mmT2VDuration");
  }

  function updateHint(task, modelId, rule) {
    const controls = task === "i2v"
      ? $("mmI2VGenericControls")
      : $("mmT2VDuration")?.closest(".grid2");
    const hint = task === "i2v"
      ? controls?.querySelector(".hint")
      : $("mm-t2v-note");
    if (!rule) return;

    const text = `${modelId} 时长范围：${rule.min}–${rule.max} 秒；推荐先用 ${rule.recommended} 秒测试。程序会在提交前自动校正非法时长。`;
    if (hint) {
      if (task === "t2v") {
        const base = hint.textContent.split(" · 时长适配：")[0];
        hint.textContent = `${base} · 时长适配：${text}`;
      } else {
        hint.textContent = text;
      }
    }
  }

  function applyDurationRule(task, { forceRecommended = false } = {}) {
    const modelId = currentModel(task);
    const rule = DURATION_RULES[modelId];
    if (!rule) return;

    const genericDuration = durationInput(task);
    const legacyDuration = task === "i2v" ? $("wanDuration") : null;

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

    updateHint(task, modelId, rule);
  }

  function clearFalseDurationFailuresOnce() {
    const migrationKey = "moark_video_duration_validation_fix_v2";
    try {
      if (localStorage.getItem(migrationKey) === "1") return;
      for (const task of ["i2v", "t2v"]) {
        for (const modelId of AFFECTED_MODELS) {
          const key = `moark_model_health_v1:${task}:${modelId}`;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.state === "fail" && /duration|时长|参数范围/i.test(parsed?.detail || "")) {
              localStorage.removeItem(key);
            }
          } catch {}
        }
      }
      localStorage.setItem(migrationKey, "1");
    } catch {}
  }

  function wrapRunButton(task) {
    const button = $(task === "i2v" ? "btnWanRun" : "btnHyRun");
    if (!button || typeof button.onclick !== "function" || button.dataset.durationFixWrapped === "1") return;
    const original = button.onclick;
    button.dataset.durationFixWrapped = "1";
    button.onclick = async function (event) {
      applyDurationRule(task);
      return await original.call(this, event);
    };
  }

  function bindModelChanges(task) {
    const sel = $(task === "i2v" ? "mmI2VModel" : "mmT2VModel");
    if (!sel || sel.dataset.durationFixBound === "1") return;
    sel.dataset.durationFixBound = "1";
    sel.addEventListener("change", () => {
      const rule = DURATION_RULES[currentModel(task)];
      if (rule) applyDurationRule(task, { forceRecommended: true });
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    clearFalseDurationFailuresOnce();

    for (const task of ["i2v", "t2v"]) {
      bindModelChanges(task);
      applyDurationRule(task);
      wrapRunButton(task);
    }

    // Refresh health/status UI after removing false failures created by old
    // 1-second diagnostics.
    $("mmI2VModel")?.dispatchEvent(new Event("change"));
    $("mmT2VModel")?.dispatchEvent(new Event("change"));
  });
})();
