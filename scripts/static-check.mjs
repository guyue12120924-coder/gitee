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

for (const stylesheet of ["styles.css", "workspace.css", "creation-tools.css"]) {
  if (!html.includes(`href="./${stylesheet}"`)) failures.push(`Missing stylesheet in index.html: ${stylesheet}`);
}

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

const creationCss = fs.readFileSync(path.join(root, "creation-tools.css"), "utf8");
if (!creationCss.includes("workspace-preview-summary + .model-compare-panel + .row")) failures.push("Sticky preview toolbar override is missing");

const creationTools = fs.readFileSync(path.join(root, "js/ui/creation-tools.js"), "utf8");
if (!creationTools.includes("一次最多对比 3 个模型")) failures.push("Model comparison API-call limit is missing");
if (!creationTools.includes("真实提交")) failures.push("Model comparison cost/real-request confirmation is missing");
if (!creationTools.includes('input.type = "password"')) failures.push("API key input must be masked by the final UI layer");
if (!creationTools.includes("URL.revokeObjectURL")) failures.push("Output clear must release local blob URLs");

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
