(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TRACKER = window.GiteeTaskTracker;
  const FUNCTION_VALUES = { edit: "Edit-2511", i2v: "Wan2.2-I2V-A14B" };
  const INPUT_IDS = { edit: "editImg1", i2v: "wanImg" };
  const PROMPT_IDS = { "z-image": "zPrompt", "Edit-2511": "editPrompt", "Wan2.2-I2V-A14B": "wanPrompt", "HunyuanVideo-1.5": "hyPrompt" };
  const BUTTON_IDS = { "z-image": "btnZRun", "Edit-2511": "btnEditRun", "Wan2.2-I2V-A14B": "btnWanRun", "HunyuanVideo-1.5": "btnHyRun" };

  function dispatch(el, type = "change") {
    if (el) el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function showToast(message, kind = "info") {
    let toast = $("studioToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "studioToast";
      toast.className = "studio-toast";
      document.body.appendChild(toast);
    }
    toast.className = `studio-toast is-visible studio-toast-${kind}`;
    toast.textContent = message;
    clearTimeout(window.__studioToastTimer);
    window.__studioToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  async function imageFileFromSrc(src) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`读取生成图片失败 HTTP ${response.status}`);
    const blob = await response.blob();
    const ext = blob.type.includes("webp") ? "webp" : blob.type.includes("jpeg") ? "jpg" : "png";
    return new File([blob], `generated-${Date.now()}.${ext}`, { type: blob.type || "image/png" });
  }

  async function sendImageTo(task, src) {
    const input = $(INPUT_IDS[task]);
    const modelSel = $("modelSel");
    if (!input || !modelSel) return;
    try {
      showToast("正在载入生成图片…");
      const file = await imageFileFromSrc(src);
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      dispatch(input);
      modelSel.value = FUNCTION_VALUES[task];
      dispatch(modelSel);
      setTimeout(() => {
        document.body.classList.add("studio-inspector-open");
        input.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      showToast(task === "edit" ? "图片已送入图像编辑" : "图片已送入图生视频", "ok");
    } catch (error) {
      showToast(String(error?.message || error), "err");
    }
  }

  function enhanceResultItem(item) {
    if (!item || item.dataset.resultWorkflowActions === "1") return;
    const image = item.querySelector("img");
    if (!image) return;
    item.dataset.resultWorkflowActions = "1";
    item.classList.add("studio-result-card");
    const actions = document.createElement("div");
    actions.className = "studio-result-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "studio-result-action";
    edit.textContent = "编辑";
    edit.title = "将此图直接用于图像编辑";
    edit.addEventListener("click", (event) => { event.stopPropagation(); sendImageTo("edit", image.currentSrc || image.src); });
    const video = document.createElement("button");
    video.type = "button";
    video.className = "studio-result-action";
    video.textContent = "生成视频";
    video.title = "将此图直接用于图生视频";
    video.addEventListener("click", (event) => { event.stopPropagation(); sendImageTo("i2v", image.currentSrc || image.src); });
    actions.append(edit, video);
    item.appendChild(actions);
  }

  function setupResultActions() {
    const output = $("output");
    if (!output) return;
    const sync = () => [...output.querySelectorAll(":scope > .item")].forEach(enhanceResultItem);
    new MutationObserver(sync).observe(output, { childList: true });
    sync();
  }

  function setupSettingsExtras() {
    const body = $("studioDrawerBody-settings");
    if (!body || $("studioSettingsExtras")) return;
    const box = document.createElement("section");
    box.id = "studioSettingsExtras";
    box.className = "studio-settings-extras";
    box.innerHTML = `<div class="studio-settings-section-title">快捷入口</div><div class="studio-settings-links"><a class="btn" href="https://github.com/MallocPointer/gitee/" target="_blank" rel="noopener">GitHub</a><button type="button" class="btn" id="studioSponsorShortcut">赞助项目</button></div><div class="studio-settings-tip">API Key 仅保存在当前浏览器；生成请求仍通过本站 Cloudflare 代理转发到 Gitee AI。</div>`;
    body.insertBefore(box, body.firstChild);
    $("studioSponsorShortcut")?.addEventListener("click", () => $("donateBtn")?.click());
    document.querySelector('.topbar-right > a[href*="github.com"]')?.classList.add("studio-top-secondary");
    $("donateBtn")?.classList.add("studio-top-secondary");
  }

  function setTaskBadge(count) {
    const targets = [$("studioTaskBtn"), ...document.querySelectorAll('[data-drawer="tasks"]')];
    for (const target of targets) {
      if (!target) continue;
      let badge = target.querySelector(".studio-count-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "studio-count-badge";
        target.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.hidden = count < 1;
    }
  }

  function updateTaskBadge() {
    if (!TRACKER?.list) return;
    const active = TRACKER.list().filter((run) => !run.finishedAt && !["success", "failed", "cancelled"].includes(run.state)).length;
    setTaskBadge(active);
  }

  function setupTaskBadge() {
    updateTaskBadge();
    TRACKER?.subscribe?.(() => updateTaskBadge());
  }

  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const active = document.activeElement;
      const typing = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        const value = $("modelSel")?.value || "z-image";
        const button = $(BUTTON_IDS[value]);
        if (button && !button.disabled) {
          event.preventDefault();
          button.click();
        }
        return;
      }
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const value = $("modelSel")?.value || "z-image";
        const prompt = $(PROMPT_IDS[value]);
        if (prompt) {
          event.preventDefault();
          prompt.focus();
        }
      }
      if (event.key === "Escape") document.body.classList.remove("studio-inspector-open");
    });
  }

  function init() {
    setupResultActions();
    setupSettingsExtras();
    setupTaskBadge();
    setupKeyboardShortcuts();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init))));
})();
