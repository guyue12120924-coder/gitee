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

const historyStore = fs.readFileSync(path.join(root, "js/storage/history-store.js"), "utf8");
if (!historyStore.includes("mergeRecords")) failures.push("History store must merge IndexedDB and localStorage fallback records");

const workspaceCss = fs.readFileSync(path.join(root, "creation-tools.css"), "utf8");
if (!workspaceCss.includes("workspace-preview-summary + .model-compare-panel + .row")) failures.push("Sticky preview toolbar override is missing");

console.log(`Static audit: ${notes.join("; ")}`);
if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`\n- ${failure}`);
  process.exit(1);
}
console.log("Static audit passed.");
