import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const notes = [];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const jsFiles = files.filter((file) => file.endsWith(".js") || file.endsWith(".mjs"));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`JavaScript syntax: ${path.relative(root, file)}\n${result.stderr || result.stdout}`);
}
notes.push(`checked ${jsFiles.length} JavaScript files`);

const versionPath = path.join(root, "VERSION");
const readmePath = path.join(root, "README.md");
const changelogPath = path.join(root, "CHANGELOG.md");
if (!fs.existsSync(versionPath)) failures.push("Release VERSION file is missing");
if (!fs.existsSync(changelogPath)) failures.push("CHANGELOG.md is missing");
const version = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, "utf8").trim() : "";
if (version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) failures.push(`VERSION is not valid semver: ${version}`);
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
if (version && !readme.includes(`v${version}`)) failures.push(`README does not advertise v${version}`);
if (version && !changelog.includes(`[${version}]`)) failures.push(`CHANGELOG does not contain ${version}`);
if (readme.includes("第五阶段完成后") || readme.includes("第五阶段新增")) failures.push("README still contains stale phase-specific release wording");
notes.push(`release ${version || "unknown"}`);

const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const localRefs = [...html.matchAll(/(?:src|href)=["']\.\/([^"'#?]+)["']/g)].map((match) => match[1]);
for (const ref of localRefs) {
  if (!fs.existsSync(path.join(root, ref))) failures.push(`Missing local asset referenced by index.html: ${ref}`);
}
notes.push(`checked ${localRefs.length} local index.html assets`);

const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) failures.push(`Duplicate static HTML ids: ${duplicateIds.join(", ")}`);
notes.push(`checked ${ids.length} static HTML ids`);

for (const stylesheet of ["styles.css", "workspace.css", "creation-tools.css", "studio-extras.css", "product-polish.css", "workflow-polish.css", "mobile-polish.css"]) {
  if (!html.includes(`href="./${stylesheet}"`)) failures.push(`Missing stylesheet in index.html: ${stylesheet}`);
}
if (!html.includes('id="apiKey" class="input" type="password"')) failures.push("API key must be masked in the static HTML before UI enhancement loads");
if (!html.includes('loading="lazy" decoding="async" fetchpriority="low"')) failures.push("Hidden donation media should stay off the critical rendering path");
if (!html.includes("viewport-fit=cover") || !html.includes("interactive-widget=resizes-content")) failures.push("Mobile viewport must support safe areas and keyboard-resized content");

const requiredOrder = [
  "app.js",
  "js/models/registry.js",
  "js/adapters/adapter-registry.js",
  "js/adapters/image-adapters.js",
  "js/adapters/video-adapters.js",
  "multi-model.js",
  "js/runtime/model-runtime.js",
  "js/ui/model-parameter-ui.js",
  "js/runtime/task-tracker.js",
  "js/storage/history-store.js",
  "js/ui/task-center.js",
  "js/ui/history-center.js",
  "js/ui/workspace-layout.js",
  "js/ui/creation-tools.js",
  "js/ui/studio-extras.js",
  "js/ui/product-polish.js",
  "js/ui/workflow-polish.js",
  "js/ui/mobile-polish.js",
];
let previous = -1;
for (const file of requiredOrder) {
  const index = html.indexOf(`src="./${file}"`);
  if (index < 0) failures.push(`Missing required script in index.html: ${file}`);
  else if (index <= previous) failures.push(`Incorrect script dependency order around: ${file}`);
  previous = Math.max(previous, index);
}

const forbiddenLegacy = [
  "multi-model-hotfix.js",
  "model-workbench.js",
  "video-duration-fix.js",
  "video-catalog-fix.js",
];
for (const file of forbiddenLegacy) {
  if (fs.existsSync(path.join(root, file))) failures.push(`Legacy patch file should stay deleted: ${file}`);
  if (html.includes(file)) failures.push(`Legacy patch file is still referenced: ${file}`);
}

