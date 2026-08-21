(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ADAPTERS = window.GiteeModelAdapters;
  if (!ADAPTERS) return;

  const SELECT_BY_TASK = {
    t2i: "mmT2IModel",
    edit: "mmEditModel",
    i2v: "mmI2VModel",
    t2v: "mmT2VModel",
  };
  const PANEL_BY_TASK = {
    t2i: "modelParams-t2i",
    edit: "modelParams-edit",
    i2v: "modelParams-i2v",
    t2v: "modelParams-t2v",
  };
  const MODEL_SELECT_IDS = new Set([...Object.values(SELECT_BY_TASK), "modelSel"]);
  const SIMPLE = "simple";
  let syncTimer = 0;

  function dispatchValue(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function modelId(task) {
    return $(SELECT_BY_TASK[task])?.value || "";
  }

  function parameters(task) {
    try { return ADAPTERS.parametersFor(task, modelId(task)) || []; }
    catch { return []; }
  }

  function adapter(task) {
    try { return ADAPTERS.forModel(task, modelId(task)); }
    catch { return null; }
  }

  function sourceFor(parameter) {
    return parameter?.sourceId ? $(parameter.sourceId) : null;
  }

  function renderedFor(task, parameter) {
    return parameter?.key ? $(`mp-${task}-${parameter.key}`) : null;
  }

  function currentValue(parameter) {
    const source = sourceFor(parameter);
    if (!source) return parameter?.default;
    if (source.type === "checkbox") return Boolean(source.checked);
    return source.value;
  }

  function setParameter(task, parameter, value) {
    const source = sourceFor(parameter);
    if (!source) return;
    if (source.type === "checkbox") source.checked = Boolean(value);
    else source.value = String(value);
    dispatchValue(source);

    const rendered = renderedFor(task, parameter);
    if (rendered && rendered !== source) {
      if (rendered.type === "checkbox") rendered.checked = Boolean(value);
      else rendered.value = String(value);
    }
  }

  function syncRenderedFromSources(task) {
    for (const parameter of parameters(task)) {
      const source = sourceFor(parameter);
      const rendered = renderedFor(task, parameter);
      if (!source || !rendered || source === rendered) continue;
      if (rendered.type === "checkbox") rendered.checked = Boolean(source.checked);
      else rendered.value = source.value;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function numberRule(parameter, fallback = 1) {
    const min = Number.isFinite(Number(parameter?.min)) ? Number(parameter.min) : fallback;
    const max = Number.isFinite(Number(parameter?.max)) ? Number(parameter.max) : Math.max(min, fallback * 4);
    const rawDefault = Number(parameter?.default);
    const current = Number(currentValue(parameter));
    const base = Number.isFinite(rawDefault) ? rawDefault : Number.isFinite(current) ? current : fallback;
    return { min, max, base: clamp(base, min, max) };
  }

  function qualityFromSteps(parameter) {
    const { min, max, base } = numberRule(parameter, 4);
    let fast;
    let standard;
    let high;

    if (base >= max) {
      high = max;
      standard = clamp(Math.round(max * 0.8), min, max);
      fast = clamp(Math.round(max * 0.58), min, max);
    } else {
      fast = clamp(Math.round(base * 0.67), min, max);
      standard = clamp(Math.round(base), min, max);
      high = clamp(Math.round(base * 1.5), min, max);
    }

    const candidates = [
      { key: "fast", label: "快速", sub: "更快出结果", value: fast },
      { key: "standard", label: "标准", sub: "推荐", value: standard },
      { key: "high", label: "高质量", sub: "更多计算", value: high },
    ];
    const seen = new Set();
    return candidates.filter((item) => {
      const key = String(item.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function resolutionScore(value) {
    const text = String(value || "");
    const p = text.match(/(\d{3,4})\s*p/i);
    if (p) return Number(p[1]) ** 2;
    const size = text.match(/(\d{3,4})\s*[x*]\s*(\d{3,4})/i);
    if (size) return Number(size[1]) * Number(size[2]);
    const n = text.match(/(\d{3,4})/);
    return n ? Number(n[1]) ** 2 : 0;
  }

  function resolutionOptions(parameter) {
    const source = sourceFor(parameter);
    const values = source?.tagName === "SELECT"
      ? [...source.options].map((option) => ({ value: option.value, text: option.textContent || option.value }))
      : Array.isArray(parameter?.options)
        ? parameter.options.map((option) => {
            if (typeof option === "object") return { value: String(option.value ?? option.id ?? option.label ?? ""), text: String(option.label ?? option.value ?? option.id ?? "") };
            return { value: String(option), text: String(option) };
          })
        : [];

    const usable = values
      .map((item) => ({ ...item, score: resolutionScore(item.value || item.text) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => a.score - b.score);

    const unique = [];
    const seen = new Set();
    for (const item of usable) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      unique.push(item);
    }
    if (unique.length < 2) return [];

    if (unique.length === 2) {
      return [
        { key: "fast", label: "快速", sub: unique[0].text, value: unique[0].value },
        { key: "high", label: "高质量", sub: unique[1].text, value: unique[1].value },
      ];
    }

    const middle = unique[Math.floor((unique.length - 1) / 2)];
    return [
      { key: "fast", label: "快速", sub: unique[0].text, value: unique[0].value },
      { key: "standard", label: "标准", sub: middle.text, value: middle.value },
      { key: "high", label: "高质量", sub: unique[unique.length - 1].text, value: unique[unique.length - 1].value },
    ];
  }

  function durationOptions(parameter) {
    const { min, max, base } = numberRule(parameter, 5);
    const preferred = [5, 10, 15].filter((value) => value >= min && value <= max);
    const values = [...preferred];

    if (!values.some((value) => Math.abs(value - base) < 0.001)) values.push(base);
    if (values.length < 2 && min !== max) {
      values.push(min, Math.min(max, Math.max(min, 10)), max);
    }

    const unique = [...new Set(values.map((value) => Number(Number(value).toFixed(2))))]
      .filter((value) => value >= min && value <= max)
      .sort((a, b) => a - b);

    let selected = unique;
    if (unique.length > 3) {
      const defaultIndex = unique.reduce((best, value, index) =>
        Math.abs(value - base) < Math.abs(unique[best] - base) ? index : best, 0);
      const picks = new Set([defaultIndex, Math.min(unique.length - 1, defaultIndex + 1), Math.min(unique.length - 1, defaultIndex + 2)]);
      if (picks.size < 3) picks.add(Math.max(0, defaultIndex - 1));
      selected = [...picks].sort((a, b) => a - b).map((index) => unique[index]).slice(0, 3);
    }

    if (selected.length < 2) return [];
    return selected.map((value) => ({
      key: `duration-${value}`,
      label: `${value} 秒`,
      sub: Math.abs(value - base) < 0.001 ? "推荐" : value > base ? "更长" : "更快",
      value,
    }));
  }

  function wanStyleOptions(parameter) {
    const source = sourceFor(parameter);
    if (!source || source.tagName !== "SELECT") return [];
    return [...source.options].map((option, index) => {
      const text = `${option.textContent || ""} ${option.value || ""}`;
      let label = option.textContent?.split("/")?.[0]?.trim() || option.value;
      let sub = "";
      if (/standard|标准/i.test(text)) { label = "标准"; sub = "自然均衡"; }
      else if (/sharper|清晰/i.test(text)) { label = "更清晰"; sub = "细节优先"; }
      else if (/motion|动感/i.test(text)) { label = "更动感"; sub = "动作更明显"; }
      else if (/fast|更快/i.test(text)) { label = "更快"; sub = "速度优先"; }
      return { key: `style-${index}`, label, sub, value: option.value };
    });
  }

  function createChoiceGroup({ title, help, choices, current, onChoose }) {
    if (!choices?.length) return null;
    const section = document.createElement("section");
    section.className = "simple-preset-group";

    const head = document.createElement("div");
    head.className = "simple-preset-head";
    const titleEl = document.createElement("strong");
    titleEl.textContent = title;
    const helpEl = document.createElement("span");
    helpEl.textContent = help || "";
    head.append(titleEl, helpEl);

    const grid = document.createElement("div");
    grid.className = "simple-preset-options";
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "simple-preset-option";
      button.dataset.value = String(choice.value);
      const active = String(current ?? "") === String(choice.value);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");

      const label = document.createElement("strong");
      label.textContent = choice.label;
      const sub = document.createElement("span");
      sub.textContent = choice.sub || "";
      button.append(label, sub);
      button.addEventListener("click", () => onChoose(choice));
      grid.appendChild(button);
    }

    section.append(head, grid);
    return section;
  }

  function markReplacedField(task, parameter) {
    const field = renderedFor(task, parameter)?.closest(".mp-field");
    field?.classList.add("simple-preset-replaced");
  }

  function clearReplaced(task) {
    const panel = $(PANEL_BY_TASK[task]);
    for (const field of panel?.querySelectorAll?.(".simple-preset-replaced") || []) {
      field.classList.remove("simple-preset-replaced");
    }
  }

  function insertPresetPanel(task, groups) {
    const panel = $(PANEL_BY_TASK[task]);
    if (!panel) return;

    let root = $(`simplePresetPanel-${task}`);
    if (!groups.length) {
      root?.remove();
      return;
    }

    if (!root) {
      root = document.createElement("section");
      root.id = `simplePresetPanel-${task}`;
      root.className = "simple-preset-panel";
    }
    root.replaceChildren();

    const intro = document.createElement("div");
    intro.className = "simple-preset-intro";
    intro.innerHTML = `<div><span>推荐设置</span><strong>不用理解技术参数，也能快速调到合适效果</strong></div><span class="simple-preset-badge">简洁模式</span>`;
    root.appendChild(intro);
    groups.forEach((group) => root.appendChild(group));

    const primaryGrid = panel.querySelector(".studio-primary-params > .mp-grid");
    if (primaryGrid) primaryGrid.prepend(root);
    else {
      const firstSection = panel.querySelector(".mp-section");
      if (firstSection) firstSection.insertAdjacentElement("beforebegin", root);
      else panel.appendChild(root);
    }
  }

  function buildTask(task) {
    const panel = $(PANEL_BY_TASK[task]);
    if (!panel) return;
    clearReplaced(task);

    const params = parameters(task);
    const currentAdapter = adapter(task);
    const groups = [];

    const steps = params.find((parameter) => parameter.key === "steps" && sourceFor(parameter));
    if (steps) {
      const choices = qualityFromSteps(steps);
      const group = createChoiceGroup({
        title: task === "edit" ? "编辑质量" : "生成质量",
        help: "自动调整模型计算量",
        choices,
        current: currentValue(steps),
        onChoose: (choice) => {
          setParameter(task, steps, choice.value);
          scheduleSync(0);
        },
      });
      if (group) groups.push(group);
    } else if ((task === "i2v" || task === "t2v")) {
      const resolution = params.find((parameter) => parameter.key === "resolution" && sourceFor(parameter));
      const choices = resolution ? resolutionOptions(resolution) : [];
      if (resolution && choices.length) {
        const group = createChoiceGroup({
          title: "生成质量",
          help: "按模型支持的真实清晰度切换",
          choices,
          current: currentValue(resolution),
          onChoose: (choice) => {
            setParameter(task, resolution, choice.value);
            scheduleSync(0);
          },
        });
        if (group) {
          groups.push(group);
          markReplacedField(task, resolution);
        }
      }
    }

    const preset = params.find((parameter) => parameter.key === "preset" && sourceFor(parameter));
    if (currentAdapter?.id === "wan-i2v" && preset) {
      const choices = wanStyleOptions(preset);
      const group = createChoiceGroup({
        title: "动作与风格",
        help: "直接使用模型原生预设",
        choices,
        current: currentValue(preset),
        onChoose: (choice) => {
          setParameter(task, preset, choice.value);
          if (preset.triggerClickId) $(preset.triggerClickId)?.click();
          window.setTimeout(() => {
            syncRenderedFromSources(task);
            scheduleSync(0);
          }, 40);
        },
      });
      if (group) {
        groups.push(group);
        markReplacedField(task, preset);
      }
    }

    const duration = params.find((parameter) => parameter.key === "duration" && sourceFor(parameter));
    if (duration) {
      const choices = durationOptions(duration);
      const group = createChoiceGroup({
        title: "视频时长",
        help: "常用时长一键选择",
        choices,
        current: currentValue(duration),
        onChoose: (choice) => {
          setParameter(task, duration, choice.value);
          scheduleSync(0);
        },
      });
      if (group) {
        groups.push(group);
        markReplacedField(task, duration);
      }
    }

    insertPresetPanel(task, groups);
  }

  function buildAll() {
    for (const task of Object.keys(SELECT_BY_TASK)) buildTask(task);
    if (window.GiteeExperienceMode?.isPro?.()) {
      for (const task of Object.keys(SELECT_BY_TASK)) syncRenderedFromSources(task);
    }
  }

  function scheduleSync(delay = 0) {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(buildAll, delay);
  }

  function setupEvents() {
    document.addEventListener("change", (event) => {
      const id = event.target?.id || "";
      if (MODEL_SELECT_IDS.has(id)) {
        scheduleSync(0);
        window.setTimeout(() => scheduleSync(0), 90);
        return;
      }
      if (/^(wanPreset|wanDuration|mmI2VDuration|mmT2VDuration|wanSteps|editSteps|hySteps|mmI2VResolution|mmT2VResolution)$/.test(id)) {
        scheduleSync(20);
      }
    });

    document.addEventListener("input", (event) => {
      const id = event.target?.id || "";
      if (/^(wanDuration|mmI2VDuration|mmT2VDuration|wanSteps|editSteps|hySteps)$/.test(id)) scheduleSync(40);
    });

    window.addEventListener("gitee-experience-mode-change", (event) => {
      if (event.detail?.mode !== SIMPLE) {
        for (const task of Object.keys(SELECT_BY_TASK)) syncRenderedFromSources(task);
      }
      scheduleSync(0);
    });
  }

  function injectStyles() {
    if ($("simplePresetStyles")) return;
    const style = document.createElement("style");
    style.id = "simplePresetStyles";
    style.textContent = `
      .simple-preset-panel{grid-column:1/-1;display:grid;gap:13px;margin:0 0 2px;padding:12px;border:1px solid color-mix(in srgb,var(--accent) 18%,var(--border-light));border-radius:13px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 5%,var(--card)),var(--studio-soft))}
      .simple-preset-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:2px}
      .simple-preset-intro>div{display:grid;gap:2px;min-width:0}.simple-preset-intro>div>span{color:var(--accent);font-size:9px;font-weight:800;letter-spacing:.08em}.simple-preset-intro>div>strong{color:var(--text);font-size:11px;line-height:1.4}
      .simple-preset-badge{flex:0 0 auto;padding:4px 7px;border-radius:999px;background:rgba(99,102,241,.10);color:var(--accent);font-size:8.5px;font-weight:750}
      .simple-preset-group{display:grid;gap:7px}.simple-preset-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.simple-preset-head>strong{font-size:11px;color:var(--text)}.simple-preset-head>span{font-size:9px;color:var(--muted);text-align:right}
      .simple-preset-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:6px}
      .simple-preset-option{min-height:48px;display:grid;place-items:center;align-content:center;gap:2px;padding:6px;border:1px solid var(--border-light);border-radius:10px;background:var(--input-bg);color:var(--muted);cursor:pointer;transition:border-color .14s ease,background .14s ease,color .14s ease,transform .14s ease}
      .simple-preset-option:hover{border-color:rgba(99,102,241,.28);color:var(--text);transform:translateY(-1px)}.simple-preset-option.is-active{border-color:rgba(99,102,241,.46);background:rgba(99,102,241,.10);color:var(--accent)}
      .simple-preset-option>strong{font-size:10.5px}.simple-preset-option>span{font-size:8.5px;line-height:1.25}
      html[data-experience-mode="pro"] .simple-preset-panel{display:none!important}
      html[data-experience-mode="simple"] .simple-preset-replaced{display:none!important}
      @media(max-width:560px){.simple-preset-panel{padding:10px;gap:11px}.simple-preset-options{grid-template-columns:repeat(2,minmax(0,1fr))}.simple-preset-head{display:grid;gap:2px}.simple-preset-head>span{text-align:left}}
      @media(prefers-reduced-motion:reduce){.simple-preset-option{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    setupEvents();
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(buildAll)));
    window.setTimeout(() => scheduleSync(0), 160);
  }

  window.GiteeSimplePresets = Object.freeze({
    sync: () => scheduleSync(0),
    rebuild: buildAll,
  });

  window.addEventListener("DOMContentLoaded", init);
})();