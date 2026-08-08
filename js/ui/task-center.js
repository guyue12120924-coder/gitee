(() => {
  "use strict";

  const TRACKER = window.GiteeTaskTracker;
  if (!TRACKER) throw new Error("GiteeTaskTracker must load before task-center.js");

  const $ = (id) => document.getElementById(id);
  const BUTTON_IDS = { t2i: "btnZRun", edit: "btnEditRun", i2v: "btnWanRun", t2v: "btnHyRun" };
  const STAGE_PROGRESS = {
    preparing: 8,
    submitting: 24,
    retrying: 30,
    created: 42,
    polling: 58,
    "server-success": 78,
    response: 78,
    downloading: 90,
    success: 100,
    failed: 100,
    cancelled: 100,
    cancelling: 65,
    "server-failed": 90,
  };

  let center;
  let listEl;
  let emptyEl;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);
  }

  function formatDuration(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return min ? `${min}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
  }

  function timeText(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function stateIcon(run) {
    if (run.state === "success") return "✅";
    if (run.state === "failed") return "❌";
    if (run.state === "cancelled") return "⏹";
    if (["polling", "created", "server-success", "downloading"].includes(run.stage)) return "⏳";
    if (run.stage === "retrying") return "↻";
    return "●";
  }

  function stateClass(run) {
    if (run.state === "success") return "tc-success";
    if (run.state === "failed") return "tc-failed";
    if (run.state === "cancelled") return "tc-cancelled";
    return "tc-running";
  }

  function progress(run) {
    return STAGE_PROGRESS[run.stage] ?? (run.state === "success" ? 100 : run.state === "failed" ? 100 : 15);
  }

  function friendlyError(run) {
    const rawText = (() => {
      try { return JSON.stringify(run.lastRaw || {}); } catch { return ""; }
    })();
    const text = `${run.lastError || ""} ${rawText}`.toLowerCase();
    if (!text.trim()) return "没有拿到明确错误详情，请展开原始响应查看最后一次请求。";
    if (/401|unauthorized|invalid token|api key|authentication/.test(text)) return "API Key 无效或认证失败。请检查 Token 是否正确、是否过期。";
    if (/403|forbidden|permission|无权限/.test(text)) return "当前 Token 没有调用该模型或接口的权限。";
    if (/429|rate limit|too many|quota|余额|额度|balance/.test(text)) return "可能触发频率限制、体验额度或账户额度限制。稍后重试并检查 Gitee 账户状态。";
    if (/duration|时长/.test(text)) return "视频时长参数不符合当前模型要求。页面已做范围校正；若仍失败，请查看原始响应中的精确范围。";
    if (/size|resolution|width|height|分辨率|尺寸/.test(text)) return "尺寸或分辨率参数与模型要求不兼容。建议先使用推荐分辨率再试。";
    if (/image|first_frame|image_url|图片|图像/.test(text)) return "输入图片字段、格式或图片内容可能不符合接口要求。";
    if (/404|405|endpoint|method|not found/.test(text)) return "当前 Endpoint 或请求方式可能与这个模型不匹配。";
    if (/400|422|parameter|invalid|unsupported|field|参数/.test(text)) return "模型拒绝了某个请求参数。展开“请求尝试”可查看哪个 Endpoint/格式失败。";
    if (/timeout|超时/.test(text)) return "本地等待超时。远端任务不一定失败，可以保留 task_id 稍后查询。";
    return run.lastError || "生成失败，请查看原始响应和请求尝试。";
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function rawText(run) {
    const payload = {
      task: run.task,
      model: run.modelId,
      task_id: run.taskId,
      endpoint: run.endpoint,
      stage: run.stage,
      error: run.lastError,
      raw: run.lastRaw,
      attempts: run.attempts,
    };
    try { return JSON.stringify(payload, null, 2); }
    catch { return String(run.lastError || ""); }
  }

  function timelineHtml(run) {
    const rows = run.timeline.slice(-8).map((item) => {
      const elapsed = formatDuration(item.at - run.startedAt);
      return `<div class="tc-timeline-row"><span class="tc-dot"></span><span class="tc-time">+${elapsed}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.message || "")}</span></div>`;
    });
    return rows.join("");
  }

  function attemptsHtml(run) {
    if (!run.attempts.length) return `<div class="tc-muted">尚无兼容请求尝试记录。</div>`;
    return run.attempts.map((attempt, index) => {
      const statusClass = attempt.ok ? "tc-attempt-ok" : "tc-attempt-bad";
      return `<div class="tc-attempt ${statusClass}"><span>#${index + 1}</span><strong>${escapeHtml(attempt.endpoint)}</strong><span>${escapeHtml(attempt.strategy)}</span><span>HTTP ${attempt.status}</span><span>${attempt.elapsedMs}ms</span>${attempt.message ? `<span class="tc-attempt-message">${escapeHtml(attempt.message)}</span>` : ""}</div>`;
    }).join("");
  }

  function card(run) {
    const elapsed = (run.finishedAt || Date.now()) - run.startedAt;
    const pct = progress(run);
    const isActive = !run.finishedAt;
    const canStop = isActive && Boolean(run.taskId) && !run.cancelRequested;
    const canRetry = ["failed", "cancelled"].includes(run.state);
    const errorBox = run.state === "failed" ? `<div class="tc-error"><strong>可能原因</strong><span>${escapeHtml(friendlyError(run))}</span></div>` : "";
    const prompt = run.prompt ? `<div class="tc-prompt" title="${escapeHtml(run.prompt)}">Prompt：${escapeHtml(run.prompt.slice(0, 140))}${run.prompt.length > 140 ? "…" : ""}</div>` : "";

    const el = document.createElement("article");
    el.className = `tc-card ${stateClass(run)}`;
    el.dataset.runId = run.id;
    el.innerHTML = `
      <div class="tc-card-head">
        <div class="tc-title-wrap">
          <span class="tc-state-icon">${stateIcon(run)}</span>
          <div><div class="tc-title">${escapeHtml(run.taskLabel)} · ${escapeHtml(run.modelId)}</div><div class="tc-sub">开始 ${timeText(run.startedAt)} · 已耗时 <span data-elapsed>${formatDuration(elapsed)}</span></div></div>
        </div>
        <div class="tc-stage">${escapeHtml(run.stageLabel)}</div>
      </div>
      <div class="tc-progress"><div style="width:${pct}%"></div></div>
      <div class="tc-message">${escapeHtml(run.message || "")}</div>
      ${prompt}
      <div class="tc-meta-grid">
        <span>请求 ${run.requestCount || 0} 次</span>
        <span>轮询 ${run.pollCount || 0} 次</span>
        <span>Endpoint：${escapeHtml(run.endpoint || "等待提交")}</span>
        <span>task_id：${escapeHtml(run.taskId || "尚未创建")}</span>
      </div>
      ${errorBox}
      <div class="tc-actions">
        ${canStop ? `<button type="button" class="btn tc-stop">停止本地等待</button>` : ""}
        ${canRetry ? `<button type="button" class="btn primary tc-retry">重新生成</button>` : ""}
        ${run.taskId ? `<button type="button" class="btn tc-copy-task">复制 task_id</button>` : ""}
        ${run.state === "failed" ? `<button type="button" class="btn tc-copy-error">复制错误</button>` : ""}
      </div>
      <details class="tc-details"><summary>进度时间线</summary><div class="tc-timeline">${timelineHtml(run)}</div></details>
      <details class="tc-details"><summary>请求尝试 (${run.attempts.length})</summary><div class="tc-attempts">${attemptsHtml(run)}</div></details>
      <details class="tc-details"><summary>原始响应 / 调试信息</summary><pre>${escapeHtml(rawText(run))}</pre></details>
    `;

    el.querySelector(".tc-stop")?.addEventListener("click", () => TRACKER.requestCancel(run.id));
    el.querySelector(".tc-retry")?.addEventListener("click", () => {
      const button = $(BUTTON_IDS[run.task]);
      button?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => button?.click(), 250);
    });
    el.querySelector(".tc-copy-task")?.addEventListener("click", () => copyText(run.taskId));
    el.querySelector(".tc-copy-error")?.addEventListener("click", () => copyText(rawText(run)));
    return el;
  }

  function render() {
    if (!listEl) return;
    const runs = TRACKER.list().slice(0, 10);
    listEl.innerHTML = "";
    emptyEl.style.display = runs.length ? "none" : "block";
    for (const run of runs) listEl.appendChild(card(run));
  }

  function clearFinished() {
    // Tracker intentionally keeps run state in memory. The UI can hide completed
    // cards without mutating the tracker by marking their DOM ids for this page.
    const ids = TRACKER.list().filter((run) => run.finishedAt).map((run) => run.id);
    try { sessionStorage.setItem("moark_task_center_hidden", JSON.stringify(ids)); } catch {}
    renderFiltered();
  }

  function hiddenIds() {
    try { return new Set(JSON.parse(sessionStorage.getItem("moark_task_center_hidden") || "[]")); }
    catch { return new Set(); }
  }

  function renderFiltered() {
    if (!listEl) return;
    const hidden = hiddenIds();
    const runs = TRACKER.list().filter((run) => !hidden.has(run.id)).slice(0, 10);
    listEl.innerHTML = "";
    emptyEl.style.display = runs.length ? "none" : "block";
    for (const run of runs) listEl.appendChild(card(run));
  }

  function createCenter() {
    if ($("taskCenter")) return;
    const outputCard = $("output")?.closest(".card");
    if (!outputCard?.parentElement) return;

    center = document.createElement("section");
    center.id = "taskCenter";
    center.className = "card tc-center";
    center.innerHTML = `
      <div class="row row-between tc-center-head">
        <div><h2>生成任务 / Generation Tasks</h2><div class="hint">显示请求提交、任务创建、排队/生成、下载和失败原因。停止等待只停止本网页轮询，不会取消已提交到 Gitee 的远端任务。</div></div>
        <button type="button" class="btn" id="btnClearFinishedTasks">清除已完成</button>
      </div>
      <div id="taskCenterEmpty" class="tc-empty">还没有生成任务。点击任意“执行 / Generate”后，这里会显示实时进度。</div>
      <div id="taskCenterList" class="tc-list"></div>
    `;
    outputCard.parentElement.insertBefore(center, outputCard);
    listEl = $("taskCenterList");
    emptyEl = $("taskCenterEmpty");
    $("btnClearFinishedTasks")?.addEventListener("click", clearFinished);
    renderFiltered();
  }

  function injectStyle() {
    if ($("taskCenterStyle")) return;
    const style = document.createElement("style");
    style.id = "taskCenterStyle";
    style.textContent = `
      .tc-center-head { align-items:flex-start; }
      .tc-center-head h2 { margin-bottom:5px; }
      .tc-empty { padding:18px; border:1px dashed rgba(128,128,128,.25); border-radius:12px; text-align:center; opacity:.7; }
      .tc-list { display:grid; gap:12px; }
      .tc-card { border:1px solid rgba(128,128,128,.22); border-radius:14px; padding:14px; background:rgba(128,128,128,.035); }
      .tc-card.tc-success { border-color:rgba(34,197,94,.30); }
      .tc-card.tc-failed { border-color:rgba(239,68,68,.38); background:rgba(239,68,68,.035); }
      .tc-card.tc-cancelled { border-color:rgba(148,163,184,.35); }
      .tc-card-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; }
      .tc-title-wrap { display:flex; gap:10px; align-items:flex-start; min-width:0; }
      .tc-state-icon { font-size:18px; line-height:1.2; }
      .tc-title { font-weight:750; font-size:14px; overflow-wrap:anywhere; }
      .tc-sub { margin-top:3px; font-size:11px; opacity:.68; }
      .tc-stage { font-size:12px; font-weight:700; padding:5px 9px; border-radius:999px; background:rgba(59,130,246,.10); }
      .tc-progress { height:7px; border-radius:999px; overflow:hidden; background:rgba(128,128,128,.13); margin:12px 0 9px; }
      .tc-progress > div { height:100%; border-radius:inherit; background:linear-gradient(90deg, currentColor, rgba(59,130,246,.7)); transition:width .3s ease; }
      .tc-running .tc-progress > div { animation:tc-pulse 1.5s ease-in-out infinite; }
      .tc-success .tc-progress > div { color:rgb(34,197,94); }
      .tc-failed .tc-progress > div { color:rgb(239,68,68); }
      .tc-message { font-size:13px; line-height:1.55; }
      .tc-prompt { margin-top:7px; font-size:11px; opacity:.72; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .tc-meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px 14px; margin-top:10px; font-size:11px; opacity:.72; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .tc-meta-grid span { overflow-wrap:anywhere; }
      .tc-error { display:flex; gap:8px 12px; align-items:flex-start; margin-top:11px; padding:10px 11px; border-radius:10px; background:rgba(239,68,68,.08); font-size:12px; line-height:1.5; }
      .tc-error strong { white-space:nowrap; }
      .tc-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:11px; }
      .tc-details { margin-top:9px; border-top:1px dashed rgba(128,128,128,.20); padding-top:7px; }
      .tc-details summary { cursor:pointer; font-size:12px; font-weight:650; user-select:none; }
      .tc-details pre { max-height:260px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; font-size:11px; margin:8px 0 0; padding:10px; border-radius:9px; background:rgba(0,0,0,.08); }
      .tc-timeline { display:grid; gap:6px; margin-top:8px; }
      .tc-timeline-row { display:grid; grid-template-columns:10px 48px minmax(90px,auto) 1fr; gap:7px; align-items:start; font-size:11px; line-height:1.45; }
      .tc-dot { width:7px; height:7px; border-radius:50%; background:currentColor; opacity:.45; margin-top:4px; }
      .tc-time { opacity:.6; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
      .tc-attempts { display:grid; gap:6px; margin-top:8px; }
      .tc-attempt { display:grid; grid-template-columns:28px minmax(120px,1fr) 70px 70px 60px; gap:7px; align-items:start; padding:7px 8px; border-radius:8px; font-size:10px; background:rgba(128,128,128,.06); }
      .tc-attempt-ok { box-shadow:inset 3px 0 rgba(34,197,94,.55); }
      .tc-attempt-bad { box-shadow:inset 3px 0 rgba(239,68,68,.55); }
      .tc-attempt-message { grid-column:2/-1; opacity:.72; overflow-wrap:anywhere; }
      .tc-muted { margin-top:8px; font-size:11px; opacity:.62; }
      @keyframes tc-pulse { 0%,100%{opacity:.65} 50%{opacity:1} }
      @media (max-width:700px) {
        .tc-meta-grid { grid-template-columns:1fr; }
        .tc-timeline-row { grid-template-columns:10px 45px 1fr; }
        .tc-timeline-row span:last-child { grid-column:3; }
        .tc-attempt { grid-template-columns:28px 1fr 65px; }
        .tc-attempt > span:nth-child(4), .tc-attempt > span:nth-child(5) { grid-row:2; }
        .tc-attempt-message { grid-column:2/-1; }
      }
    `;
    document.head.appendChild(style);
  }

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    createCenter();
    TRACKER.subscribe(() => renderFiltered());
    setInterval(() => {
      for (const run of TRACKER.list()) {
        if (!run.finishedAt) {
          const node = document.querySelector(`[data-run-id="${CSS.escape(run.id)}"] [data-elapsed]`);
          if (node) node.textContent = formatDuration(Date.now() - run.startedAt);
        }
      }
    }, 1000);
  });
})();
