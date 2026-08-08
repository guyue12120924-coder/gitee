(() => {
  "use strict";

  const TRACKER = window.GiteeTaskTracker;
  if (!TRACKER) throw new Error("GiteeTaskTracker must load before history-store.js");

  const DB_NAME = "gitee-ai-workbench";
  const DB_VERSION = 1;
  const STORE_NAME = "generation-history";
  const FALLBACK_KEY = "moark_generation_history_v1";
  const MAX_RECORDS = 100;
  const listeners = new Set();
  let dbPromise = null;

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

  async function allRecords() {
    try {
      const records = await idbAll();
      return records.sort((a, b) => (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0));
    } catch {
      return fallbackRead().sort((a, b) => (b.finishedAt || b.startedAt || 0) - (a.finishedAt || a.startedAt || 0));
    }
  }

  async function trim() {
    const records = await allRecords();
    const extras = records.slice(MAX_RECORDS);
    if (!extras.length) return;
    try {
      for (const record of extras) await idbDelete(record.id);
    } catch {
      fallbackWrite(records.slice(0, MAX_RECORDS));
    }
  }

  async function save(record) {
    const safe = clone(record);
    try {
      await idbPut(safe);
      await trim();
    } catch {
      const records = fallbackRead().filter((item) => item.id !== safe.id);
      records.unshift(safe);
      fallbackWrite(records);
    }
    emit("save", safe);
    return safe;
  }

  async function remove(id) {
    try { await idbDelete(id); }
    catch { fallbackWrite(fallbackRead().filter((item) => item.id !== id)); }
    emit("remove", { id });
  }

  async function clear() {
    try { await idbClear(); }
    catch { fallbackWrite([]); }
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

  function fromRun(run) {
    return {
      id: run.id,
      task: run.task,
      taskLabel: run.taskLabel,
      modelId: run.modelId,
      prompt: run.prompt || "",
      parameters: clone(run.parameters || {}),
      extraJson: run.extraJson || "",
      endpointOverride: run.endpointOverride || "",
      inputFiles: clone(run.inputFiles || []),
      state: run.state,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt || Date.now(),
      durationMs: Math.max(0, (run.finishedAt || Date.now()) - run.startedAt),
      endpoint: run.endpoint || null,
      strategy: run.strategy || null,
      taskId: run.taskId || null,
      requestCount: run.requestCount || 0,
      pollCount: run.pollCount || 0,
      resultUrls: [...new Set(run.resultUrls || [])].slice(0, 8),
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
    if (type !== "finish" || !run?.finishedAt) return;
    save(fromRun(run)).catch((error) => console.warn("history save failed", error));
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
