(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SESSION_INTRO_KEY = "imageview_connection_intro_session_v1";
  const GENERATE_IDS = new Set(["btnZRun", "btnEditRun", "btnWanRun", "btnHyRun"]);
  const STATE_COPY = {
    idle: ["待检测", "输入 API Token 后检测连接"],
    ready: ["待检测", "Token 已填写，建议先检测连接"],
    checking: ["正在检测", "正在通过当前站点代理连接 Gitee AI"],
    connected: ["连接成功", "API Token 已通过连接检测"],
    invalid: ["鉴权未通过", "Token 无效或当前 Token 无此接口权限"],
    limited: ["服务受限", "服务已响应，但当前请求受到限流或额度限制"],
    unverifiable: ["服务可达", "模型列表接口不可用于验证，可继续尝试实际生成"],
    unavailable: ["服务暂不可用", "代理或 Gitee AI 当前响应异常，请稍后重试"],
    offline: ["无法连接", "当前浏览器无法访问站点 API 代理"],
    missing: ["尚未连接", "请先输入 Gitee AI API Token"],
  };

  let state = "idle";
  let lastDetail = "";
  let checking = false;
  let testedKey = "";
  let syncTimer = 0;

  function currentKey() {
    return $("apiKey")?.value?.trim() || "";
  }

  function activePrompt() {
    const value = $("modelSel")?.value || "z-image";
    const id = value === "Edit-2511" ? "editPrompt"
      : value === "Wan2.2-I2V-A14B" ? "wanPrompt"
      : value === "HunyuanVideo-1.5" ? "hyPrompt"
      : "zPrompt";
    return $(id);
  }

  function connectionLabel() {
    return STATE_COPY[state] || STATE_COPY.idle;
  }

  function updateGlobalStatus(text, kind = "info") {
    if (typeof window.setStatus === "function") window.setStatus(text, kind);
  }

  function dispatchState() {
    window.dispatchEvent(new CustomEvent("gitee-api-connection-change", {
      detail: { state, connected: state === "connected", detail: lastDetail },
    }));
  }

  function syncUi() {
    const [title, fallback] = connectionLabel();
    const status = $("apiConnectionStatus");
    const titleEl = $("apiConnectionStatusTitle");
    const detailEl = $("apiConnectionStatusDetail");
    const button = $("btnTestApiConnection");
    const next = $("apiOnboardingNext");
    const settingsButton = $("studioSettingsBtn");
    const syncButton = $("btnSyncModels");

    if (status) status.dataset.state = state;
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = lastDetail || fallback;
    if (button) {
      button.disabled = checking || !currentKey();
      button.textContent = checking ? "检测中…" : state === "connected" ? "重新检测" : "检测连接";
    }
    if (next) {
      const usable = ["connected", "unverifiable", "limited"].includes(state);
      next.hidden = !usable;
      next.textContent = state === "connected" ? "开始创作" : "继续创作";
    }
    if (syncButton) syncButton.disabled = !currentKey() || checking;
    if (settingsButton) {
      settingsButton.dataset.connectionState = state;
      settingsButton.classList.toggle("has-connection-warning", ["missing", "invalid", "offline", "unavailable"].includes(state));
      settingsButton.classList.toggle("has-connection-ok", state === "connected");
    }
  }

  function setState(next, detail = "", options = {}) {
    state = STATE_COPY[next] ? next : "idle";
    lastDetail = detail || "";
    syncUi();
    if (options.dispatch !== false) dispatchState();
  }

  function saveRememberPreference() {
    const key = currentKey();
    const remember = $("rememberKey")?.checked;
    try {
      if (remember && key) localStorage.setItem("moark_api_key", key);
      else if (!remember) localStorage.removeItem("moark_api_key");
    } catch {}
  }

  function readBodySafely(response) {
    return response.text().then((text) => {
      if (!text) return {};
      try { return JSON.parse(text); }
      catch { return { _text: text }; }
    });
  }

  function countModels(body) {
    const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
    return list.length;
  }

  async function testConnection() {
    const key = currentKey();
    if (!key) {
      setState("missing");
      focusKey();
      return { state: "missing" };
    }
    if (checking) return { state };

    checking = true;
    testedKey = key;
    setState("checking", "正在检测 /api/models，不会触发生成任务");
    updateGlobalStatus("正在检测 Gitee AI 连接…");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await readBodySafely(response);

      if (response.ok) {
        const modelCount = countModels(body);
        const detail = modelCount
          ? `Token 已通过验证 · 当前接口返回 ${modelCount} 个模型条目`
          : "Token 已通过验证 · Gitee AI 已返回成功响应";
        saveRememberPreference();
        setState("connected", detail);
        updateGlobalStatus("Gitee AI 连接成功", "ok");
        return { state: "connected", status: response.status, body };
      }

      if (response.status === 401 || response.status === 403) {
        setState("invalid", `HTTP ${response.status} · 请检查 Token，或确认该 Token 是否拥有 Serverless API 权限`);
        updateGlobalStatus("Gitee AI 鉴权未通过", "err");
        return { state: "invalid", status: response.status, body };
      }

      if (response.status === 429) {
        setState("limited", "HTTP 429 · 服务已响应，但当前请求受到限流或额度限制");
        updateGlobalStatus("Gitee AI 当前受限", "info");
        return { state: "limited", status: response.status, body };
      }

      if (response.status === 404 || response.status === 405 || response.status === 501) {
        setState("unverifiable", `HTTP ${response.status} · 当前部署的模型列表接口不可用于 Token 验证；实际生成接口仍可正常尝试`);
        updateGlobalStatus("服务可达，但无法自动验证 Token", "info");
        return { state: "unverifiable", status: response.status, body };
      }

      if (response.status >= 500) {
        setState("unavailable", `HTTP ${response.status} · 当前代理或 Gitee AI 服务响应异常`);
        updateGlobalStatus("Gitee AI 服务暂不可用", "info");
        return { state: "unavailable", status: response.status, body };
      }

      setState("unverifiable", `HTTP ${response.status} · 服务已响应，但无法仅凭模型列表接口判断 Token 是否可用于当前生成模型`);
      updateGlobalStatus("服务已响应，Token 状态待实际生成确认", "info");
      return { state: "unverifiable", status: response.status, body };
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      setState("offline", timedOut ? "连接检测超过 10 秒，请检查网络或稍后重试" : `连接失败：${String(error?.message || error)}`);
      updateGlobalStatus("无法连接站点 API 代理", "err");
      return { state: "offline", error };
    } finally {
      window.clearTimeout(timeout);
      checking = false;
      syncUi();
    }
  }

  function focusKey() {
    window.GiteeWorkspaceLayout?.openDrawer?.("settings");
    window.setTimeout(() => {
      const input = $("apiKey");
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  function continueToCreation() {
    try { sessionStorage.setItem(SESSION_INTRO_KEY, "1"); } catch {}
    window.GiteeWorkspaceLayout?.closeDrawers?.();
    window.setTimeout(() => {
      const prompt = activePrompt();
      prompt?.focus({ preventScroll: true });
      prompt?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  function toggleKeyVisibility(button) {
    const input = $("apiKey");
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.dataset.visible = showing ? "false" : "true";
    button.textContent = showing ? "显示" : "隐藏";
    button.setAttribute("aria-label", showing ? "显示 API Token" : "隐藏 API Token");
    input.focus({ preventScroll: true });
  }

  function createOnboarding() {
    const input = $("apiKey");
    const apiCard = input?.closest(".workspace-api-card,.card");
    if (!input || !apiCard || $("apiConnectionOnboarding")) return false;

    apiCard.classList.add("api-connection-card");
    const heading = apiCard.querySelector("h2");
    if (heading) heading.textContent = "连接 Gitee AI";

    const row = input.closest(".row");
    if (row) row.classList.add("api-connection-key-row");

    const intro = document.createElement("section");
    intro.id = "apiConnectionOnboarding";
    intro.className = "api-onboarding";
    intro.innerHTML = `
      <div class="api-onboarding-copy">
        <span class="api-onboarding-kicker">首次使用 · 1 / 3</span>
        <strong>先连接你的 Gitee AI Token</strong>
        <p>连接成功后，再选择创作方式、输入 Prompt 就可以生成。检测连接只读取模型列表，不会创建图片或视频任务。</p>
      </div>
      <a class="api-onboarding-link" href="https://ai.gitee.com/serverless-api" target="_blank" rel="noopener">获取 API Token ↗</a>`;
    if (row) apiCard.insertBefore(intro, row);
    else apiCard.prepend(intro);

    const status = document.createElement("div");
    status.id = "apiConnectionStatus";
    status.className = "api-connection-status";
    status.innerHTML = `
      <div class="api-connection-state"><span class="api-connection-dot" aria-hidden="true"></span><div><strong id="apiConnectionStatusTitle">待检测</strong><span id="apiConnectionStatusDetail">输入 API Token 后检测连接</span></div></div>
      <div class="api-connection-actions"><button type="button" class="btn" id="btnTestApiConnection">检测连接</button><button type="button" class="btn primary" id="apiOnboardingNext" hidden>开始创作</button></div>`;
    row?.insertAdjacentElement("afterend", status);

    const security = document.createElement("div");
    security.className = "api-security-note";
    security.innerHTML = `<span aria-hidden="true">⌁</span><span>Token 会通过当前站点的 <code>/api/*</code> 代理发送到 Gitee AI；只有勾选“记住”时才保存在当前浏览器 localStorage。</span>`;
    status.insertAdjacentElement("afterend", security);

    const reveal = document.createElement("button");
    reveal.id = "btnToggleApiKey";
    reveal.type = "button";
    reveal.className = "btn api-key-visibility";
    reveal.textContent = "显示";
    reveal.setAttribute("aria-label", "显示 API Token");
    const clear = $("btnClearKey");
    if (row) row.insertBefore(reveal, clear || row.children[1] || null);
    reveal.addEventListener("click", () => toggleKeyVisibility(reveal));

    $("btnTestApiConnection")?.addEventListener("click", () => testConnection());
    $("apiOnboardingNext")?.addEventListener("click", continueToCreation);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        testConnection();
      }
    });
    input.addEventListener("input", () => {
      if (currentKey() === testedKey && ["connected", "invalid", "unverifiable", "limited"].includes(state)) return;
      testedKey = "";
      setState(currentKey() ? "ready" : "missing");
    });
    $("rememberKey")?.addEventListener("change", saveRememberPreference);
    clear?.addEventListener("click", () => {
      testedKey = "";
      window.setTimeout(() => setState("missing"), 0);
    });

    return true;
  }

  function interceptMissingKey() {
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      if (!button || !GENERATE_IDS.has(button.id) || currentKey()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setState("missing", "生成前需要先连接 Gitee AI API Token");
      updateGlobalStatus("请先连接 Gitee AI API Token", "err");
      focusKey();
    }, true);
  }

  function maybeOpenFirstUse() {
    if (currentKey()) return;
    let shown = false;
    try { shown = sessionStorage.getItem(SESSION_INTRO_KEY) === "1"; } catch {}
    if (shown) return;
    try { sessionStorage.setItem(SESSION_INTRO_KEY, "1"); } catch {}
    window.setTimeout(() => {
      setState("missing");
      focusKey();
    }, 180);
  }

  function scheduleUiSync(delay = 0) {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      if (!createOnboarding()) return;
      const key = currentKey();
      if (state === "idle") setState(key ? "ready" : "missing", "", { dispatch: false });
      else syncUi();
    }, delay);
  }

  function injectStyles() {
    if ($("apiConnectionStyles")) return;
    const style = document.createElement("style");
    style.id = "apiConnectionStyles";
    style.textContent = `
      .api-connection-card>h2{font-size:13px;margin:0 0 10px}.api-onboarding{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 12px;padding:12px;border:1px solid color-mix(in srgb,var(--accent) 18%,var(--border-light));border-radius:12px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 6%,var(--card)),var(--studio-soft))}
      .api-onboarding-copy{display:grid;gap:3px;min-width:0}.api-onboarding-kicker{color:var(--accent);font-size:9px;font-weight:800;letter-spacing:.06em}.api-onboarding-copy>strong{font-size:12px;color:var(--text)}.api-onboarding-copy>p{margin:0;color:var(--muted);font-size:10px;line-height:1.5}.api-onboarding-link{flex:0 0 auto;color:var(--accent);font-size:9.5px;font-weight:750;text-decoration:none;white-space:nowrap}.api-onboarding-link:hover{text-decoration:underline}
      .api-connection-key-row{align-items:center!important;gap:7px!important}.api-connection-key-row #apiKey{flex:1 1 180px;min-width:0}.api-key-visibility{flex:0 0 auto;min-width:44px;padding-inline:9px!important}
      .api-connection-status{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:10px 11px;border:1px solid var(--border-light);border-radius:11px;background:var(--studio-soft)}.api-connection-state{display:flex;align-items:center;gap:8px;min-width:0}.api-connection-dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:var(--muted);box-shadow:0 0 0 3px color-mix(in srgb,var(--muted) 12%,transparent)}.api-connection-state>div{display:grid;gap:2px;min-width:0}.api-connection-state strong{font-size:10.5px;color:var(--text)}.api-connection-state span{font-size:9px;line-height:1.35;color:var(--muted)}.api-connection-actions{display:flex;gap:6px;flex:0 0 auto}.api-connection-actions .btn{white-space:nowrap}
      .api-connection-status[data-state="checking"] .api-connection-dot{background:#f59e0b;animation:apiPulse 1s ease-in-out infinite}.api-connection-status[data-state="connected"] .api-connection-dot{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.12)}.api-connection-status[data-state="connected"]{border-color:rgba(34,197,94,.24);background:rgba(34,197,94,.055)}.api-connection-status[data-state="invalid"] .api-connection-dot,.api-connection-status[data-state="missing"] .api-connection-dot,.api-connection-status[data-state="offline"] .api-connection-dot{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.10)}.api-connection-status[data-state="limited"] .api-connection-dot,.api-connection-status[data-state="unverifiable"] .api-connection-dot,.api-connection-status[data-state="unavailable"] .api-connection-dot{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.10)}
      .api-security-note{display:flex;align-items:flex-start;gap:6px;margin-top:8px;color:var(--muted);font-size:8.8px;line-height:1.45}.api-security-note code{font-size:.95em;color:var(--text)}
      #studioSettingsBtn{position:relative}#studioSettingsBtn.has-connection-ok::after,#studioSettingsBtn.has-connection-warning::after{content:"";position:absolute;right:5px;top:5px;width:6px;height:6px;border-radius:50%;border:1px solid var(--card)}#studioSettingsBtn.has-connection-ok::after{background:#22c55e}#studioSettingsBtn.has-connection-warning::after{background:#ef4444}
      @keyframes apiPulse{0%,100%{opacity:.5;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
      @media(max-width:560px){.api-onboarding{display:grid}.api-onboarding-link{justify-self:start}.api-connection-key-row{display:grid!important;grid-template-columns:1fr auto auto}.api-connection-key-row #apiKey{grid-column:1/-1;width:100%}.api-connection-key-row .chk{grid-column:1/2}.api-connection-status{display:grid}.api-connection-actions{width:100%}.api-connection-actions .btn{flex:1}.api-connection-state span{white-space:normal}}
      @media(prefers-reduced-motion:reduce){.api-connection-status[data-state="checking"] .api-connection-dot{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    interceptMissingKey();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduleUiSync(0);
      window.setTimeout(maybeOpenFirstUse, 40);
    }));
    window.addEventListener("gitee-studio-drawer-open", (event) => {
      if (event.detail?.name === "settings") scheduleUiSync(0);
    });
  }

  window.GiteeApiConnection = Object.freeze({
    test: testConnection,
    getState: () => ({ state, detail: lastDetail, connected: state === "connected" }),
    focus: focusKey,
    sync: () => scheduleUiSync(0),
  });

  window.addEventListener("DOMContentLoaded", init);
})();