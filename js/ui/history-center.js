(() => {
  "use strict";

  const STORE = window.GiteeHistoryStore;
  const REGISTRY = window.GiteeModelRegistry;
  const ADAPTERS = window.GiteeModelAdapters;
  if (!STORE || !REGISTRY || !ADAPTERS) throw new Error("History store and model layers must load before history-center.js");

  const $ = (id) => document.getElementById(id);
  const FUNCTION_VALUES = { t2i: "z-image", edit: "Edit-2511", i2v: "Wan2.2-I2V-A14B", t2v: "HunyuanVideo-1.5" };
  const SELECT_IDS = { t2i: "mmT2IModel", edit: "mmEditModel", i2v: "mmI2VModel", t2v: "mmT2VModel" };
  const PROMPT_IDS = { t2i: "zPrompt", edit: "editPrompt", i2v: "wanPrompt", t2v: "hyPrompt" };
  const BUTTON_IDS = { t2i: "btnZRun", edit: "btnEditRun", i2v: "btnWanRun", t2v: "btnHyRun" };
  const PANEL_IDS = { t2i: "panelZ", edit: "panelEdit", i2v: "panelWan", t2v: "panelHunyuan" };

  let listEl;
  let emptyEl;
  let countEl;
  let searchTimer = null;
  let renderQueued = false;
  let historyDirty = true;
  let hasRendered = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);
  }

  function formatDuration(ms) {
    const sec = Math.max(0, Math.floor((ms || 0) / 1000));
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return min ? `${min}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
  }

  function formatDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function stateText(state) {
    if (state === "success") return "✅ 成功";
    if (state === "failed") return "❌ 失败";
    if (state === "cancelled") return "⏹ 已停止等待";
    return state || "未知";
  }

  function copyText(text) {
    if (!text) return Promise.resolve();
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function parameterEntries(record) {
    return Object.entries(record.parameters || {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== null && value !== undefined && value !== false;
    });
  }

  function parameterValue(value) {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? "是" : "否";
    return String(value);
  }

  function resultButtons(record) {
    const urls = [...new Set(record.resultUrls || [])].filter(Boolean);
    if (!urls.length) return "";
    return urls.slice(0, 3).map((url, index) => {
      const safe = escapeHtml(url);
      return `<a class="btn hc-link" href="${safe}" target="_blank" rel="noopener">打开结果${urls.length > 1 ? ` ${index + 1}` : ""}</a>`;
    }).join("");
  }

  function card(record) {
    const params = parameterEntries(record).slice(0, 8);
    const fileText = (record.inputFiles || []).length
      ? `<div class="hc-files">输入文件：${escapeHtml(record.inputFiles.map((item) => item.name).join("、"))}</div>`
      : "";
    const error = record.lastError ? `<div class="hc-error">${escapeHtml(record.lastError)}</div>` : "";
    const paramHtml = params.length
      ? `<div class="hc-params">${params.map(([key, value]) => `<span><strong>${escapeHtml(key)}</strong> ${escapeHtml(parameterValue(value))}</span>`).join("")}</div>`
      : `<div class="hc-muted">没有额外模型参数记录。</div>`;

    const el = document.createElement("article");
    el.className = `hc-card hc-${record.state || "unknown"}`;
    el.dataset.historyId = record.id;
    el.innerHTML = `
      <div class="hc-card-head">
        <div>
          <div class="hc-title">${escapeHtml(record.taskLabel || record.task)} · ${escapeHtml(record.modelId)}</div>
          <div class="hc-sub">${formatDate(record.finishedAt || record.startedAt)} · ${stateText(record.state)} · ${formatDuration(record.durationMs)}</div>
        </div>
        <div class="hc-mini">请求 ${record.requestCount || 0} · 轮询 ${record.pollCount || 0}</div>
      </div>
      ${record.prompt ? `<div class="hc-prompt">${escapeHtml(record.prompt)}</div>` : ""}
      ${paramHtml}
      ${fileText}
      ${record.taskId ? `<div class="hc-task-id">task_id: ${escapeHtml(record.taskId)}</div>` : ""}
      ${error}
      <div class="hc-actions">
        <button type="button" class="btn primary hc-reuse">再次生成</button>
        ${record.prompt ? `<button type="button" class="btn hc-copy-prompt">复制 Prompt</button>` : ""}
        ${record.taskId ? `<button type="button" class="btn hc-copy-task">复制 task_id</button>` : ""}
        ${resultButtons(record)}
        <button type="button" class="btn hc-delete">删除</button>
      </div>
    `;

    el.querySelector(".hc-reuse")?.addEventListener("click", () => reuse(record));
    el.querySelector(".hc-copy-prompt")?.addEventListener("click", () => copyText(record.prompt));
    el.querySelector(".hc-copy-task")?.addEventListener("click", () => copyText(record.taskId));
    el.querySelector(".hc-delete")?.addEventListener("click", async () => {
      await STORE.remove(record.id);
      await render();
    });
    return el;
  }

  function dispatch(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyParameter(task, parameter, value) {
    if (parameter.sourceId) {
      const source = $(parameter.sourceId);
      if (!source) return;
      if (parameter.type === "checkbox") source.checked = Boolean(value);
      else source.value = value == null ? "" : String(value);
      dispatch(source);
      return;
    }
    if (parameter.sourceName && Array.isArray(value)) {
      const selected = new Set(value.map(String));
      for (const input of document.querySelectorAll(`input[name="${parameter.sourceName}"]`)) {
        input.checked = selected.has(input.value);
        dispatch(input);
      }
    }
  }

  function restoreModel(record) {
    const top = $("modelSel");
    if (top && FUNCTION_VALUES[record.task]) {
      top.value = FUNCTION_VALUES[record.task];
      dispatch(top);
    }

    const select = $(SELECT_IDS[record.task]);
    if (!select) return;
    if ([...select.options].some((option) => option.value === record.modelId)) {
      select.value = record.modelId;
    } else if ([...select.options].some((option) => option.value === "__custom__")) {
      select.value = "__custom__";
      const custom = $(`mm-${record.task}-custom-id`);
      if (custom) custom.value = record.modelId;
    }
    dispatch(select);
  }

  async function restoreRecord(record) {
    restoreModel(record);
    const prompt = $(PROMPT_IDS[record.task]);
    if (prompt) prompt.value = record.prompt || "";

    const endpoint = $(`mm-${record.task}-endpoint`);
    const endpointAdvanced = $(`mm-${record.task}-endpoint-advanced`);
    if (record.endpointOverride) {
      if (endpoint) endpoint.value = record.endpointOverride;
      if (endpointAdvanced) endpointAdvanced.value = record.endpointOverride;
    }
    const extra = $(`mm-${record.task}-extra`);
    if (extra) extra.value = record.extraJson || "";

    await new Promise((resolve) => setTimeout(resolve, 40));
    const schema = ADAPTERS.parametersFor(record.task, record.modelId);
    for (const parameter of schema) {
      if (Object.prototype.hasOwnProperty.call(record.parameters || {}, parameter.key)) {
        applyParameter(record.task, parameter, record.parameters[parameter.key]);
      }
    }
    window.GiteeModelParameterUI?.render?.(record.task);
    $(PANEL_IDS[record.task])?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function reuse(record) {
    await restoreRecord(record);
    if (["edit", "i2v"].includes(record.task)) {
      const names = (record.inputFiles || []).map((item) => item.name).join("、");
      window.alert(`历史参数已载入。由于浏览器安全限制，文件不能自动恢复${names ? `（原文件：${names}）` : ""}，请重新上传图片后再点击生成。`);
      return;
    }
    const label = record.task === "t2v" ? "文生视频任务可能消耗体验额度或产生费用。" : "将使用当前 API Key 再次提交生成。";
    if (window.confirm(`历史参数已经载入。${label}\n\n是否现在重新生成？`)) {
      setTimeout(() => $(BUTTON_IDS[record.task])?.click(), 120);
    }
  }

  async function render() {
    if (!listEl) return;
    const task = $("historyTaskFilter")?.value || "all";
    const state = $("historyStateFilter")?.value || "all";
    const query = $("historySearch")?.value || "";
    const records = await STORE.list({ limit: 50, task, state, query });
    const fragment = document.createDocumentFragment();
    for (const record of records) fragment.appendChild(card(record));
    listEl.replaceChildren(fragment);
    emptyEl.style.display = records.length ? "none" : "block";
    if (countEl) countEl.textContent = `${records.length} 条`;
    historyDirty = false;
    hasRendered = true;
  }

  function historyDrawerOpen() {
    const drawer = $("studioDrawer-history");
    return Boolean(drawer?.classList.contains("is-open"));
  }

  function scheduleRender({ force = false, idle = false } = {}) {
    historyDirty = true;
    if (!force && $("studioDrawer-history") && !historyDrawerOpen()) return;
    if (renderQueued) return;
    renderQueued = true;
    const run = async () => {
      renderQueued = false;
      if (!force && $("studioDrawer-history") && !historyDrawerOpen()) return;
      await render();
    };
    if (idle && "requestIdleCallback" in window) requestIdleCallback(run, { timeout: 1200 });
    else requestAnimationFrame(run);
  }

  async function exportJson() {
    const records = await STORE.list({ limit: STORE.maxRecords });
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gitee-ai-history-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function clearAll() {
    if (!window.confirm("确定清空全部生成历史吗？此操作只删除本浏览器保存的历史记录，不会删除 Gitee 上的任务或文件。")) return;
    await STORE.clear();
    await render();
  }

  function createCenter() {
    if ($("historyCenter")) return;
    const outputCard = $("output")?.closest(".card");
    if (!outputCard?.parentElement) return;
    const taskCenter = $("taskCenter");

    const section = document.createElement("section");
    section.id = "historyCenter";
    section.className = "card hc-center";
    section.innerHTML = `
      <div class="row row-between hc-head">
        <div>
          <h2>生成历史 / History</h2>
          <div class="hint">完成后的任务会保存在当前浏览器 IndexedDB 中，最多保留 ${STORE.maxRecords} 条。不会保存 API Key，也不会把图片/视频文件本体写进浏览器数据库。</div>
        </div>
        <div class="hc-head-actions"><span id="historyCount" class="hc-count">0 条</span><button class="btn" id="btnExportHistory">导出 JSON</button><button class="btn" id="btnClearHistory">清空历史</button></div>
      </div>
      <div class="hc-filters">
        <select id="historyTaskFilter" class="input"><option value="all">全部任务</option><option value="t2i">文生图</option><option value="edit">图像编辑</option><option value="i2v">图生视频</option><option value="t2v">文生视频</option></select>
        <select id="historyStateFilter" class="input"><option value="all">全部状态</option><option value="success">成功</option><option value="failed">失败</option><option value="cancelled">已停止等待</option></select>
        <input id="historySearch" class="input" placeholder="搜索模型 / Prompt / task_id" />
      </div>
      <div id="historyEmpty" class="hc-empty">打开历史时会加载最近记录。</div>
      <div id="historyList" class="hc-list"></div>
    `;

    if (taskCenter?.parentElement === outputCard.parentElement) taskCenter.insertAdjacentElement("afterend", section);
    else outputCard.parentElement.insertBefore(section, outputCard);

    listEl = $("historyList");
    emptyEl = $("historyEmpty");
    countEl = $("historyCount");
    $("historyTaskFilter")?.addEventListener("change", () => scheduleRender({ force: true }));
    $("historyStateFilter")?.addEventListener("change", () => scheduleRender({ force: true }));
    $("historySearch")?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => scheduleRender({ force: true }), 150);
    });
    $("btnExportHistory")?.addEventListener("click", exportJson);
    $("btnClearHistory")?.addEventListener("click", clearAll);
    scheduleRender({ idle: true });
  }

  function injectStyle() {
    if ($("historyCenterStyle")) return;
    const style = document.createElement("style");
    style.id = "historyCenterStyle";
    style.textContent = `
      .hc-head { align-items:flex-start; gap:14px; }
      .hc-head h2 { margin-bottom:5px; }
      .hc-head-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .hc-count { font-size:12px; opacity:.72; }
      .hc-filters { display:grid; grid-template-columns:160px 160px minmax(220px,1fr); gap:10px; margin:14px 0; }
      .hc-list { display:grid; gap:12px; }
      .hc-empty { padding:18px; border:1px dashed rgba(128,128,128,.25); border-radius:12px; text-align:center; opacity:.7; }
      .hc-card { border:1px solid rgba(128,128,128,.22); border-radius:14px; padding:14px; background:rgba(128,128,128,.035); }
      .hc-card.hc-success { border-color:rgba(34,197,94,.28); }
      .hc-card.hc-failed { border-color:rgba(239,68,68,.34); }
      .hc-card-head { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .hc-title { font-weight:750; font-size:14px; }
      .hc-sub,.hc-mini,.hc-task-id,.hc-files,.hc-muted { font-size:11px; opacity:.68; margin-top:4px; overflow-wrap:anywhere; }
      .hc-prompt { margin-top:10px; padding:9px 10px; border-radius:9px; background:rgba(128,128,128,.07); font-size:12px; line-height:1.55; white-space:pre-wrap; }
      .hc-params { display:flex; gap:7px; flex-wrap:wrap; margin-top:9px; }
      .hc-params span { font-size:11px; padding:5px 8px; border-radius:999px; background:rgba(59,130,246,.08); border:1px solid rgba(59,130,246,.12); }
      .hc-params strong { margin-right:3px; }
      .hc-error { margin-top:9px; padding:8px 10px; border-radius:9px; background:rgba(239,68,68,.08); font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
      .hc-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:11px; }
      .hc-link { text-decoration:none; display:inline-flex; align-items:center; }
      @media (max-width:760px) { .hc-filters { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  STORE.subscribe(() => {
    historyDirty = true;
    if (historyDrawerOpen()) scheduleRender({ force: true });
  });
  window.addEventListener("gitee-studio-drawer-open", (event) => {
    if (event.detail?.name === "history" && (historyDirty || !hasRendered)) scheduleRender({ force: true });
  });
  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    createCenter();
  });

  window.GiteeHistoryCenter = Object.freeze({ render, restoreRecord });
})();
