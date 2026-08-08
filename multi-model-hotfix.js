(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function rememberKeyNow() {
    const key = $("apiKey")?.value?.trim();
    if (!key) return;
    try {
      if ($("rememberKey")?.checked) localStorage.setItem("moark_api_key", key);
    } catch {}
  }

  function setLoading(show) {
    if (typeof window.showLoading === "function") {
      window.showLoading(show);
      return;
    }
    const el = $("globalLoading");
    if (el) el.style.display = show ? "block" : "none";
  }

  function addInfo(title, meta = "") {
    if (typeof window.addOutputItem === "function") {
      window.addOutputItem({ title, meta });
      return;
    }
    const out = $("output");
    if (!out) return;
    const box = document.createElement("div");
    box.className = "item";
    const h = document.createElement("h3");
    h.textContent = title;
    box.appendChild(h);
    if (meta) {
      const m = document.createElement("div");
      m.className = "meta";
      m.textContent = meta;
      box.appendChild(m);
    }
    out.prepend(box);
  }

  async function ensureZip() {
    if (window.JSZip) return window.JSZip;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error("加载 JSZip 失败"));
    });
    return window.JSZip;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function zipVideos(items) {
    if (!items.length) return;
    const JSZip = await ensureZip();
    const zip = new JSZip();
    for (const item of items) zip.file(item.name, item.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    downloadBlob(blob, `wan_segments_${stamp}.zip`);
  }

  function markExperimentalModels() {
    const ids = ["Wan2.7", "LTX-2"];
    for (const selectId of ["mmI2VModel", "mmT2VModel"]) {
      const sel = $(selectId);
      if (!sel) continue;
      for (const id of ids) {
        const opt = [...sel.options].find((o) => o.value === id);
        if (opt && !opt.textContent.includes("实验")) {
          opt.textContent += " · 实验/需核对当前模型页";
        }
      }
    }
  }

  function preferVerifiedDefaults() {
    try {
      const i2vSaved = localStorage.getItem("moark_model_i2v");
      const i2v = $("mmI2VModel");
      if (!i2vSaved && i2v && [...i2v.options].some((o) => o.value === "Wan2_2-I2V-A14B")) {
        i2v.value = "Wan2_2-I2V-A14B";
        i2v.dispatchEvent(new Event("change"));
      }

      const t2vSaved = localStorage.getItem("moark_model_t2v");
      const t2v = $("mmT2VModel");
      if (!t2vSaved && t2v && [...t2v.options].some((o) => o.value === "HunyuanVideo-1.5")) {
        t2v.value = "HunyuanVideo-1.5";
        t2v.dispatchEvent(new Event("change"));
      }
    } catch {}
  }

  function wrapSimpleButton(id) {
    const button = $(id);
    if (!button || typeof button.onclick !== "function" || button.dataset.mmHotfix === "1") return;
    const original = button.onclick;
    button.dataset.mmHotfix = "1";
    button.onclick = async function (event) {
      rememberKeyNow();
      setLoading(true);
      button.disabled = true;
      try {
        return await original.call(this, event);
      } finally {
        button.disabled = false;
        setLoading(false);
      }
    };
  }

  function wrapWanButton() {
    const button = $("btnWanRun");
    if (!button || typeof button.onclick !== "function" || button.dataset.mmHotfix === "1") return;
    const original = button.onclick;
    button.dataset.mmHotfix = "1";

    button.onclick = async function (event) {
      rememberKeyNow();
      setLoading(true);
      button.disabled = true;

      const durationInput = $("wanDuration");
      const originalDuration = durationInput?.value || "5";
      const requested = Number.parseFloat(originalDuration) || 5;
      const selectedModel = $("mmI2VModel")?.value;
      const needsSegments = selectedModel === "Wan2_2-I2V-A14B" && requested > 5;

      try {
        if (!needsSegments) return await original.call(this, event);

        const count = Math.max(1, Math.ceil(requested / 5));
        const zipItems = [];
        addInfo("Wan2.2 长视频分段模式", `总时长=${requested}s · 分段数=${count} · 每段最多5s`);

        for (let i = 0; i < count; i++) {
          const remaining = Math.max(0.5, Math.min(5, requested - i * 5));
          if (durationInput) durationInput.value = String(remaining);

          const before = new Set(document.querySelectorAll("#output video"));
          if (typeof window.setStatus === "function") {
            window.setStatus(`Wan2.2 分段 ${i + 1}/${count} 生成中…`);
          }

          await original.call(this, event);

          const fresh = [...document.querySelectorAll("#output video")].find((v) => !before.has(v));
          if (!fresh?.src) {
            throw new Error(`Wan2.2 第 ${i + 1}/${count} 段没有生成视频，已停止后续分段`);
          }

          if ($("wanZipSegments")?.checked) {
            const res = await fetch(fresh.src);
            if (res.ok) {
              zipItems.push({
                name: `wan_segment_${String(i + 1).padStart(2, "0")}.mp4`,
                blob: await res.blob(),
              });
            }
          }
        }

        if ($("wanZipSegments")?.checked && zipItems.length > 1) {
          if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段完成，正在打包 ZIP…");
          await zipVideos(zipItems);
          addInfo("Wan2.2 分段 ZIP 已生成", `已打包 ${zipItems.length} 个视频片段`);
        }

        if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段生成完成", "ok");
      } catch (e) {
        if (typeof window.setStatus === "function") window.setStatus("Wan2.2 分段生成失败", "err");
        addInfo("Wan2.2 分段错误", String(e?.message || e));
      } finally {
        if (durationInput) durationInput.value = originalDuration;
        button.disabled = false;
        setLoading(false);
      }
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    // multi-model.js registers its DOMContentLoaded handler before this file,
    // so its model controls/button handlers are ready by the time this runs.
    preferVerifiedDefaults();
    markExperimentalModels();
    wrapSimpleButton("btnZRun");
    wrapSimpleButton("btnEditRun");
    wrapWanButton();
    wrapSimpleButton("btnHyRun");
  });
})();
