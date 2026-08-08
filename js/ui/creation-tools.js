(() => {
  "use strict";

  const REGISTRY = window.GiteeModelRegistry;
  const TRACKER = window.GiteeTaskTracker;
  if (!REGISTRY || !TRACKER) throw new Error("Model Registry and Task Tracker must load before creation-tools.js");

  const $ = (id) => document.getElementById(id);
  const TASKS = {
    t2i: { panelId: "panelZ", promptId: "zPrompt", selectId: "mmT2IModel" },
    edit: { panelId: "panelEdit", promptId: "editPrompt", selectId: "mmEditModel" },
    i2v: { panelId: "panelWan", promptId: "wanPrompt", selectId: "mmI2VModel" },
    t2v: { panelId: "panelHunyuan", promptId: "hyPrompt", selectId: "mmT2VModel" },
  };
  const FUNCTION_TO_TASK = {
    "z-image": "t2i",
    "Edit-2511": "edit",
    "Wan2.2-I2V-A14B": "i2v",
    "HunyuanVideo-1.5": "t2v",
  };
  const undoStacks = new Map();

  const TEMPLATES = {
    t2i: [
      { title: "人物摄影", hint: "写实人像 / 自然光", zh: "写实人物摄影，主体清晰，真实皮肤质感，自然光，浅景深，干净背景，专业摄影构图", en: "photorealistic portrait photography, clear subject, natural skin texture, soft natural light, shallow depth of field, clean background, professional composition" },
      { title: "电影画面", hint: "电影感 / 光影层次", zh: "电影感画面，明确主体，层次丰富的光影，真实材质，细腻色彩，宽容度高，构图平衡", en: "cinematic frame, clear subject, layered lighting, realistic materials, refined color grading, high dynamic range, balanced composition" },
      { title: "产品广告", hint: "商品展示 / 商业质感", zh: "高端产品广告摄影，产品居中突出，材质细节清晰，柔和棚拍光，背景简洁，商业海报质感", en: "premium product advertising photography, product clearly emphasized, crisp material details, soft studio lighting, minimal background, commercial campaign aesthetic" },
      { title: "动漫插画", hint: "精细插画 / 干净线条", zh: "高质量动漫插画，角色设计完整，线条干净，色彩协调，细节丰富，构图清晰，背景具有空间层次", en: "high-quality anime illustration, complete character design, clean linework, harmonious colors, rich details, clear composition, layered background depth" },
      { title: "建筑空间", hint: "建筑可视化 / 广角", zh: "专业建筑可视化，空间比例准确，广角构图，自然材质，真实环境光，清晰结构细节，画面整洁", en: "professional architectural visualization, accurate spatial proportions, wide-angle composition, natural materials, realistic ambient light, crisp structural details, clean scene" },
      { title: "文字海报", hint: "中文文字 / 版式", zh: "现代中文海报设计，主题文字清晰可读，版式层级明确，留白合理，视觉中心突出，图文关系协调", en: "modern poster design, clearly readable headline text, strong typographic hierarchy, balanced negative space, clear focal point, coherent text-image relationship" },
    ],
    edit: [
      { title: "移除物体", hint: "自然补全背景", zh: "移除指定物体，自然补全被遮挡区域，保持主体、视角、构图、光照和色彩不变，边缘自然无痕", en: "remove the specified object and naturally reconstruct the occluded area, preserving subject identity, viewpoint, composition, lighting and color, with seamless edges" },
      { title: "更换背景", hint: "主体保持一致", zh: "仅更换背景，完整保持人物或主体身份、姿态、服装、比例和前景细节，新的背景光照与主体自然匹配", en: "replace only the background while preserving subject identity, pose, clothing, proportions and foreground details; match the new background lighting naturally to the subject" },
      { title: "风格迁移", hint: "结构与内容不变", zh: "将画面转换为指定风格，同时保持原始主体、布局、透视和关键结构不变，避免新增无关元素", en: "convert the image to the requested style while preserving the original subject, layout, perspective and key structure; do not introduce unrelated elements" },
      { title: "局部改色", hint: "只改指定区域", zh: "只修改指定区域的颜色和材质表现，其他区域保持完全一致，边界准确，纹理连续，光照关系自然", en: "change only the color and material appearance of the specified region; keep all other areas unchanged, with accurate boundaries, continuous texture and natural lighting" },
    ],
    i2v: [
      { title: "自然微动", hint: "稳定人物 / 轻动作", zh: "保持主体身份与画面构图一致，人物轻微自然动作，呼吸与衣物细节自然，镜头稳定，运动连续无闪烁", en: "preserve subject identity and composition, subtle natural motion, realistic breathing and clothing movement, stable camera, continuous motion without flicker" },
      { title: "缓慢推进", hint: "电影推镜", zh: "镜头缓慢向主体推进，主体动作自然克制，景深逐渐变化，光照保持一致，画面稳定且具有电影感", en: "slow cinematic push-in toward the subject, restrained natural motion, gradually changing depth of field, consistent lighting, stable cinematic image" },
      { title: "环绕镜头", hint: "平滑轨迹 / 立体感", zh: "镜头平滑环绕主体运动，保持主体外观一致，空间透视合理，背景运动连续，避免形变与跳帧", en: "smooth orbiting camera movement around the subject, preserve appearance consistency, realistic spatial perspective, continuous background motion, avoid deformation and frame jumps" },
      { title: "广告动效", hint: "产品展示 / 精致运动", zh: "高端产品广告动效，镜头缓慢移动突出产品细节，反射和材质变化自然，背景干净，运动节奏稳定", en: "premium product advertising motion, slow camera movement emphasizing product details, natural reflections and material response, clean background, controlled pacing" },
    ],
    t2v: [
      { title: "电影运镜", hint: "镜头语言 / 连贯动作", zh: "电影感场景，明确主体与环境关系，镜头运动平滑，动作连续自然，光影统一，构图稳定，细节清晰", en: "cinematic scene with clear subject-environment relationship, smooth camera movement, continuous natural action, consistent lighting, stable composition, crisp details" },
      { title: "人物叙事", hint: "自然动作 / 情绪", zh: "人物叙事短片，角色外观保持一致，表情与动作自然，镜头切换克制，环境细节真实，情绪氛围明确", en: "character-driven short film, consistent character appearance, natural expression and movement, restrained camera changes, realistic environment details, clear emotional tone" },
      { title: "自然风景", hint: "环境运动 / 大景别", zh: "宏大自然风景，云层、植被和水面运动符合物理规律，镜头缓慢移动，空间层次丰富，光线自然", en: "expansive natural landscape, physically plausible cloud vegetation and water motion, slow camera movement, rich depth, natural lighting" },
      { title: "商业广告", hint: "高级质感 / 节奏稳定", zh: "高端商业广告视频，主体突出，镜头运动精确，材质和光影精致，画面整洁，节奏稳定，品牌视觉感强", en: "premium commercial advertising video, strong subject focus, precise camera movement, refined materials and lighting, clean frame, controlled pacing, strong brand aesthetic" },
    ],
  };

  const ENHANCE = {
    t2i: {
      zh: "主体清晰，构图完整，细节丰富，自然光影，真实材质，层次分明，画面干净，高质量",
      en: "clear subject, complete composition, rich detail, natural lighting, realistic materials, strong depth, clean image, high quality",
    },
    edit: {
      zh: "保持未要求修改的主体身份、构图、视角和光照一致，只修改指定区域，边缘自然，纹理连续，不引入额外物体",
      en: "preserve all unrequested subject identity, composition, viewpoint and lighting; modify only the specified region, keep edges seamless and texture continuous, introduce no unrelated objects",
    },
    i2v: {
      zh: "保持主体身份与服装一致，动作自然连贯，镜头运动平滑，物理运动合理，避免闪烁、形变和画面跳变",
      en: "preserve subject identity and clothing, natural continuous motion, smooth camera movement, physically plausible movement, avoid flicker deformation and abrupt frame changes",
    },
    t2v: {
      zh: "镜头语言明确，动作连续自然，构图稳定，光影统一，运动流畅，细节清晰，避免闪烁、形变和突变",
      en: "clear camera language, continuous natural action, stable composition, consistent lighting, fluid motion, crisp detail, avoid flicker deformation and abrupt changes",
    },
  };

  function hasChinese(text) {
    return /[\u3400-\u9fff]/.test(text || "");
  }

  function dispatchInput(el) {
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pushUndo(task, value) {
    const stack = undoStacks.get(task) || [];
    if (!stack.length || stack[stack.length - 1] !== value) stack.push(value);
    while (stack.length > 8) stack.shift();
    undoStacks.set(task, stack);
  }

  function setPrompt(task, value, remember = true) {
    const input = $(TASKS[task]?.promptId);
    if (!input) return;
    if (remember) pushUndo(task, input.value);
    input.value = value;
    dispatchInput(input);
  }

  function appendTemplate(task, template) {
    const input = $(TASKS[task]?.promptId);
    if (!input) return;
    const value = hasChinese(input.value) ? template.zh : (input.value.trim() ? template.en : template.zh);
    const current = input.value.trim();
    setPrompt(task, current ? `${current}${hasChinese(current) ? "，" : ", "}${value}` : value);
  }

  function enhancePrompt(task) {
    const input = $(TASKS[task]?.promptId);
    if (!input) return;
    const current = input.value.trim();
    if (!current) {
      window.alert("请先输入一个基础 Prompt，再使用提示词增强。");
      return;
    }
    const suffix = hasChinese(current) ? ENHANCE[task].zh : ENHANCE[task].en;
    const normalized = current.toLowerCase();
    const sample = suffix.split(/[，,]/)[0].trim().toLowerCase();
    if (sample && normalized.includes(sample)) return;
    setPrompt(task, `${current}${hasChinese(current) ? "。" : ". "}${suffix}`);
  }

  function undoPrompt(task) {
    const stack = undoStacks.get(task) || [];
    if (!stack.length) return;
    const previous = stack.pop();
    undoStacks.set(task, stack);
    setPrompt(task, previous, false);
  }

  function createPromptTools(task) {
    const conf = TASKS[task];
    const input = $(conf.promptId);
    const panel = $(conf.panelId);
    if (!input || !panel || panel.querySelector(`[data-prompt-tools="${task}"]`)) return;

    const box = document.createElement("div");
    box.className = "prompt-toolbox";
    box.dataset.promptTools = task;
    box.innerHTML = `
      <div class="prompt-toolbox-head">
        <span class="prompt-toolbox-label">Prompt Tools</span>
        <div class="prompt-toolbox-actions">
          <button type="button" class="btn pt-templates">模板</button>
          <button type="button" class="btn pt-enhance">本地增强</button>
          <button type="button" class="btn pt-undo">撤销</button>
        </div>
      </div>
      <div class="prompt-template-bank"></div>
      <div class="prompt-toolbox-note">“本地增强”只在浏览器中补充任务相关描述，不会调用额外 AI API，也不会产生额外请求费用。</div>
    `;
    input.insertAdjacentElement("beforebegin", box);

    const bank = box.querySelector(".prompt-template-bank");
    for (const template of TEMPLATES[task] || []) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "prompt-template";
      button.innerHTML = `<strong>${template.title}</strong><span>${template.hint}</span>`;
      button.addEventListener("click", () => appendTemplate(task, template));
      bank.appendChild(button);
    }
    box.querySelector(".pt-templates")?.addEventListener("click", () => {
      bank.classList.toggle("is-open");
      box.querySelector(".prompt-toolbox-note")?.classList.toggle("is-visible", bank.classList.contains("is-open"));
    });
    box.querySelector(".pt-enhance")?.addEventListener("click", () => enhancePrompt(task));
    box.querySelector(".pt-undo")?.addEventListener("click", () => undoPrompt(task));
  }

  function activeTask() {
    return FUNCTION_TO_TASK[$("modelSel")?.value] || "t2i";
  }

  function compareModels() {
    const models = REGISTRY.task("t2i")?.models || [];
    const preferred = models.filter((model) => ["recommended", "fast"].includes(model.group));
    return preferred.slice(0, 8);
  }

  function selectedCompareModels(panel) {
    return [...panel.querySelectorAll('input[name="compareModel"]:checked')].map((input) => input.value);
  }

  function enforceCompareLimit(panel, changed) {
    const selected = selectedCompareModels(panel);
    if (selected.length <= 3) return;
    changed.checked = false;
    window.alert("一次最多对比 3 个模型，避免误提交过多 API 请求。");
  }

  function waitForRun(modelId, trigger, timeoutMs = 10 * 60 * 1000) {
    return new Promise((resolve, reject) => {
      let runId = null;
      let finished = false;
      const startedAt = Date.now();
      const unsubscribe = TRACKER.subscribe(({ type, run }) => {
        if (!runId && type === "start" && run.task === "t2i" && run.modelId === modelId && run.startedAt >= startedAt - 200) {
          runId = run.id;
        }
        if (runId && run.id === runId && type === "finish") {
          finished = true;
          unsubscribe();
          clearTimeout(timer);
          resolve(run);
        }
      });
      const timer = setTimeout(() => {
        if (finished) return;
        unsubscribe();
        reject(new Error(`${modelId} 对比等待超时；为避免重复提交，已停止后续模型对比。`));
      }, timeoutMs);
      try { trigger(); }
      catch (error) {
        unsubscribe();
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  function newOutputItems(before) {
    return [...document.querySelectorAll("#output .item")].filter((node) => !before.has(node));
  }

  async function runComparison(panel) {
    const prompt = $("zPrompt")?.value?.trim();
    if (!prompt) {
      window.alert("请先填写文生图 Prompt。");
      return;
    }
    const models = selectedCompareModels(panel);
    if (models.length < 2) {
      window.alert("请至少选择 2 个模型进行对比。");
      return;
    }
    const select = $("mmT2IModel");
    const button = $("btnZRun");
    if (!select || !button) return;
    const available = models.filter((id) => [...select.options].some((option) => option.value === id));
    if (available.length < 2) {
      window.alert("可用模型不足 2 个，请刷新页面后重试。");
      return;
    }
    const ok = window.confirm(`将按顺序真实提交 ${available.length} 次文生图 API 请求，并可能消耗体验额度或产生费用。\n\n模型：${available.join("、")}\n\n是否继续？`);
    if (!ok) return;

    const runButton = panel.querySelector(".model-compare-run");
    const status = panel.querySelector(".model-compare-status");
    const originalModel = select.value;
    const nInput = $("zN");
    const originalN = nInput?.value;
    panel.classList.add("model-compare-running");
    if (runButton) runButton.disabled = true;
    if (nInput) { nInput.value = "1"; dispatchInput(nInput); }

    const results = [];
    try {
      for (let i = 0; i < available.length; i++) {
        const modelId = available[i];
        if (status) status.innerHTML = `<strong>${i + 1}/${available.length}</strong> 正在生成 ${modelId}…`;
        select.value = modelId;
        dispatchInput(select);
        await new Promise((resolve) => setTimeout(resolve, 90));
        const before = new Set(document.querySelectorAll("#output .item"));
        let run;
        try {
          run = await waitForRun(modelId, () => button.click());
        } catch (error) {
          results.push({ modelId, state: "timeout", message: String(error.message || error) });
          if (status) status.textContent = String(error.message || error);
          break;
        }
        for (const item of newOutputItems(before)) item.classList.add("compare-result-item");
        results.push({ modelId, state: run.state, message: run.message || "" });
      }
    } finally {
      select.value = originalModel;
      dispatchInput(select);
      if (nInput && originalN != null) { nInput.value = originalN; dispatchInput(nInput); }
      panel.classList.remove("model-compare-running");
      if (runButton) runButton.disabled = false;
    }

    if (status) {
      const summary = results.map((item) => `${item.state === "success" ? "✅" : "❌"} ${item.modelId}`).join(" · ");
      status.textContent = summary || "对比未产生结果。";
    }
  }

  function createComparePanel() {
    if ($("modelComparePanel")) return;
    const outputCard = $("output")?.closest(".card");
    if (!outputCard) return;
    const panel = document.createElement("section");
    panel.id = "modelComparePanel";
    panel.className = "model-compare-panel";
    panel.innerHTML = `
      <div class="model-compare-head">
        <div><div class="model-compare-title">文生图模型对比</div><div class="model-compare-sub">使用同一个 Prompt 顺序调用 2–3 个模型，结果直接进入右侧 Output 与生成历史。每个模型都会提交真实 API 请求。</div></div>
      </div>
      <div class="model-compare-models"></div>
      <div class="model-compare-footer"><div class="model-compare-status">建议优先比较已验证或推荐模型。</div><button type="button" class="btn primary model-compare-run">开始对比</button></div>
    `;
    const anchor = $("workspacePreviewSummary") || outputCard.firstChild;
    if (anchor?.nextSibling) outputCard.insertBefore(panel, anchor.nextSibling);
    else outputCard.appendChild(panel);

    const modelsBox = panel.querySelector(".model-compare-models");
    const defaults = new Set(["Qwen-Image-2512", "z-image-turbo"]);
    for (const model of compareModels()) {
      const label = document.createElement("label");
      label.className = "model-compare-chip";
      label.title = model.badge || model.status?.detail || model.id;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "compareModel";
      input.value = model.id;
      input.checked = defaults.has(model.id);
      input.addEventListener("change", () => enforceCompareLimit(panel, input));
      label.append(input, document.createTextNode(model.label || model.id));
      modelsBox.appendChild(label);
    }
    panel.querySelector(".model-compare-run")?.addEventListener("click", () => runComparison(panel));
    syncCompareVisibility();
  }

  function syncCompareVisibility() {
    const panel = $("modelComparePanel");
    if (panel) panel.hidden = activeTask() !== "t2i";
  }

  function init() {
    for (const task of Object.keys(TASKS)) createPromptTools(task);
    createComparePanel();
    $("modelSel")?.addEventListener("change", syncCompareVisibility);
  }

  window.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(init)));
  window.GiteeCreationTools = Object.freeze({ enhancePrompt, undoPrompt, syncCompareVisibility });
})();
