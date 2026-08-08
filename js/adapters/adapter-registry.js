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

  function cloneParameter(parameter) {
    return {
      ...parameter,
      ...(Array.isArray(parameter.options) ? { options: parameter.options.map((item) => typeof item === "object" ? { ...item } : item) } : {}),
    };
  }

  function parametersFor(taskId, modelId) {
    const registry = window.GiteeModelRegistry;
    const adapter = forModel(taskId, modelId);
    const model = registry?.model?.(taskId, modelId) || null;
    if (!adapter) return [];

    let schema = adapter.parameters || [];
    if (!Array.isArray(schema)) schema = schema?.[taskId] || [];

    return schema.map((parameter) => {
      const next = cloneParameter(parameter);
      if (next.key === "duration" && model?.limits?.duration) {
        const rule = model.limits.duration;
        next.min = rule.min;
        next.max = rule.max;
        next.default = rule.recommended;
        next.help = next.help || `${model.label || model.id} 支持 ${rule.min}–${rule.max} 秒，推荐 ${rule.recommended} 秒。`;
      }
      return next;
    });
  }

  function list() {
    return [...adapters.values()];
  }

  window.GiteeModelAdapters = Object.freeze({ register, get, forModel, parametersFor, list });
})();