const workspace = fs.readFileSync(path.join(root, "js/ui/workspace-layout.js"), "utf8");
for (const marker of ["workspace-rail", "workspace-inspector", "workspace-composer", "studio-drawer", "workspace-preview-actions", "studio-model-developer-tools"]) {
  if (!workspace.includes(marker)) failures.push(`Creator-first workspace marker missing: ${marker}`);
}
if (workspace.includes("studioQuickModel")) failures.push("Bottom composer must not duplicate the model selector");
if (!workspace.includes("enhanceOutputItem")) failures.push("Workspace gallery enhancement is missing");
if (!workspace.includes("studio-output-debug")) failures.push("Raw output JSON must be collapsed behind debug details");
if (!workspace.includes('history.dataset.drawer = "history"')) failures.push("Desktop rail should keep a single history utility entry");
if (!workspace.includes("utilityObserver?.disconnect()")) failures.push("Temporary utility-panel observer must disconnect after adoption");
if (!workspace.includes('gitee-studio-drawer-open')) failures.push("Workspace drawer lifecycle event is missing");
if (!workspace.includes('image.loading = "lazy"') || !workspace.includes('video.preload = "metadata"')) failures.push("Generated media should use lazy image decoding and metadata-only video preload");

const workspaceCss = fs.readFileSync(path.join(root, "workspace.css"), "utf8");
for (const marker of [".workspace-rail", ".workspace-inspector", ".workspace-composer", ".studio-drawer", ".studio-lightbox"]) {
  if (!workspaceCss.includes(marker)) failures.push(`Workspace CSS marker missing: ${marker}`);
}
if (!workspaceCss.includes("@media (max-width: 900px)")) failures.push("Mobile studio breakpoint is missing");

const studioCss = fs.readFileSync(path.join(root, "studio-extras.css"), "utf8");
if (!studioCss.includes("#modelComparePanel:not([open])")) failures.push("Collapsed model comparison should not occupy canvas space");
if (!studioCss.includes(".studio-history-top-action")) failures.push("Responsive history navigation rule is missing");
if (!studioCss.includes(".workspace-composer-input")) failures.push("Compact prompt composer override is missing");
if (!studioCss.includes(".studio-model-developer-tools")) failures.push("Inspector technical details must be progressive-disclosure content");

const productCss = fs.readFileSync(path.join(root, "product-polish.css"), "utf8");
for (const marker of [".studio-gallery-one", ".studio-gallery-two", ".studio-model-selector", ".studio-model-menu", ".studio-product-settings", ".studio-theme-segment", ".studio-lightbox-actions"]) {
  if (!productCss.includes(marker)) failures.push(`Product polish CSS marker missing: ${marker}`);
}

const productUi = fs.readFileSync(path.join(root, "js/ui/product-polish.js"), "utf8");
for (const marker of ["setupFocusGallery", "setupUnifiedIcons", "decorateModelSelect", "setupModelSelectors", "buildSettings", "applyThemeMode", "syncLightboxActions"]) {
  if (!productUi.includes(marker)) failures.push(`Product polish behavior missing: ${marker}`);
}
if (!productUi.includes("moark_theme_mode")) failures.push("Settings must persist system/light/dark appearance mode");
if (!productUi.includes("REGISTRY?.model")) failures.push("Custom model picker must read model metadata from Registry");
if (!productUi.includes("studio-download-action")) failures.push("Gallery overlay must preserve direct download access");
if (!productUi.includes('if (next) rebuildModelMenu(select, picker);')) failures.push("Model menus should be built lazily on first open");
if (productUi.includes('observe(output, { childList: true, subtree: true })')) failures.push("Gallery observer must stay top-level child-list-only");
if (productUi.includes('observe(document.body, { childList: true })')) failures.push("Lightbox actions must not rely on a persistent body observer");
if (productUi.includes("setInterval(() =>")) failures.push("Settings initialization should not poll the DOM with a repeated interval");

