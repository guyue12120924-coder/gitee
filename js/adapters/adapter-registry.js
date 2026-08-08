(() => {
  "use strict";

  const adapters = new Map();

  function register(id, adapter) {
    if (!id || !adapter) throw new Error("Adapter id and implementation are required");
    adapters.set(id, Object.freeze({ id, ...adapter }));
  }

  function get(id) {
    return adapters.get(id) || null;
  }

  function forModel(taskId, modelId) {
    const registry = window.GiteeModelRegistry;
    const id = registry?.adapterId?.(taskId, modelId);
    return get(id) || get({ t2i: "generic-image", edit: "generic-edit", i2v: "generic-video", t2v: "generic-video" }[taskId]) || null;
  }

  function list() {
    return [...adapters.values()];
  }

  window.GiteeModelAdapters = Object.freeze({ register, get, forModel, list });
})();
