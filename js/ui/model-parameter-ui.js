(() => {
  "use strict";

  const REGISTRY = window.GiteeModelRegistry;
  const ADAPTERS = window.GiteeModelAdapters;
  if (!REGISTRY || !ADAPTERS) throw new Error("Model Registry / Adapter layer must load before model-parameter-ui.js");

  const $ = (id) => document.getElementById(id);
  const SELECT_IDS = { t2i: "mmT2IModel", edit: "mmEditModel", i2v: "mmI2VModel", t2v: "mmT2VModel" };
  const PANEL_IDS = { t2i: "panelZ", edit: "panelEdit", i2v: "panelWan", t2v: "panelHunyuan" };
  const TASK_LABELS = { t2i: "文生图", edit: "图像编辑", i2v: "图生视频", t2v: "文生视频" };

  function currentModelId(task) {
    return $(SELECT_IDS[task])?.value || "";
  }

  function currentModel(task) {
    return REGISTRY.model(task, currentModelId(task));
  }

  function currentAdapter(task) {
    return ADAPTERS.forModel(task, currentModelId(task));
  }

  function normalizeOption(option) {
    if (typeof option === "object" && option) {
      return { value: String(option.value ?? option.id ?? option.label ?? ""), label: String(option.label ?? option.value ?? option.id ?? "") };
    }
    return { value: String(option), label: String(option) };
  }

  function sourceOptions(parameter) {
    if (parameter.options !== "source") return (parameter.options || []).map(normalizeOption);
    const source = $(parameter.sourceId);
    if (!source || source.tagName !== "SELECT") return [];
    return [...source.options].map((option) => ({ value: option.value, label: option.textContent || option.value }));
  }

  function readSourceValue(parameter) {
    const source = parameter.sourceId ? $(parameter.sourceId) : null;
    if (!source) return parameter.default;
    if (parameter.type === "checkbox") return Boolean(source.checked);
    return source.value !== "" ? source.value : parameter.default;
  }

  function dispatchSourceEvents(source) {
    source.dispatchEvent(new Event("input", { bubbles: true }));
    source.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncPanelFromSources(task) {
    const panel = $(`modelParams-${task}`);
    if (!panel) return;
    for (const control of panel.querySelectorAll("[data-source-id]")) {
      const source = $(control.dataset.sourceId);
      if (!source) continue;
      if (control.type === "checkbox") control.checked = Boolean(source.checked);
      else control.value = source.value;
    }
    for (const control of panel.querySelectorAll("[data-source-name][data-source-value]")) {
      const source = [...document.querySelectorAll(`input[name="${CSS.escape(control.dataset.sourceName)}"]`)]
        .find((input) => input.value === control.dataset.sourceValue);
      if (source) control.checked = Boolean(source.checked);
    }
  }

  function syncControlToSource(task, parameter, control) {
    const source = parameter.sourceId ? $(parameter.sourceId) : null;
    if (source) {
      if (parameter.type === "checkbox") source.checked = control.checked;
      else source.value = control.value;
      dispatchSourceEvents(source);
    }
    if (parameter.triggerClickId) $(parameter.triggerClickId)?.click();
    setTimeout(() => syncPanelFromSources(task), 0);
  }

  function syncCheckboxGroup(parameter, control) {
    const source = [...document.querySelectorAll(`input[name="${CSS.escape(parameter.sourceName)}"]`)]
      .find((input) => input.value === control.value);
    if (!source) return;
    source.checked = control.checked;
    dispatchSourceEvents(source);
  }

  function fieldHelp(parameter) {
    if (!parameter.help) return null;
    const help = document.createElement("div");
    help.className = "mp-field-help";
    help.textContent = parameter.help;
    return help;
  }

  function renderCheckboxGroup(task, parameter) {
    const field = document.createElement("div");
    field.className = "mp-field mp-field-full";
    const label = document.createElement("div");
    label.className = "mp-label";
    label.textContent = parameter.label;
    field.appendChild(label);

    const checks = document.createElement("div");
    checks.className = "mp-checks";
    const originals = [...document.querySelectorAll(`input[name="${CSS.escape(parameter.sourceName)}"]`)];
    for (const option of parameter.options || []) {
      const normalized = normalizeOption(option);
      const source = originals.find((input) => input.value === normalized.value);
      const wrapper = document.createElement("label");
      wrapper.className = "mp-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = normalized.value;
      input.checked = source ? source.checked : false;
      input.dataset.sourceName = parameter.sourceName;
      input.dataset.sourceValue = normalized.value;
      input.addEventListener("change", () => syncCheckboxGroup(parameter, input));
      wrapper.append(input, document.createTextNode(` ${normalized.label}`));
      checks.appendChild(wrapper);
    }
    field.appendChild(checks);
    const help = fieldHelp(parameter);
    if (help) field.appendChild(help);
    return field;
  }

  function renderField(task, parameter) {
    if (parameter.type === "checkbox-group") return renderCheckboxGroup(task, parameter);

    const field = document.createElement("div");
    field.className = `mp-field${parameter.span === "full" ? " mp-field-full" : ""}`;

    if (parameter.type === "checkbox") {
      const wrapper = document.createElement("label");
      wrapper.className = "mp-check mp-check-single";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(readSourceValue(parameter));
      input.id = `mp-${task}-${parameter.key}`;
      if (parameter.sourceId) input.dataset.sourceId = parameter.sourceId;
      input.addEventListener("change", () => syncControlToSource(task, parameter, input));
      wrapper.append(input, document.createTextNode(` ${parameter.label}`));
      field.appendChild(wrapper);
      const help = fieldHelp(parameter);
      if (help) field.appendChild(help);
      return field;
    }

    const label = document.createElement("label");
    label.className = "mp-label";
    label.htmlFor = `mp-${task}-${parameter.key}`;
    label.textContent = parameter.label;
    field.appendChild(label);

    let control;
    if (parameter.type === "select") {
      control = document.createElement("select");
      for (const option of sourceOptions(parameter)) {
        const el = document.createElement("option");
        el.value = option.value;
        el.textContent = option.label;
        control.appendChild(el);
      }
      const sourceValue = readSourceValue(parameter);
      const values = [...control.options].map((option) => option.value);
      control.value = values.includes(String(sourceValue)) ? String(sourceValue) : String(parameter.default ?? values[0] ?? "");
    } else {
      control = document.createElement("input");
      control.type = parameter.type === "number" ? "number" : "text";
      if (parameter.min !== undefined) control.min = String(parameter.min);
      if (parameter.max !== undefined) control.max = String(parameter.max);
      if (parameter.step !== undefined) control.step = String(parameter.step);
      const sourceValue = readSourceValue(parameter);
      control.value = String(sourceValue ?? parameter.default ?? "");
    }

    control.id = `mp-${task}-${parameter.key}`;
    control.className = "input mp-control";
    if (parameter.sourceId) control.dataset.sourceId = parameter.sourceId;
    control.addEventListener("change", () => syncControlToSource(task, parameter, control));
    if (parameter.type === "number") control.addEventListener("input", () => syncControlToSource(task, parameter, control));
    field.appendChild(control);

    const help = fieldHelp(parameter);
    if (help) field.appendChild(help);
    return field;
  }

  function createSection(title, parameters, task, open = true) {
    if (!parameters.length) return null;
    const details = document.createElement("details");
    details.className = "mp-section";
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);
    const grid = document.createElement("div");
    grid.className = "mp-grid";
    for (const parameter of parameters) grid.appendChild(renderField(task, parameter));
    details.appendChild(grid);
    return details;
  }

  function ensureContainer(task) {
    let container = $(`modelParams-${task}`);
    if (container) return container;
    const modelBox = $(SELECT_IDS[task])?.closest(".mm-model-box");
    if (!modelBox) return null;
    container = document.createElement("section");
    container.id = `modelParams-${task}`;
    container.className = "mp-panel";
    modelBox.insertAdjacentElement("afterend", container);
    return container;
  }

  function render(task) {
    const container = ensureContainer(task);
    if (!container) return;
    const modelId = currentModelId(task);
    const model = currentModel(task);
    const adapter = currentAdapter(task);
    const parameters = ADAPTERS.parametersFor(task, modelId);

    container.innerHTML = "";
    const head = document.createElement("div");
    head.className = "mp-head";
    const title = document.createElement("div");
    title.className = "mp-title";
    title.textContent = `${TASK_LABELS[task]}模型参数`;
    const meta = document.createElement("div");
    meta.className = "mp-meta";
    meta.textContent = `${model?.label || modelId || "自定义模型"} · Adapter: ${adapter?.id || "unknown"}`;
    head.append(title, meta);
    container.appendChild(head);

    if (!parameters.length) {
      const empty = document.createElement("div");
      empty.className = "mp-empty";
      empty.textContent = "当前 Adapter 没有额外模型参数，将使用基础输入和高级 JSON 参数。";
      container.appendChild(empty);
      hideLegacyControls();
      return;
    }

    const primary = parameters.filter((parameter) => !parameter.advanced);
    const advanced = parameters.filter((parameter) => parameter.advanced);
    const primarySection = createSection("常用参数", primary, task, true);
    const advancedSection = createSection("高级模型参数", advanced, task, false);
    if (primarySection) container.appendChild(primarySection);
    if (advancedSection) container.appendChild(advancedSection);

    hideLegacyControls();
    syncPanelFromSources(task);
  }

  function markHidden(element) {
    if (element) element.classList.add("model-legacy-hidden");
  }

  function markSourceHidden(sourceId) {
    const source = $(sourceId);
    if (!source) return;
    if (["checkbox", "radio"].includes(source.type)) markHidden(source.closest("label") || source.parentElement);
    else markHidden(source.parentElement);
  }

  function allParameterSchemas() {
    const schemas = [];
    for (const adapter of ADAPTERS.list()) {
      if (Array.isArray(adapter.parameters)) schemas.push(adapter.parameters);
      else if (adapter.parameters) {
        for (const value of Object.values(adapter.parameters)) if (Array.isArray(value)) schemas.push(value);
      }
    }
    return schemas.flat();
  }

  function cleanupLegacyLayouts() {
    for (const panelId of Object.values(PANEL_IDS)) {
      const panel = $(panelId);
      if (!panel) continue;
      for (const layout of panel.querySelectorAll(".grid2,.grid3,.row")) {
        const children = [...layout.children];
        if (children.length && children.every((child) => child.classList.contains("model-legacy-hidden"))) markHidden(layout);
      }
    }
  }

  function hideLegacyControls() {
    for (const parameter of allParameterSchemas()) {
      if (parameter.sourceId) markSourceHidden(parameter.sourceId);
      if (parameter.sourceName) {
        const sources = [...document.querySelectorAll(`input[name="${CSS.escape(parameter.sourceName)}"]`)];
        for (const source of sources) markHidden(source.closest("label") || source.parentElement);
      }
    }

    const taskTypes = $("editTaskTypes");
    if (taskTypes) {
      markHidden(taskTypes);
      const label = taskTypes.previousElementSibling;
      if (label?.classList.contains("lab")) markHidden(label);
    }

    markHidden($("btnWanApplyPreset")?.parentElement);
    markHidden($("mmI2VGenericControls"));
    markHidden($("mmT2VResolution")?.closest(".grid2"));
    cleanupLegacyLayouts();
  }

  function injectStyle() {
    if ($("modelParameterUiStyle")) return;
    const style = document.createElement("style");
    style.id = "modelParameterUiStyle";
    style.textContent = `
      .model-legacy-hidden { display:none !important; }
      .mp-panel { margin: 0 0 16px; padding: 14px; border: 1px solid rgba(128,128,128,.22); border-radius: 12px; background: rgba(128,128,128,.045); }
      .mp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
      .mp-title { font-weight:700; font-size:15px; }
      .mp-meta { font-size:12px; opacity:.72; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .mp-section { border-top:1px dashed rgba(128,128,128,.22); padding-top:8px; margin-top:8px; }
      .mp-section summary { cursor:pointer; user-select:none; font-weight:650; font-size:13px; padding:4px 0 8px; }
      .mp-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; padding:4px 0 2px; }
      .mp-field { min-width:0; }
      .mp-field-full { grid-column:1/-1; }
      .mp-label { display:block; margin-bottom:6px; font-size:13px; font-weight:600; }
      .mp-control { width:100%; }
      .mp-checks { display:flex; gap:9px 14px; flex-wrap:wrap; }
      .mp-check { display:inline-flex; align-items:center; font-size:13px; cursor:pointer; }
      .mp-check-single { min-height:38px; }
      .mp-field-help { margin-top:5px; font-size:11px; opacity:.68; line-height:1.45; }
      .mp-empty { font-size:12px; opacity:.72; padding:4px 0; }
      @media (max-width: 700px) { .mp-grid { grid-template-columns:1fr; } .mp-field-full { grid-column:auto; } }
    `;
    document.head.appendChild(style);
  }

  function bindModelChanges() {
    for (const task of Object.keys(SELECT_IDS)) {
      $(SELECT_IDS[task])?.addEventListener("change", () => setTimeout(() => render(task), 0));
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    hideLegacyControls();
    for (const task of Object.keys(SELECT_IDS)) render(task);
    bindModelChanges();
  });

  window.GiteeModelParameterUI = Object.freeze({ render, renderAll: () => Object.keys(SELECT_IDS).forEach(render), hideLegacyControls });
})();