const workflowCss = fs.readFileSync(path.join(root, "workflow-polish.css"), "utf8");
for (const marker of [".studio-upload-card", ".studio-human-duration", ".studio-friendly-options", ".studio-technical-primary-hidden", ".workspace-ready .global-loading"]) {
  if (!workflowCss.includes(marker)) failures.push(`Workflow polish CSS marker missing: ${marker}`);
}
if (!workflowCss.includes("grid-row: 1 / 3")) failures.push("Desktop Inspector must span the Canvas and Composer rows");
if (!workflowCss.includes("grid-column: 2 !important")) failures.push("Desktop Composer must stay under Canvas only");

const workflowUi = fs.readFileSync(path.join(root, "js/ui/workflow-polish.js"), "utf8");
for (const marker of ["reorderWorkflowInputs", "ensureHunyuanDuration", "ensureWanFormatControls", "setupWorkflowOutputViews", "setupTaskButtonProgress"]) {
  if (!workflowUi.includes(marker)) failures.push(`Workflow polish behavior missing: ${marker}`);
}
if (!workflowUi.includes('item.dataset.studioWorkflow')) failures.push("Output items must be assigned to a workflow-specific Canvas view");
if (!workflowUi.includes('studio-gallery-one') || !workflowUi.includes('studio-gallery-two') || !workflowUi.includes('studio-gallery-many')) failures.push("Workflow-specific Canvas must own gallery layout classes");
if (!workflowUi.includes('new MutationObserver') || !workflowUi.includes('observe(output, { childList: true })')) failures.push("Output view observer must stay child-list-only to avoid feedback loops");
if (workflowUi.includes('observe($("workspaceInspectorHost")') || workflowUi.includes('observe(document.body, { childList: true, subtree: true })')) failures.push("Workflow polish must not add broad subtree observers");

const mobileCss = fs.readFileSync(path.join(root, "mobile-polish.css"), "utf8");
for (const marker of ["--studio-mobile-vh", ".studio-inspector-mask", ".studio-keyboard-open", "env(safe-area-inset-bottom)", "@media (max-width: 430px)"]) {
  if (!mobileCss.includes(marker)) failures.push(`Mobile polish CSS marker missing: ${marker}`);
}
const mobileUi = fs.readFileSync(path.join(root, "js/ui/mobile-polish.js"), "utf8");
for (const marker of ["visualViewport", "setupMobileSheetBehavior", "setupKeyboardBehavior", "studioInspectorMask", "studio-keyboard-open"]) {
  if (!mobileUi.includes(marker)) failures.push(`Mobile polish behavior missing: ${marker}`);
}
if (mobileUi.includes("MutationObserver")) failures.push("Mobile polish must stay event-driven and avoid DOM observers");
if (!mobileUi.includes("interactive-widget=resizes-content") || !mobileUi.includes("viewport-fit=cover")) failures.push("Mobile runtime viewport hardening is missing");

const historyCenter = fs.readFileSync(path.join(root, "js/ui/history-center.js"), "utf8");
if (!historyCenter.includes("requestIdleCallback")) failures.push("History should defer hidden initial rendering when the browser is busy");
if (!historyCenter.includes('gitee-studio-drawer-open')) failures.push("History should refresh on drawer lifecycle instead of continuously while hidden");
if (!historyCenter.includes("listEl.replaceChildren(fragment)")) failures.push("History DOM updates should be batched through a DocumentFragment");
if (historyCenter.includes("__giteeHistorySearchTimer")) failures.push("History search debounce state should stay module-scoped instead of leaking onto window");

const taskTracker = fs.readFileSync(path.join(root, "js/runtime/task-tracker.js"), "utf8");
if (!taskTracker.includes("if (!run || run.finishedAt) return;")) failures.push("Task tracker must ignore updates after terminal state");
if (!taskTracker.includes("inferTask(")) failures.push("Task tracker request attribution helper is missing");
if (!taskTracker.includes("activeRunForDownload")) failures.push("Task tracker download attribution helper is missing");

const historyStore = fs.readFileSync(path.join(root, "js/storage/history-store.js"), "utf8");
if (!historyStore.includes("mergeRecords")) failures.push("History store must merge IndexedDB and localStorage fallback records");
if (!historyStore.includes("removeFallback")) failures.push("History store must clean stale fallback duplicates");

