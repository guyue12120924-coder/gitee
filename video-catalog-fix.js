(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Curated from the Gitee video-generation page shown on 2026-08-08.
  // Keep normal I2V/T2V menus focused on strong general video models that are
  // visible on that page and can be tried there. Digital-human/audio-driven
  // models (Duix-Avatar, InfiniteTalk, Duix.Heygem) are intentionally excluded
  // because they need a different task flow and request schema.
  const VIDEO_CATALOG = {
    i2v: {
      fallback: "ViduQ3-Pro",
      recommended: [
        { id: "ViduQ3-Pro", label: "ViduQ3-Pro", note: "高质量 · 最长 16s" },
        { id: "ViduQ3-Turbo", label: "ViduQ3-Turbo", note: "高性能 · 速度更快" },
        { id: "ViduQ2-Pro", label: "ViduQ2-Pro", note: "参考控制 · 图生视频" },
        { id: "HappyHorse-1.1", label: "HappyHorse-1.1", note: "高质量 · 图生视频" },
        { id: "Wan2.7", label: "Wan2.7", note: "新一代 Wan 视频模型" },
        { id: "Wan2_2-I2V-A14B", label: "Wan2.2-I2V-A14B", note: "原项目稳定链路" },
        { id: "LTX-2", label: "LTX-2", note: "音视频基础模型" },
      ],
      optional: [
        { id: "ViduQ2-Turbo", label: "ViduQ2-Turbo", note: "快速 · 备选" },
        { id: "HappyHorse-1.0", label: "HappyHorse-1.0", note: "上一代 · 备选" },
      ],
    },
    t2v: {
      fallback: "HunyuanVideo-1.5",
      recommended: [
        { id: "HunyuanVideo-1.5", label: "HunyuanVideo-1.5", note: "原项目稳定链路" },
        { id: "ViduQ3-Pro", label: "ViduQ3-Pro", note: "高质量 · 最长 16s" },
        { id: "ViduQ3-Turbo", label: "ViduQ3-Turbo", note: "高性能 · 速度更快" },
        { id: "Wan2.7", label: "Wan2.7", note: "新一代 Wan 视频模型" },
        { id: "Wan2.1-T2V-14B", label: "Wan2.1-T2V-14B", note: "专用文生视频" },
        { id: "LTX-2", label: "LTX-2", note: "音视频基础模型" },
      ],
      optional: [
        { id: "HappyHorse-1.1", label: "HappyHorse-1.1", note: "页面可体验 · 兼容适配" },
      ],
    },
  };

  const SELECT_IDS = {
    i2v: "mmI2VModel",
    t2v: "mmT2VModel",
  };

  const VERIFIED = {
    i2v: new Set(["Wan2_2-I2V-A14B"]),
    t2v: new Set(["HunyuanVideo-1.5"]),
  };

  const enforcing = new WeakSet();

  function localHealth(task, modelId) {
    try {
      const raw = localStorage.getItem(`moark_model_health_v1:${task}:${modelId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function statusIcon(task, modelId) {
    const local = localHealth(task, modelId);
    if (local?.state === "pass") return "✅";
    if (local?.state === "fail") return "❌";
    if (VERIFIED[task]?.has(modelId)) return "✅";
    if (["Wan2.7", "LTX-2"].includes(modelId)) return "🧪";
    return "🟡";
  }

  function makeOption(task, item, tag) {
    const option = document.createElement("option");
    option.value = item.id;
    const base = `${item.label} · ${tag} · ${item.note}`;
    option.dataset.mmBaseText = base;
    option.textContent = `${statusIcon(task, item.id)} ${base}`;
    return option;
  }

  function makeGroup(task, label, items, tag) {
    const group = document.createElement("optgroup");
    group.label = label;
    for (const item of items) group.appendChild(makeOption(task, item, tag));
    return group;
  }

  function allAllowedIds(task) {
    const conf = VIDEO_CATALOG[task];
    return new Set([
      ...conf.recommended.map((m) => m.id),
      ...conf.optional.map((m) => m.id),
      "__custom__",
    ]);
  }

  function rebuildCatalog(task) {
    const select = $(SELECT_IDS[task]);
    const conf = VIDEO_CATALOG[task];
    if (!select || !conf) return;

    const previous = select.value;
    enforcing.add(select);

    select.innerHTML = "";
    select.appendChild(makeGroup(task, "推荐体验", conf.recommended, "推荐体验"));
    if (conf.optional.length) {
      select.appendChild(makeGroup(task, "备选模型", conf.optional, "备选"));
    }

    const customGroup = document.createElement("optgroup");
    customGroup.label = "自定义";
    const custom = document.createElement("option");
    custom.value = "__custom__";
    custom.dataset.mmBaseText = "自定义模型…";
    custom.textContent = "⚙️ 自定义模型…";
    customGroup.appendChild(custom);
    select.appendChild(customGroup);

    const allowed = allAllowedIds(task);
    const next = allowed.has(previous) && [...select.options].some((o) => o.value === previous)
      ? previous
      : conf.fallback;
    select.value = next;

    try {
      const storageKey = task === "i2v" ? "moark_model_i2v" : "moark_model_t2v";
      if (!allowed.has(localStorage.getItem(storageKey))) localStorage.setItem(storageKey, next);
    } catch {}

    select.dispatchEvent(new Event("change"));
    setTimeout(() => enforcing.delete(select), 0);
  }

  function addTrialNotice(task) {
    const select = $(SELECT_IDS[task]);
    const box = select?.closest(".mm-model-box");
    if (!box || box.querySelector(`[data-video-trial-notice="${task}"]`)) return;

    const notice = document.createElement("div");
    notice.dataset.videoTrialNotice = task;
    notice.className = "hint";
    notice.style.marginTop = "10px";
    notice.style.padding = "10px 12px";
    notice.style.border = "1px solid rgba(59,130,246,.28)";
    notice.style.borderRadius = "10px";
    notice.style.background = "rgba(59,130,246,.06)";
    notice.textContent = "ℹ 已按当前 Gitee 视频生成页精选模型。截图中的这些模型可在 Gitee 页面进行免费体验；通过本工具直接调用 API 时，是否消耗体验额度或产生费用仍以 Gitee 当前账户/API 规则为准。";
    box.appendChild(notice);
  }

  function protectDiagnostic(task) {
    const button = $(`mmTest-${task}`);
    if (!button || button.dataset.trialConfirmBound === "1") return;
    button.dataset.trialConfirmBound = "1";
    button.addEventListener("click", (event) => {
      const modelId = $(SELECT_IDS[task])?.value || "当前模型";
      const ok = window.confirm(`将真实提交 ${modelId} 视频生成任务。Gitee 页面支持免费体验，但 API 调用可能消耗体验额度或产生费用。是否继续？`);
      if (!ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function observeExternalModelChanges(task) {
    const select = $(SELECT_IDS[task]);
    if (!select || select.dataset.curatedCatalogObserver === "1") return;
    select.dataset.curatedCatalogObserver = "1";
    const allowed = allAllowedIds(task);

    const observer = new MutationObserver(() => {
      if (enforcing.has(select)) return;
      const values = [...select.options].map((o) => o.value);
      const hasUnknown = values.some((id) => !allowed.has(id));
      const hasMissingRecommended = VIDEO_CATALOG[task].recommended.some((m) => !values.includes(m.id));
      if (hasUnknown || hasMissingRecommended) rebuildCatalog(task);
    });
    observer.observe(select, { childList: true, subtree: true });
  }

  window.addEventListener("DOMContentLoaded", () => {
    for (const task of ["i2v", "t2v"]) {
      rebuildCatalog(task);
      addTrialNotice(task);
      protectDiagnostic(task);
      observeExternalModelChanges(task);
    }
  });
})();
