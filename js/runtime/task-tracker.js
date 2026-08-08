(() => {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const listeners = new Set();
  const runs = new Map();
  const activeByTask = new Map();
  const taskIdToRun = new Map();
  const BUTTON_TASKS = {
    btnZRun: "t2i",
    btnEditRun: "edit",
    btnWanRun: "i2v",
    btnHyRun: "t2v",
  };
  const SELECT_IDS = {
    t2i: "mmT2IModel",
    edit: "mmEditModel",
    i2v: "mmI2VModel",
    t2v: "mmT2VModel",
  };
  const PROMPT_IDS = {
    t2i: "zPrompt",
    edit: "editPrompt",
    i2v: "wanPrompt",
    t2v: "hyPrompt",
  };

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();

  function id() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function compactValue(value, depth = 0) {
    if (depth > 5) return "[depth truncated]";
    if (typeof value === "string") {
      if (/^data:[^;]+;base64,/i.test(value)) return `[base64 data omitted · ${value.length} chars]`;
      if (value.length > 4000) return `${value.slice(0, 4000)}… [truncated ${value.length - 4000} chars]`;
      return value;
    }
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactValue(item, depth + 1));
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        if (/^(b64_json|base64|image_base64|video_base64)$/i.test(key) && typeof item === "string") {
          out[key] = `[base64 omitted · ${item.length} chars]`;
        } else {
          out[key] = compactValue(item, depth + 1);
        }
      }
      return out;
    }
    return value;
  }

  function snapshot(run) {
    return {
      ...run,
      lastRaw: compactValue(run.lastRaw),
      resultUrls: [...(run.resultUrls || [])],
      timeline: run.timeline.map((item) => ({ ...item })),
      attempts: run.attempts.map((item) => ({ ...item })),
    };
  }

  function emit(type, run, detail = {}) {
    const payload = { type, run: snapshot(run), detail };
    for (const listener of listeners) {
      try { listener(payload); } catch (error) { console.warn("task tracker listener failed", error); }
    }
    window.dispatchEvent(new CustomEvent("gitee-task-progress", { detail: payload }));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function modelIdForTask(task) {
    const value = $(SELECT_IDS[task])?.value || "";
    if (value !== "__custom__") return value;
    return $(`mm-${task}-custom-id`)?.value?.trim() || "custom";
  }

  function taskLabel(task) {
    return ({ t2i: "文生图", edit: "图像编辑", i2v: "图生视频", t2v: "文生视频" })[task] || task;
  }

  function start(task) {
    const run = {
      id: id(),
      task,
      taskLabel: taskLabel(task),
      modelId: modelIdForTask(task),
      prompt: $(PROMPT_IDS[task])?.value?.trim() || "",
      state: "running",
      stage: "preparing",
      stageLabel: "准备参数",
      message: "正在整理模型参数和输入内容",
      startedAt: now(),
      updatedAt: now(),
      finishedAt: null,
      taskId: null,
      endpoint: null,
      strategy: null,
      pollCount: 0,
      requestCount: 0,
      cancelRequested: false,
      lastError: null,
      lastRaw: null,
      resultUrls: [],
      attempts: [],
      timeline: [],
    };
    runs.set(run.id, run);
    activeByTask.set(task, run.id);
    addTimeline(run, "preparing", "准备参数", run.message);
    emit("start", run);
    return run;
  }

  function addTimeline(run, stage, label, message = "", extra = {}) {
    const entry = { at: now(), stage, label, message, ...extra };
    run.timeline.push(entry);
    if (run.timeline.length > 30) run.timeline.splice(0, run.timeline.length - 30);
    return entry;
  }

  function update(run, stage, label, message = "", extra = {}) {
    if (!run || run.finishedAt) return;
    run.stage = stage;
    run.stageLabel = label;
    run.message = message;
    run.updatedAt = now();
    const safeExtra = { ...extra };
    if ("lastRaw" in safeExtra) safeExtra.lastRaw = compactValue(safeExtra.lastRaw);
    Object.assign(run, safeExtra);
    addTimeline(run, stage, label, message, safeExtra.timelineExtra || {});
    emit("update", run, safeExtra);
  }

  function finish(run, state, message = "") {
    if (!run || run.finishedAt) return;
    run.state = state;
    run.stage = state;
    run.stageLabel = state === "success" ? "生成完成" : state === "cancelled" ? "已停止等待" : "生成失败";
    run.message = message || run.stageLabel;
    run.updatedAt = run.finishedAt = now();
    addTimeline(run, run.stage, run.stageLabel, run.message);
    emit("finish", run);
  }

  function fail(run, error, raw = null) {
    if (!run || run.finishedAt) return;
    const message = String(error?.message || error || "生成失败");
    run.lastError = message;
    if (raw !== null && raw !== undefined) run.lastRaw = compactValue(raw);
    finish(run, "failed", message);
  }

  function success(run, message = "生成结果已就绪") {
    finish(run, "success", message);
  }

  function requestCancel(runId) {
    const run = runs.get(runId);
    if (!run || run.finishedAt) return false;
    run.cancelRequested = true;
    update(run, "cancelling", "停止本地等待", "将在下一次任务状态检查时停止轮询；这不会取消 Gitee 服务器上已经提交的任务。", { cancelRequested: true });
    return true;
  }

  function current(task) {
    const runId = activeByTask.get(task);
    return runId ? runs.get(runId) || null : null;
  }

  function get(runId) {
    return runs.get(runId) || null;
  }

  function list() {
    return [...runs.values()].sort((a, b) => b.startedAt - a.startedAt).map(snapshot);
  }

  function bodyData(body) {
    const out = {};
    try {
      if (body instanceof FormData) {
        for (const [key, value] of body.entries()) {
          if (!(key in out)) out[key] = value;
        }
        return out;
      }
    } catch {}
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === "object" ? parsed : out;
      } catch {}
    }
    return out;
  }

  function modelFromBody(body) {
    return String(bodyData(body)?.model || "");
  }

  function inferTask(url, body) {
    const path = String(url || "").toLowerCase();
    const data = bodyData(body);
    if (/\/api\/(?:async\/)?images\/edits/.test(path)) return "edit";
    if (/\/api\/(?:async\/)?images\/generations/.test(path)) return "t2i";
    if (/\/api\/async\/videos\/image-to-video/.test(path)) return "i2v";
    if (/\/api\/async\/videos\//.test(path)) {
      const hasImage = Boolean(data.image || data.first_frame || data.image_url);
      return hasImage ? "i2v" : "t2v";
    }
    return null;
  }

  function activeRunForRequest(url, body, modelId) {
    const inferredTask = inferTask(url, body);
    if (inferredTask) {
      const run = current(inferredTask);
      if (run && !run.finishedAt && (!modelId || run.modelId === modelId)) return run;
    }
    const candidates = [...activeByTask.values()]
      .map((runId) => runs.get(runId))
      .filter((run) => run && !run.finishedAt && (!modelId || run.modelId === modelId))
      .sort((a, b) => b.startedAt - a.startedAt);
    return candidates[0] || null;
  }

  async function responseJson(response) {
    try {
      const text = await response.clone().text();
      if (!text) return null;
      try { return compactValue(JSON.parse(text)); }
      catch { return { _text: text.length > 4000 ? `${text.slice(0, 4000)}… [truncated]` : text }; }
    } catch { return null; }
  }

  function endpointFromUrl(url) {
    const marker = "/api/";
    const index = url.indexOf(marker);
    return index >= 0 ? url.slice(index + marker.length).split("?")[0] : url;
  }

  function strategyFromInit(init) {
    if (init?.body instanceof FormData) return "multipart";
    const headers = init?.headers;
    let contentType = "";
    if (headers instanceof Headers) contentType = headers.get("content-type") || "";
    else contentType = String(headers?.["Content-Type"] || headers?.["content-type"] || "");
    if (contentType.includes("application/json") || typeof init?.body === "string") return "json";
    return "request";
  }

  function rawMessage(raw) {
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    return raw.message || raw.error?.message || raw.error || raw.detail || raw._text || "";
  }

  function extractUrls(raw) {
    if (!raw || typeof raw !== "object") return [];
    return [
      raw?.output?.file_url,
      raw?.output?.video_url,
      raw?.output?.url,
      raw?.video?.url,
      ...(Array.isArray(raw?.data) ? raw.data.map((item) => item?.url) : []),
      ...(Array.isArray(raw?.images) ? raw.images.map((item) => item?.url) : []),
    ].filter((value) => typeof value === "string" && /^https?:\/\//i.test(value));
  }

  function rememberUrls(run, raw) {
    if (!run) return;
    const merged = new Set([...(run.resultUrls || []), ...extractUrls(raw)]);
    run.resultUrls = [...merged].slice(0, 12);
  }

  function activeRunForDownload(url) {
    let target = "";
    try { target = new URL(url, location.href).searchParams.get("url") || ""; } catch {}
    const active = [...activeByTask.values()]
      .map((runId) => runs.get(runId))
      .filter((run) => run && !run.finishedAt)
      .sort((a, b) => b.startedAt - a.startedAt);
    if (target) {
      const exact = active.find((run) => (run.resultUrls || []).includes(target));
      if (exact) return exact;
      const byRaw = active.find((run) => {
        try { return JSON.stringify(run.lastRaw || {}).includes(target); } catch { return false; }
      });
      if (byRaw) return byRaw;
    }
    return active[0] || null;
  }

  window.fetch = async function taskAwareFetch(input, init = {}) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    const method = String(init?.method || "GET").toUpperCase();

    const pollMatch = url.match(/\/api\/task\/([^?]+)/);
    if (pollMatch && method === "GET") {
      const taskId = decodeURIComponent(pollMatch[1]);
      const run = runs.get(taskIdToRun.get(taskId));
      if (run?.cancelRequested) {
        finish(run, "cancelled", "已停止本地轮询；远端任务可能仍在继续生成。请保留 task_id 以便稍后查询。");
        return new Response(JSON.stringify({ status: "cancelled", message: "local polling stopped", task_id: taskId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (run) {
        run.pollCount += 1;
        update(run, "polling", "排队 / 生成中", `正在检查任务状态 · 第 ${run.pollCount} 次`, { pollCount: run.pollCount, taskId });
      }
      const response = await nativeFetch(input, init);
      if (run && !run.finishedAt) {
        const raw = await responseJson(response);
        rememberUrls(run, raw);
        const state = String(raw?.status || raw?.state || "").toLowerCase();
        if (state === "success") update(run, "server-success", "服务端生成完成", "正在获取生成结果", { lastRaw: raw });
        else if (["failed", "cancelled"].includes(state)) {
          run.lastRaw = compactValue(raw);
          run.lastError = rawMessage(raw) || `任务状态：${state}`;
          update(run, "server-failed", "服务端任务失败", run.lastError, { lastRaw: raw });
        }
      }
      return response;
    }

    if (url.includes("/dl?url=") && method === "GET") {
      const run = activeRunForDownload(url);
      if (run) update(run, "downloading", "下载结果", "服务端已完成，正在下载图片或视频文件");
      return nativeFetch(input, init);
    }

    if (url.includes("/api/") && method === "POST") {
      const modelId = modelFromBody(init?.body);
      const run = activeRunForRequest(url, init?.body, modelId);
      if (!run) return nativeFetch(input, init);

      const endpoint = endpointFromUrl(url);
      const strategy = strategyFromInit(init);
      run.requestCount += 1;
      run.endpoint = endpoint;
      run.strategy = strategy;
      update(run, "submitting", "提交生成请求", `${endpoint} · ${strategy} · 第 ${run.requestCount} 次请求`, {
        endpoint,
        strategy,
        requestCount: run.requestCount,
      });

      const started = now();
      const response = await nativeFetch(input, init);
      const raw = await responseJson(response);
      const attempt = {
        at: now(),
        endpoint,
        strategy,
        status: response.status,
        ok: response.ok,
        elapsedMs: now() - started,
        message: rawMessage(raw),
      };
      run.attempts.push(attempt);
      if (run.attempts.length > 20) run.attempts.splice(0, run.attempts.length - 20);

      if (!response.ok) {
        run.lastRaw = compactValue(raw);
        run.lastError = attempt.message || `HTTP ${response.status}`;
        update(run, "retrying", "接口参数不兼容，准备重试", `${endpoint} 返回 HTTP ${response.status}${attempt.message ? ` · ${attempt.message}` : ""}`, { lastRaw: raw });
        emit("attempt", run, attempt);
        return response;
      }

      rememberUrls(run, raw);
      const taskId = raw?.task_id ? String(raw.task_id) : null;
      if (taskId) {
        run.taskId = taskId;
        taskIdToRun.set(taskId, run.id);
        update(run, "created", "任务已创建", `task_id=${taskId}`, { taskId, lastRaw: raw });
      } else {
        update(run, "response", "服务端已返回结果", "正在解析生成结果", { lastRaw: raw });
      }
      emit("attempt", run, attempt);
      return response;
    }

    return nativeFetch(input, init);
  };

  function inspectOutput(before) {
    const items = [...document.querySelectorAll("#output .item")].filter((item) => !before.has(item));
    const error = items.find((item) => /错误|失败|error|failed/i.test(item.querySelector("h3")?.textContent || ""));
    const media = items.find((item) => item.querySelector("img,video"));
    if (error) return { state: "failed", message: error.querySelector(".meta")?.textContent || error.textContent.slice(0, 500) };
    if (media) return { state: "success", message: "生成结果已就绪" };
    return { state: "unknown", message: "" };
  }

  function bindButton(buttonId, task) {
    const button = $(buttonId);
    if (!button || typeof button.onclick !== "function" || button.dataset.taskTrackerWrapped === "1") return;
    const original = button.onclick;
    button.dataset.taskTrackerWrapped = "1";
    button.onclick = async function (event) {
      const run = start(task);
      const before = new Set(document.querySelectorAll("#output .item"));
      try {
        await original.call(this, event);
        if (run.finishedAt) return;
        const result = inspectOutput(before);
        if (result.state === "success") success(run, result.message);
        else if (result.state === "failed") fail(run, result.message, run.lastRaw);
        else if (run.stage === "server-failed") fail(run, run.lastError || "服务端任务失败", run.lastRaw);
        else if (run.cancelRequested) finish(run, "cancelled", "已停止本地等待；远端任务可能仍在继续。");
        else fail(run, run.lastError || "运行结束，但没有发现明确的生成结果。", run.lastRaw);
      } catch (error) {
        fail(run, error, run.lastRaw);
        throw error;
      }
    };
  }

  function bindButtons() {
    for (const [buttonId, task] of Object.entries(BUTTON_TASKS)) bindButton(buttonId, task);
  }

  window.addEventListener("DOMContentLoaded", bindButtons);

  window.GiteeTaskTracker = Object.freeze({
    subscribe,
    list,
    get,
    current,
    requestCancel,
    snapshot: (runId) => { const run = runs.get(runId); return run ? snapshot(run) : null; },
  });
})();
