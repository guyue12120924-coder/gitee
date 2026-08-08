(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Current Gitee video catalog visible in the user's 2026-08-08 screenshot.
  // Prices are display hints only and may change on Gitee at any time.
  const CATALOG = {
    "HappyHorse-1.1": { price: "0.54 元/秒起", tasks: ["i2v"] },
    "ViduQ3-Pro": { price: "0.3125 元/秒起", tasks: ["i2v", "t2v"] },
    "ViduQ2-Pro": { price: "0.1563 元/秒起", tasks: ["i2v"] },
    "ViduQ2-Turbo": { price: "0.0875 元/秒起", tasks: ["i2v"] },
    "ViduQ3-Turbo": { price: "0.25 元/秒起", tasks: ["i2v", "t2v"] },
    "Wan2.7": { price: "0.6 元/秒起", tasks: ["i2v", "t2v"] },
    "HappyHorse-1.0": { price: "0.72 元/秒起", tasks: ["i2v"] },
    "LTX-2": { price: "0.3 元/秒", tasks: ["i2v", "t2v"] },
    "HunyuanVideo-1.5": { price: "0.3 元/秒", tasks: ["t2v"] },
    "Wan2_2-I2V-A14B": { price: "1.5 元/次", tasks: ["i2v"] },
    "Wan2.1-T2V-14B": { price: "1 元/次", tasks: ["t2v"] },
  };

  const SELECTS = {
    i2v: { id: "mmI2VModel", fallback: "Wan2_2-I2V-A14B" },
    t2v: { id: "mmT2VModel", fallback: "HunyuanVideo-1.5" },
  };

  function stripStatusIcon(text) {
    return String(text || "").replace(/^[✅❌🧪⚙️🟡]\s*/, "");
  }

  function stripPrice(text) {
    return String(text || "").replace(/\s*·\s*计费：[^·]+(?:元\/秒起|元\/秒|元\/次)?\s*$/u, "").trim();
  }

  function allowedFor(task, modelId) {
    if (modelId === "__custom__") return true;
    return Boolean(CATALOG[modelId]?.tasks?.includes(task));
  }

  function decorateOption(option) {
    if (!option || option.value === "__custom__") return;
    const item = CATALOG[option.value];
    if (!item) return;

    const currentText = option.textContent || "";
    const iconMatch = currentText.match(/^[✅❌🧪⚙️🟡]/);
    const icon = iconMatch?.[0] || "🟡";
    const existingBase = option.dataset.mmBaseText || stripStatusIcon(currentText);
    const base = stripPrice(existingBase);
    const pricedBase = `${base} · 计费：${item.price}`;

    // model-workbench.js reuses mmBaseText when it refreshes health status,
    // so update the stored base label as well as the visible label.
    option.dataset.mmBaseText = pricedBase;
    option.textContent = `${icon} ${pricedBase}`;
  }

  function removeEmptyGroups(select) {
    for (const group of [...select.querySelectorAll("optgroup")]) {
      if (!group.querySelector("option")) group.remove();
    }
  }

  function enforceCatalog(task) {
    const conf = SELECTS[task];
    const select = $(conf.id);
    if (!select) return;

    const oldValue = select.value;
    for (const option of [...select.options]) {
      if (!allowedFor(task, option.value)) {
        option.remove();
        continue;
      }
      decorateOption(option);
    }
    removeEmptyGroups(select);

    if (![...select.options].some((o) => o.value === oldValue)) {
      const fallback = [...select.options].some((o) => o.value === conf.fallback)
        ? conf.fallback
        : select.options[0]?.value;
      if (fallback) {
        select.value = fallback;
        try {
          const storageKey = task === "i2v" ? "moark_model_i2v" : "moark_model_t2v";
          localStorage.setItem(storageKey, fallback);
        } catch {}
        select.dispatchEvent(new Event("change"));
      }
    }
  }

  function addBillingNotice(task) {
    const conf = SELECTS[task];
    const box = $(conf.id)?.closest(".mm-model-box");
    if (!box || box.querySelector(`[data-video-billing-notice="${task}"]`)) return;

    const notice = document.createElement("div");
    notice.dataset.videoBillingNotice = task;
    notice.className = "hint";
    notice.style.marginTop = "10px";
    notice.style.padding = "10px 12px";
    notice.style.border = "1px solid rgba(245,158,11,.35)";
    notice.style.borderRadius = "10px";
    notice.style.background = "rgba(245,158,11,.08)";
    notice.textContent = "⚠ 当前 Gitee 视频生成列表显示的通用视频模型均为计费模型，未看到免费通用视频生成模型。下拉框中的价格来自当前页面截图，仅供参考，实际费用以 Gitee 实时页面为准。";
    box.appendChild(notice);
  }

  function protectPaidDiagnostic(task) {
    const button = $(`mmTest-${task}`);
    if (!button || button.dataset.paidConfirmBound === "1") return;
    button.dataset.paidConfirmBound = "1";
    button.addEventListener("click", (event) => {
      const modelId = $(SELECTS[task].id)?.value || "当前模型";
      const price = CATALOG[modelId]?.price || "以 Gitee 页面为准";
      const ok = window.confirm(`测试 ${modelId} 会真实提交视频生成任务并可能产生费用（当前显示：${price}）。是否继续？`);
      if (!ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function observeSyncedOptions(task) {
    const select = $(SELECTS[task].id);
    if (!select || select.dataset.catalogObserver === "1") return;
    select.dataset.catalogObserver = "1";
    let running = false;
    const observer = new MutationObserver(() => {
      if (running) return;
      running = true;
      queueMicrotask(() => {
        enforceCatalog(task);
        running = false;
      });
    });
    observer.observe(select, { childList: true, subtree: true });
  }

  window.addEventListener("DOMContentLoaded", () => {
    for (const task of ["i2v", "t2v"]) {
      enforceCatalog(task);
      addBillingNotice(task);
      protectPaidDiagnostic(task);
      observeSyncedOptions(task);
    }
  });
})();