const modelRuntime = fs.readFileSync(path.join(root, "js/runtime/model-runtime.js"), "utf8");
if (!modelRuntime.includes("body?.image || body?.first_frame || body?.image_url")) failures.push("Model runtime must infer I2V/T2V from request payload");
if (!modelRuntime.includes("el.replaceChildren(strong, span)")) failures.push("Model health details must be rendered without provider-controlled innerHTML");
if (!modelRuntime.includes("shouldRecordDetectedHealth")) failures.push("Model health must filter user/auth/network failures");

const multiModel = fs.readFileSync(path.join(root, "multi-model.js"), "utf8");
if (!multiModel.includes("acceptedWithoutRecognizedResult")) failures.push("Ambiguous accepted responses must stop compatibility retries");
if (!multiModel.includes("if (res.ok || !last.retryable) break;")) failures.push("Edit/I2V compatibility loops must stop immediately after accepted or non-retryable responses");
if (!multiModel.includes("if (res.ok || !last.retryable) break outer;")) failures.push("T2V compatibility loop must stop immediately after accepted or non-retryable responses");

const creationTools = fs.readFileSync(path.join(root, "js/ui/creation-tools.js"), "utf8");
if (!creationTools.includes("一次最多对比 3 个模型")) failures.push("Model comparison API-call limit is missing");
if (!creationTools.includes("真实提交")) failures.push("Model comparison cost/real-request confirmation is missing");
if (!creationTools.includes('document.createElement("details")')) failures.push("Model comparison should stay collapsed by default");
if (!creationTools.includes('input.type = "password"')) failures.push("API key input must be masked by the final UI layer");
if (!creationTools.includes("URL.revokeObjectURL")) failures.push("Output clear must release local blob URLs");

const studioExtras = fs.readFileSync(path.join(root, "js/ui/studio-extras.js"), "utf8");
if (!studioExtras.includes("DataTransfer")) failures.push("Generated image reuse must populate edit/video file inputs without manual re-upload");
if (!studioExtras.includes("ctrlKey") || !studioExtras.includes("metaKey")) failures.push("Creator keyboard shortcut support is missing");
if (!studioExtras.includes("studioTaskBtn")) failures.push("Compact task badge support is missing");
if (!studioExtras.includes("setupPromptAutosize")) failures.push("Prompt composer auto-resize is missing");

const downloadProxy = fs.readFileSync(path.join(root, "functions/dl.js"), "utf8");
if (!downloadProxy.includes('url.protocol !== "https:"')) failures.push("Download proxy must require HTTPS targets");
if (!downloadProxy.includes('redirect: "manual"')) failures.push("Download proxy must validate redirects manually");
if (!downloadProxy.includes("isPrivateIpv4")) failures.push("Download proxy private-network guard is missing");
if (!downloadProxy.includes('host.includes(":")')) failures.push("Download proxy literal IPv6 guard is missing");

const apiProxy = fs.readFileSync(path.join(root, "functions/api/[[path]].js"), "utf8");
if (apiProxy.includes("new Headers(request.headers)")) failures.push("API proxy must not forward all browser headers upstream");
if (!apiProxy.includes('["Authorization", "Content-Type", "Accept", "Range"]')) failures.push("API proxy header allowlist is missing");
if (!apiProxy.includes("isSafeSegment")) failures.push("API proxy must validate path segments before building the upstream URL");
if (!apiProxy.includes("encodeURIComponent(segment)")) failures.push("API proxy must encode upstream path segments");

const middleware = fs.readFileSync(path.join(root, "functions/_middleware.js"), "utf8");
for (const header of ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]) {
  if (!middleware.includes(header)) failures.push(`Homepage security header missing: ${header}`);
}

console.log(`Static audit: ${notes.join("; ")}`);
if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`\n- ${failure}`);
  process.exit(1);
}
console.log("Static audit passed.");
