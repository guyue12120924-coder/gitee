(() => {
  "use strict";

  const TRACKER = window.GiteeTaskTracker;
  const ADAPTERS = window.GiteeModelAdapters;
  if (!TRACKER || !ADAPTERS) throw new Error("Task tracker and adapter layer must load before history-store.js");

  const DB_NAME = "gitee-ai-workbench";
  const DB_VERSION = 1;
  const STORE_NAME = "generation-history";
  const FALLBACK_KEY = "moark_generation_history_v1";
  const MAX_RECORDS = 100;
  const listeners = new Set();
  const pending = new Map();
  const FILE_IDS = { edit: ["editImg1", "editImg2"], i2v: ["wanImg"] };
  let dbPromise = null;

  const $ = (id) => document.getElementById(id);

  function clone(value) {
    try { return structuredClone(value); }
    catch {
      try { return JSON.parse(JSON.stringify(value)); }
      catch { return value; }
    }
  }

  function emit(type, record = null) {
    const payload = { type, record: record ? clone(record) : null };
    for (const listener of listeners) {
      try { listener(payload); } catch (error) { console.warn("history listener failed", error); }
    }
    window.dispatchEvent(new CustomEvent("gitee-history-change", { detail: payload }));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function openDb() {
    if (!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB unavailable"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("finishedAt", "finishedAt", { unique: false });
          store.createIndex("task", "task", { unique: false });
          store.createIndex("state", "state", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
    return dbPromise;
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  async function idbPut(record) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(clone(record));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
    });
  }

  async function idbAll() {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    return requestPromise(tx.objectStore(STORE_NAME).getAll());
  }

  async function idbDelete(id) {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
    });
  }

  async function idbClear() {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("IndexedDB clear failed"));
    });
  }

  function fallbackRead() {
    try {
      const value = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function fallbackWrite(records) {
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(records.slice(0, MAX_RECORDS))); }
    catch {}
  }

  function removeFallback(id) {
    const records = fallbackRead().filter((item) => item.id !== id);
    fallbackWrite(records);
  }

  function mergeRecords(primary, fallback) {
    const map = new Map();
    for (const record of [...primary, ...fallback]) {
      if (!record?.id) continue;
      const existing = map.get(record.id);
      const currentTime = record.finishedAt || record.startedAt || 0;
      const existingTime = existing?.finishedAt || existing?.startedAt || 0;
      if (!existing || currentTime >= existingTime) map.set(record.id, record);
    }
    return [...map.values()].sort((a, b) => (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0));
  }

  async function allRecords() {
    const fallback = fallbackRead();
    try {
      const records = await idbAll();
      return mergeRecords(records, fallback);
    } catch {
      return mergeRecords([], fallback);
    }
  }

  async function trim() {
    const records = await allRecords();
    const keep = records.slice(0, MAX_RECORDS);
    const extras = records.slice(MAX_RECORDS);
    fallbackWrite(fallbackRead().filter((item) => keep.some((record) => record.id === item.id)));
    if (!extras.length) return;
    for (const record of extras) {
      try { await idbDelete(record.id); } catch {}
      removeFallback(record.id);
    }
  }

  async function save(record) {
    const safe = clone(record);
    let storedInIdb = false;
    try {
      await idbPut(safe);
      storedInIdb = true;
    } catch {}

    if (storedInIdb) {
      removeFallback(safe.id);
    } else {
      const records = fallbackRead().filter((item) => item.id !== safe.id);
      records.unshift(safe);
      fallbackWrite(records);
    }

    await trim();
    emit("save", safe);
    return safe;
  }

  async function remove(id) {
    try { await idbDelete(id); } catch {}
    removeFallback(id);
    emit("remove", { id });
  }

  async function clear() {
    try { await idbClear(); } catch {}
    try { localStorage.removeItem(FALLBACK_KEY); } catch {}
    emit("clear");
  }

  async function list(options = {}) {
    const { limit = 50, task = "all", state = "all", query = "" } = options;
    const q = String(query || "").trim().toLowerCase();
    const records = await allRecords();
    return records.filter((record) => {
      if (task !== "all" && record.task !== task) return false;
      if (state !== "all" && record.state !== state) return false;
      if (!q) return true;
      const haystack = [record.taskLabel, record.task, record.modelId, record.prompt, record.taskId, record.lastError]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    }).slice(0, limit).map(clone);
  }

  async function get(id) {
    const records = await allRecords();
    const record = records.find((item) => item.id === id);
    return record ? clone(record) : null;
  }

  function readParameter(parameter) {
    if (parameter.sourceId) {
      const source = $(parameter.sourceId);
      if (!source) return undefined;
      if (parameter.type === "checkbox") return Boolean(source.checked);
      return source.value;
    }
    if (parameter.sourceName) {
      return [...document.querySelectorAll(`input[name="${parameter.sourceName}"]:checked`)].map((input) => input.value);
    }
    return undefined;
  }

  function captureContext(run) {
    const parameters = {};
    try {
      for (const parameter of ADAPTERS.parametersFor(run.task, run.modelId) || []) {
        const value = readParameter(parameter);
        if (value !== undefined) parameters[parameter.key] = value;
      }
    } catch {}

    const inputFiles = [];
    for (const id of FILE_IDS[run.task] || []) {
      const file = $(id)?.files?.[0];
      if (file) inputFiles.push({ field: id, name: file.name, type: file.type, size: file.size });
    }

    return {
      parameters,
      extraJson: $(`mm-${run.task}-extra`)?.value || "",
      endpointOverride: $(`mm-${run.task}-endpoint`)?.value || "",
      inputFiles,
    };
  }

  function resultUrls(raw) {
    if (!raw || typeof raw !== "object") return [];
    const urls = [
      raw?.output?.file_url,
      raw?.output?.video_url,
      raw?.output?.url,
      raw?.video?.url,
      ...(Array.isArray(raw?.data) ? raw.data.map((item) => item?.url) : []),
      ...(Array.isArray(raw?.images) ? raw.images.map((item) => item?.url) : []),
    ].filter((value) => typeof value === "string" && /^https?:\/\//i.test(value));
    return [...new Set(urls)];
  }

  function fromRun(run) {
    const context = pending.get(run.id) || captureContext(run);
    return {
      id: run.id,
      task: run.task,
      taskLabel: run.taskLabel,
      modelId: run.modelId,
      prompt: run.prompt || "",
      parameters: clone(context.parameters || {}),
      extraJson: context.extraJson || "",
      endpointOverride: context.endpointOverride || "",
      inputFiles: clone(context.inputFiles || []),
      state: run.state,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt || Date.now(),
      durationMs: Math.max(0, (run.finishedAt || Date.now()) - run.startedAt),
      endpoint: run.endpoint || null,
      strategy: run.strategy || null,
      taskId: run.taskId || null,
      requestCount: run.requestCount || 0,
      pollCount: run.pollCount || 0,
      resultUrls: [...new Set([...(run.resultUrls || []), ...resultUrls(run.lastRaw)])].slice(0, 8),
      lastError: run.lastError || null,
      attempts: (run.attempts || []).slice(-12).map((attempt) => ({
        endpoint: attempt.endpoint,
        strategy: attempt.strategy,
        status: attempt.status,
        ok: attempt.ok,
        elapsedMs: attempt.elapsedMs,
        message: attempt.message || "",
      })),
    };
  }

  TRACKER.subscribe(({ type, run }) => {
    if (type === "start" && run?.id) {
      pending.set(run.id, captureContext(run));
      return;
    }
    if (type !== "finish" || !run?.finishedAt) return;
    const record = fromRun(run);
    pending.delete(run.id);
    save(record).catch((error) => console.warn("history save failed", error));
  });

  window.GiteeHistoryStore = Object.freeze({
    save,
    list,
    get,
    remove,
    clear,
    subscribe,
    maxRecords: MAX_RECORDS,
  });
})();
