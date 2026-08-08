(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TRACKER = window.GiteeTaskTracker;
  const MODEL_SELECT_IDS = ["mmT2IModel", "mmEditModel", "mmI2VModel", "mmT2VModel"];
  const FUNCTION_TO_TASK = {
    "z-image": "t2i",
    "Edit-2511": "edit",
    "Wan2.2-I2V-A14B": "i2v",
    "HunyuanVideo-1.5": "t2v",
  };
  const TASK_BUTTON_IDS = { t2i: "btnZRun", edit: "btnEditRun", i2v: "btnWanRun", t2v: "btnHyRun" };
  const EMPTY_COPY = {
    t2i: ["描述你的想法", "输入 Prompt，然后开始创作。"],
    edit: ["开始编辑图片", "上传原图，描述你希望修改的内容。"],
    i2v: ["让图片动起来", "上传首帧图片，描述动作和镜头。"],
    t2v: ["描述你的视频", "输入场景、动作与镜头语言，然后开始生成。"],
  };
  const UPLOADS = [
    { inputId: "editImg1", previewId: "editImg1Preview", title: "上传原图", hint: "拖入或点击上传 JPG / PNG / WebP", badge: "必选" },
    { inputId: "editImg2", previewId: "editImg2Preview", title: "参考图", hint: "可选，用于风格、身份或结构参考", badge: "可选" },
    { inputId: "wanImg", previewId: "wanImgPreview", title: "首帧图片", hint: "拖入或点击上传，用这张图开始生成视频", badge: "必选" },
  ];

  const UPLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5"/><path d="m8 9 4-4 4 4"/><path d="M5 19h14"/></svg>';

  function activeTask() {
    return FUNCTION_TO_TASK[$("modelSel")?.value] || "t2i";
  }

  function dispatchValue(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fileMeta(file) {
    if (!file) return "";
    const kb = file.size / 1024;
    const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
    return `${file.name} · ${size}`;
  }

  function setFiles(input, files) {
    try {
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(file);
      input.files = transfer.files;
      dispatchValue(input);
    } catch {
      input.click();
    }
  }

  function uploadFieldHost(input, preview) {
    let field = input.parentElement;
    if (!field) return null;
    const legacyLabel = input.previousElementSibling?.classList?.contains("lab") ? input.previousElementSibling : null;
    if (field.classList.contains("workspace-inspector-panel")) {
      const host = document.createElement("div");
      field.insertBefore(host, legacyLabel || input);
      if (legacyLabel) host.appendChild(legacyLabel);
      host.appendChild(input);
      if (preview) host.appendChild(preview);
      field = host;
    }
    return field;
  }

  function decorateUpload(config) {
    const input = $(config.inputId);
    const preview = $(config.previewId);
    if (!input || input.dataset.studioUpload === "1") return;
    input.dataset.studioUpload = "1";
    input.classList.add("studio-upload-native");

    const field = uploadFieldHost(input, preview);
    if (!field) return;
    field.classList.add("studio-upload-field");
    const legacyLabel = input.previousElementSibling?.classList?.contains("lab") ? input.previousElementSibling : field.querySelector(":scope > .lab");
    legacyLabel?.classList.add("studio-upload-legacy-label");

    const card = document.createElement("div");
    card.className = "studio-upload-card";
    card.dataset.inputId = config.inputId;

    const zone = document.createElement("button");
    zone.type = "button";
    zone.className = "studio-upload-zone";
    zone.innerHTML = `<span class="studio-upload-icon">${UPLOAD_ICON}</span><span class="studio-upload-copy"><strong>${config.title}</strong><span>${config.hint}</span></span><span class="studio-upload-badge">${config.badge}</span>`;
    zone.addEventListener("click", () => input.click());

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "studio-upload-clear";
    clear.textContent = "移除";
    clear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.value = "";
      dispatchValue(input);
    });

    field.insertBefore(card, input);
    card.append(zone, input);
    if (preview) {
      preview.classList.add("studio-upload-preview");
      card.appendChild(preview);
    }
    card.appendChild(clear);

    const copyHint = zone.querySelector(".studio-upload-copy span");
    const sync = () => {
      const file = input.files?.[0] || null;
      card.classList.toggle("has-file", Boolean(file));
      if (copyHint) copyHint.textContent = file ? fileMeta(file) : config.hint;
      if (!file && preview) preview.replaceChildren();
    };

    input.addEventListener("change", () => setTimeout(sync, 0));
    for (const eventName of ["dragenter", "dragover"]) {
      card.addEventListener(eventName, (event) => {
        event.preventDefault();
        card.classList.add("is-dragover");
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      card.addEventListener(eventName, (event) => {
        event.preventDefault();
        card.classList.remove("is-dragover");
      });
    }
    card.addEventListener("drop", (event) => {
      const files = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("image/"));
      if (files.length) setFiles(input, [files[0]]);
    });
    sync();
  }

  function setupUploads() {
    for (const config of UPLOADS) decorateUpload(config);
  }

  function moveUploadStack(panelId, inputIds, stackClass) {
    const panel = $(panelId);
    const modelBox = panel?.querySelector(".mm-model-box");
    if (!panel || !modelBox) return;
    let stack = panel.querySelector(`.${stackClass}`);
    if (!stack) {
      stack = document.createElement("div");
      stack.className = `studio-upload-stack ${stackClass}`;
      modelBox.insertAdjacentElement("afterend", stack);
    }
    for (const inputId of inputIds) {
      const field = $(inputId)?.closest(".studio-upload-field");
      if (!field || field.parentElement === stack) continue;
      const oldParent = field.parentElement;
      stack.appendChild(field);
      if (oldParent?.matches?.(".grid2,.grid3") && oldParent.children.length === 0) oldParent.remove();
    }
  }

  function moveDeveloperToolsToBottom() {
    for (const panelId of ["panelZ", "panelEdit", "panelWan", "panelHunyuan"]) {
      const panel = $(panelId);
      const developer = panel?.querySelector(".studio-model-developer-tools");
      if (panel && developer && developer.parentElement !== panel) panel.appendChild(developer);
    }
  }

  function reorderWorkflowInputs() {
    moveUploadStack("panelEdit", ["editImg1", "editImg2"], "studio-edit-upload-stack");
    moveUploadStack("panelWan", ["wanImg"], "studio-i2v-upload-stack");
    moveDeveloperToolsToBottom();
  }

  function moveSecondaryField(textareaId, title) {
    const textarea = $(textareaId);
    if (!textarea || textarea.dataset.studioSecondary === "1") return;
    textarea.dataset.studioSecondary = "1";
    const label = textarea.previousElementSibling?.classList?.contains("lab") ? textarea.previousElementSibling : null;
    const panel = textarea.closest(".workspace-inspector-panel");
    if (!panel) return;

    const details = document.createElement("details");
    details.className = "studio-secondary-field";
    const summary = document.createElement("summary");
    summary.textContent = title;
    const body = document.createElement("div");
    body.className = "studio-secondary-field-body";
    if (label) body.appendChild(label);
    body.appendChild(textarea);
    details.append(summary, body);

    const developer = panel.querySelector(".studio-model-developer-tools");
    if (developer) developer.insertAdjacentElement("beforebegin", details);
    else panel.appendChild(details);
  }

  function setupSecondaryFields() {
    moveSecondaryField("wanNeg", "负面提示词（可选）");
    moveSecondaryField("hyNeg", "负面提示词（可选）");
  }

  function stepNumber(input, direction) {
    const current = Number.parseFloat(input.value || "0") || 0;
    const step = Number.parseFloat(input.step || "1") || 1;
    const min = input.min === "" ? -Infinity : Number.parseFloat(input.min);
    const max = input.max === "" ? Infinity : Number.parseFloat(input.max);
    const next = Math.min(max, Math.max(min, current + direction * step));
    input.value = Number.isInteger(step) ? String(Math.round(next)) : String(Number(next.toFixed(3)));
    dispatchValue(input);
  }

  function decorateDurationInput(input) {
    if (!input || input.dataset.studioDuration === "1") return;
    input.dataset.studioDuration = "1";
    const wrap = document.createElement("div");
    wrap.className = "studio-duration-wrap";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "studio-duration-button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "减少时长");
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "studio-duration-button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "增加时长");
    input.insertAdjacentElement("beforebegin", wrap);
    wrap.append(minus, input, plus);
    minus.addEventListener("click", () => stepNumber(input, -1));
    plus.addEventListener("click", () => stepNumber(input, 1));
  }

  function ensureHunyuanDuration() {
    if ($("mmT2VModel")?.value !== "HunyuanVideo-1.5") return;
    const renderedFrames = $("mp-t2v-frames");
    const sourceFrames = $("hyFrames");
    const sourceFps = $("hyFps");
    const field = renderedFrames?.closest(".mp-field");
    if (!renderedFrames || !sourceFrames || !sourceFps || !field) return;
    field.classList.add("studio-technical-primary-hidden");

    let durationField = $("studioHunyuanDuration");
    if (!durationField) {
      durationField = document.createElement("div");
      durationField.id = "studioHunyuanDuration";
      durationField.className = "mp-field studio-hunyuan-duration-field";
      durationField.innerHTML = `<div class="mp-label">视频时长</div><div class="studio-human-duration"><button type="button" data-step="-1" aria-label="减少视频时长">−</button><strong></strong><button type="button" data-step="1" aria-label="增加视频时长">+</button></div><div class="studio-duration-help"></div>`;
      field.insertAdjacentElement("beforebegin", durationField);
    }

    const sync = () => {
      const fps = Math.max(1, Number.parseInt(sourceFps.value || "24", 10) || 24);
      const frames = Math.max(81, Math.min(241, Number.parseInt(sourceFrames.value || "241", 10) || 241));
      const seconds = Math.max(4, Math.min(10, Math.round((frames - 1) / fps)));
      durationField.querySelector("strong").textContent = `${seconds} 秒`;
      durationField.querySelector(".studio-duration-help").textContent = `内部自动换算：${frames} 帧 @ ${fps} FPS`;
      durationField.dataset.seconds = String(seconds);
    };

    for (const button of durationField.querySelectorAll("button[data-step]")) {
      if (button.dataset.bound === "1") continue;
      button.dataset.bound = "1";
      button.addEventListener("click", () => {
        const fps = Math.max(1, Number.parseInt(sourceFps.value || "24", 10) || 24);
        const current = Number.parseInt(durationField.dataset.seconds || "10", 10) || 10;
        const next = Math.max(4, Math.min(10, current + Number(button.dataset.step || 0)));
        sourceFrames.value = String(Math.max(81, Math.min(241, Math.round(next * fps) + 1)));
        dispatchValue(sourceFrames);
        sync();
      });
    }
    if (sourceFrames.dataset.durationBound !== "1") {
      sourceFrames.dataset.durationBound = "1";
      sourceFrames.addEventListener("change", sync);
      sourceFps.addEventListener("change", sync);
    }
    sync();
  }

  function wanPresetMeta(option) {
    const text = `${option?.textContent || ""} ${option?.value || ""}`;
    const ratio = /横屏/i.test(text) ? "16:9" : /竖屏/i.test(text) ? "9:16" : /方图|方形/i.test(text) ? "1:1" : "";
    const quality = /2048/i.test(text) ? "2048" : /1024/i.test(text) ? "1024" : /720p/i.test(text) ? "720P" : /480p/i.test(text) ? "480P" : "";
    return { option, ratio, quality };
  }

  function ensureWanFormatControls() {
    if ($("mmI2VModel")?.value !== "Wan2_2-I2V-A14B") return;
    const rendered = $("mp-i2v-resolutionPreset");
    const source = $("wanResPreset");
    const field = rendered?.closest(".mp-field");
    if (!rendered || !source || !field) return;
    field.classList.add("studio-technical-primary-hidden");

    let root = $("studioWanFormat");
    if (!root) {
      root = document.createElement("div");
      root.id = "studioWanFormat";
      root.className = "mp-field mp-field-full studio-wan-format-field";
      root.innerHTML = `<div class="studio-friendly-control"><div class="mp-label">画面比例</div><div class="studio-friendly-options" data-kind="ratio"></div></div><div class="studio-friendly-control"><div class="mp-label">清晰度</div><div class="studio-friendly-options" data-kind="quality"></div></div><div class="studio-duration-help" data-kind="actual"></div>`;
      field.insertAdjacentElement("beforebegin", root);
    }

    const metas = [...source.options].map(wanPresetMeta).filter((item) => item.ratio && item.quality);
    const currentMeta = () => wanPresetMeta(source.selectedOptions?.[0]);
    const apply = (meta) => {
      if (!meta?.option) return;
      source.value = meta.option.value;
      dispatchValue(source);
      $("btnWanApplyPreset")?.click();
      setTimeout(sync, 0);
    };
    const button = (label, active, onClick) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `studio-friendly-option${active ? " is-active" : ""}`;
      el.textContent = label;
      el.addEventListener("click", onClick);
      return el;
    };
    const sync = () => {
      const current = currentMeta();
      const ratioHost = root.querySelector('[data-kind="ratio"]');
      const qualityHost = root.querySelector('[data-kind="quality"]');
      ratioHost.replaceChildren();
      qualityHost.replaceChildren();
      const ratios = [...new Set(metas.map((item) => item.ratio))];
      for (const ratio of ratios) {
        ratioHost.appendChild(button(ratio, ratio === current.ratio, () => {
          const preferred = metas.find((item) => item.ratio === ratio && item.quality === current.quality) || metas.find((item) => item.ratio === ratio);
          apply(preferred);
        }));
      }
      const qualities = metas.filter((item) => item.ratio === current.ratio);
      for (const meta of qualities) qualityHost.appendChild(button(meta.quality, meta.quality === current.quality, () => apply(meta)));
      const raw = source.selectedOptions?.[0]?.textContent || source.value || "";
      root.querySelector('[data-kind="actual"]').textContent = raw ? `实际预设：${raw}` : "";
    };
    sync();
  }

  function polishDynamicControls() {
    for (const input of document.querySelectorAll('input[id^="mp-"][id$="-duration"]')) decorateDurationInput(input);
    ensureHunyuanDuration();
    ensureWanFormatControls();
  }

  function setupDynamicControls() {
    polishDynamicControls();
    for (const id of MODEL_SELECT_IDS) {
      $(id)?.addEventListener("change", () => setTimeout(() => {
        reorderWorkflowInputs();
        moveDeveloperToolsToBottom();
        polishDynamicControls();
      }, 0));
    }
  }

  function inferOutputWorkflow(item) {
    const text = `${item.querySelector("h3")?.textContent || ""} ${item.querySelector(".meta")?.textContent || ""}`.toLowerCase();
    if (/文生视频|text[-\s]?to[-\s]?video|hunyuan/.test(text)) return "t2v";
    if (/图生视频|image[-\s]?to[-\s]?video|wan2|vidu|happyhorse/.test(text)) return "i2v";
    if (/图像编辑|image edit|qwen-image-edit|编辑/.test(text)) return "edit";
    if (/文生图|text[-\s]?to[-\s]?image|qwen-image|z-image|flux|stable diffusion|cogview|kolors|hidream|glm-image|longcat-image/.test(text)) return "t2i";
    return activeTask();
  }

  function tagOutputItem(item) {
    if (!item?.matches?.(".item") || item.dataset.studioWorkflow) return;
    item.dataset.studioWorkflow = inferOutputWorkflow(item);
  }

  function syncVisibleGallery() {
    const output = $("output");
    if (!output) return;
    const task = activeTask();
    const items = [...output.querySelectorAll(":scope > .item")];
    for (const item of items) {
      tagOutputItem(item);
      item.hidden = item.dataset.studioWorkflow !== task;
    }
    const visible = items.filter((item) => !item.hidden);
    const visibleMedia = visible.filter((item) => item.querySelector("img,video"));
    output.classList.remove("studio-gallery-one", "studio-gallery-two", "studio-gallery-many");
    if (visibleMedia.length === 1) output.classList.add("studio-gallery-one");
    else if (visibleMedia.length === 2) output.classList.add("studio-gallery-two");
    else if (visibleMedia.length > 2) output.classList.add("studio-gallery-many");

    const empty = $("workspacePreviewEmpty");
    if (empty) {
      empty.hidden = visible.length > 0;
      const copy = EMPTY_COPY[task] || EMPTY_COPY.t2i;
      const strong = empty.querySelector("strong");
      const paragraph = empty.querySelector("p");
      if (strong) strong.textContent = copy[0];
      if (paragraph) paragraph.textContent = copy[1];
    }
  }

  function setupWorkflowOutputViews() {
    const output = $("output");
    if (!output) return;
    for (const item of output.querySelectorAll(":scope > .item")) tagOutputItem(item);
    const schedule = () => requestAnimationFrame(() => requestAnimationFrame(syncVisibleGallery));
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) if (node.nodeType === 1) tagOutputItem(node);
      }
      schedule();
    }).observe(output, { childList: true });
    $("modelSel")?.addEventListener("change", schedule);
    schedule();
  }

  function syncWorkflowClass() {
    document.body.dataset.studioWorkflow = activeTask();
    setTimeout(syncVisibleGallery, 0);
  }

  function setupWorkflowClass() {
    syncWorkflowClass();
    $("modelSel")?.addEventListener("change", syncWorkflowClass);
  }

  function setupTaskButtonProgress() {
    if (!TRACKER?.list) return;
    const idleLabels = new Map();
    for (const [task, id] of Object.entries(TASK_BUTTON_IDS)) {
      const button = $(id);
      if (button) idleLabels.set(task, button.textContent.trim());
    }
    const update = () => {
      const now = Date.now();
      const runs = TRACKER.list();
      for (const [task, id] of Object.entries(TASK_BUTTON_IDS)) {
        const button = $(id);
        if (!button) continue;
        const run = runs.filter((item) => item.task === task && !item.finishedAt && !["success", "failed", "cancelled"].includes(item.state)).sort((a, b) => b.startedAt - a.startedAt)[0];
        if (run) {
          const seconds = Math.max(0, Math.floor((now - run.startedAt) / 1000));
          button.textContent = `生成中 · ${seconds}s`;
          button.disabled = true;
          button.classList.add("is-generating");
        } else {
          button.textContent = idleLabels.get(task) || "生成";
          button.disabled = false;
          button.classList.remove("is-generating");
        }
      }
    };
    TRACKER.subscribe(() => update());
    setInterval(update, 1000);
    update();
  }

  function init() {
    setupUploads();
    reorderWorkflowInputs();
    setupSecondaryFields();
    moveDeveloperToolsToBottom();
    setupDynamicControls();
    setupWorkflowOutputViews();
    setupWorkflowClass();
    setupTaskButtonProgress();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init))));
})();