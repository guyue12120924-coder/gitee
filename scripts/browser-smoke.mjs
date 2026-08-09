import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const chromePath = process.env.CHROME_PATH || undefined;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safePath(urlPath) {
  const pathname = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep) && full !== path.resolve(root, "index.html")) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const full = safePath(req.url);
  if (!full || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": mime[path.extname(full).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(full).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromePath });

const viewports = [
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1536", width: 1536, height: 864 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
];

const workflows = [
  ["z-image", "t2i"],
  ["Edit-2511", "edit"],
  ["Wan2.2-I2V-A14B", "i2v"],
  ["HunyuanVideo-1.5", "t2v"],
];

async function visibleBox(locator) {
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  assert(box, `Missing bounding box for ${locator}`);
  return box;
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: "load" });
  await page.locator("#workspaceShell").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(250);

  assert(pageErrors.length === 0, `${viewport.name}: page errors: ${pageErrors.join(" | ")}`);
  const relevantConsoleErrors = consoleErrors.filter((text) => !/favicon/i.test(text));
  assert(relevantConsoleErrors.length === 0, `${viewport.name}: console errors: ${relevantConsoleErrors.join(" | ")}`);

  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(overflow.scroll <= overflow.width + 2, `${viewport.name}: horizontal overflow ${overflow.scroll} > ${overflow.width}`);

  const railButtons = page.locator(".workspace-rail-button[data-function-value]");
  assert(await railButtons.count() === 4, `${viewport.name}: expected four workflow buttons`);
  for (let i = 0; i < 4; i += 1) {
    const box = await visibleBox(railButtons.nth(i));
    assert(box.x >= -1 && box.x + box.width <= viewport.width + 1, `${viewport.name}: workflow button ${i} exceeds viewport`);
  }

  for (const [value, task] of workflows) {
    await page.locator(`.workspace-rail-button[data-function-value="${value}"]`).click();
    await page.waitForTimeout(120);
    const state = await page.evaluate(() => ({
      selector: document.getElementById("modelSel")?.value,
      workflow: document.body.dataset.studioWorkflow,
      title: document.getElementById("workspaceInspectorTitle")?.textContent?.trim(),
    }));
    assert(state.selector === value, `${viewport.name}: workflow selector did not switch to ${value}`);
    assert(state.workflow === task, `${viewport.name}: body workflow expected ${task}, got ${state.workflow}`);
    assert(Boolean(state.title), `${viewport.name}: inspector title missing for ${value}`);
  }

  await page.locator('.workspace-rail-button[data-function-value="Edit-2511"]').click();
  await page.waitForTimeout(100);
  assert(await page.locator(".studio-edit-upload-stack .studio-upload-card").count() === 2, `${viewport.name}: edit upload cards missing`);

  await page.locator('.workspace-rail-button[data-function-value="Wan2.2-I2V-A14B"]').click();
  await page.waitForTimeout(120);
  assert(await page.locator(".studio-i2v-upload-stack .studio-upload-card").count() === 1, `${viewport.name}: I2V upload card missing`);
  assert(await page.locator("#studioWanFormat").count() === 1, `${viewport.name}: Wan friendly format controls missing`);

  await page.locator('.workspace-rail-button[data-function-value="HunyuanVideo-1.5"]').click();
  await page.waitForTimeout(120);
  assert(await page.locator("#studioHunyuanDuration").count() === 1, `${viewport.name}: Hunyuan duration control missing`);

  await page.locator('.workspace-rail-button[data-function-value="z-image"]').click();
  await page.waitForTimeout(120);

  const prompt = page.locator("#zPrompt");
  const generate = page.locator("#btnZRun");
  await prompt.focus();
  const generateBox = await visibleBox(generate);
  assert(generateBox.y < viewport.height && generateBox.y + Math.min(generateBox.height, 12) > 0, `${viewport.name}: Generate is not reachable after prompt focus`);

  if (viewport.width <= 900) {
    const params = page.locator(".studio-inspector-toggle");
    await params.click();
    assert(await page.evaluate(() => document.body.classList.contains("studio-inspector-open")), `${viewport.name}: parameter Bottom Sheet did not open`);
    const inspector = await visibleBox(page.locator("#workspaceInspector"));
    assert(inspector.x >= -1 && inspector.x + inspector.width <= viewport.width + 1, `${viewport.name}: inspector exceeds viewport width`);
    await page.locator("#studioInspectorMask").click({ position: { x: 2, y: 2 } });
    await page.waitForTimeout(80);
    assert(!(await page.evaluate(() => document.body.classList.contains("studio-inspector-open"))), `${viewport.name}: inspector mask did not close sheet`);
  } else {
    const composerBox = await visibleBox(page.locator("#workspaceComposer"));
    const inspectorBox = await visibleBox(page.locator("#workspaceInspector"));
    assert(composerBox.x + composerBox.width <= inspectorBox.x + 3, `${viewport.name}: desktop Composer overlaps Inspector`);
  }

  if (viewport.width <= 900) {
    await page.locator(".studio-inspector-toggle").click();
    await page.waitForTimeout(80);
  }
  const activePicker = page.locator(".workspace-inspector-panel:not([hidden]) .studio-model-trigger");
  await activePicker.click();
  await page.waitForTimeout(120);
  const menu = page.locator(".workspace-inspector-panel:not([hidden]) .studio-model-menu");
  const menuBox = await visibleBox(menu);
  assert(menuBox.x >= -1 && menuBox.x + menuBox.width <= viewport.width + 1, `${viewport.name}: model menu exceeds viewport width`);
  assert(menuBox.y >= -1 && menuBox.y + Math.min(menuBox.height, 20) <= viewport.height + 1, `${viewport.name}: model menu starts outside viewport`);
  if (viewport.width <= 900) {
    const focusedSearch = await page.evaluate(() => document.activeElement?.classList?.contains("studio-model-search"));
    assert(!focusedSearch, `${viewport.name}: model menu forced search focus on mobile`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);

  await page.evaluate(() => {
    const output = document.getElementById("output");
    const make = (index) => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `<h3>文生图测试 ${index}</h3><img alt="smoke ${index}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%236366f1'/%3E%3C/svg%3E">`;
      output.appendChild(item);
      return item;
    };
    make(1);
  });
  await page.waitForTimeout(250);
  assert(await page.locator("#output").evaluate((el) => el.classList.contains("studio-gallery-one")), `${viewport.name}: single-result Focus class missing`);
  await page.locator("#output .item img").first().click();
  await page.waitForTimeout(100);
  assert(await page.locator("#studioLightbox").evaluate((el) => el.classList.contains("is-open")), `${viewport.name}: Lightbox did not open`);
  await page.locator("#studioLightbox .studio-lightbox-close").click();

  await page.evaluate(() => {
    const output = document.getElementById("output");
    for (const index of [2, 3]) {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `<h3>文生图测试 ${index}</h3><img alt="smoke ${index}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%236366f1'/%3E%3C/svg%3E">`;
      output.appendChild(item);
    }
  });
  await page.waitForTimeout(250);
  assert(await page.locator("#output").evaluate((el) => el.classList.contains("studio-gallery-many")), `${viewport.name}: 3+ Gallery class missing`);

  if (viewport.width <= 900 && await page.evaluate(() => document.body.classList.contains("studio-inspector-open"))) {
    await page.locator("#studioInspectorMask").click({ position: { x: 2, y: 2 } });
    await page.waitForTimeout(60);
  }

  for (const drawerName of ["tasks", "history", "settings"]) {
    const trigger = page.locator(`[data-drawer="${drawerName}"]:visible`).first();
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(100);
      const drawer = page.locator(`#studioDrawer-${drawerName}`);
      assert(await drawer.evaluate((el) => el.classList.contains("is-open")), `${viewport.name}: ${drawerName} drawer did not open`);
      await drawer.locator(".studio-drawer-close").click();
      await page.waitForTimeout(80);
    }
  }

  console.log(`browser-smoke ${viewport.name}: ok`);
  await context.close();
}

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log("Browser smoke passed for all configured viewports.");
