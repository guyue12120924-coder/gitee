(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const MODEL_SELECT_IDS = ["mmT2IModel", "mmEditModel", "mmI2VModel", "mmT2VModel"];
  const UPLOADS = [
    { inputId: "editImg1", previewId: "editImg1Preview", title: "上传原图", hint: "拖入或点击上传 JPG / PNG / WebP", badge: "必选" },
    { inputId: "editImg2", previewId: "editImg2Preview", title: "参考图", hint: "可选，用于风格、身份或结构参考", badge: "可选" },
    { inputId: "wanImg", previewId: "wanImgPreview", title: "首帧图片", hint: "拖入或点击上传，用这张图开始生成视频", badge: "必选" },
  ];

  const UPLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5"/><path d="m8 9 4-4 4 4"/><path d="M5 19h14"/></svg>';

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

  function decorateUpload(config) {
    const input = $(config.inputId);
    const preview = $(config.previewId);
    if (!input || input.dataset.studioUpload === "1") return;
    input.dataset.studioUpload = "1";
    input.classList.add("studio-upload-native");

    const field = input.parentElement;
    if (!field) return;
    field.classList.add("studio-upload-field");
    const legacyLabel = input.previousElementSibling?.classList?.contains("lab") ? input.previousElementSibling : null;
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

    const params = panel.querySelector(".mp-panel");
    if (params) params.insertAdjacentElement("afterend", details);
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

  function polishDynamicControls() {
    for (const input of document.querySelectorAll('input[id^="mp-"][id$="-duration"]')) decorateDurationInput(input);
  }

  function setupDynamicControls() {
    polishDynamicControls();
    for (const id of MODEL_SELECT_IDS) {
      $(id)?.addEventListener("change", () => setTimeout(polishDynamicControls, 0));
    }
  }

  function syncWorkflowClass() {
    const value = $("modelSel")?.value || "z-image";
    const task = value === "Edit-2511" ? "edit" : value === "Wan2.2-I2V-A14B" ? "i2v" : value === "HunyuanVideo-1.5" ? "t2v" : "t2i";
    document.body.dataset.studioWorkflow = task;
  }

  function setupWorkflowClass() {
    syncWorkflowClass();
    $("modelSel")?.addEventListener("change", syncWorkflowClass);
  }

  function init() {
    setupUploads();
    setupSecondaryFields();
    setupDynamicControls();
    setupWorkflowClass();
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(init))));
})();
