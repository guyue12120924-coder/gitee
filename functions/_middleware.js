export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const response = await context.next();

  if (request.method !== "GET") return response;
  if (url.pathname !== "/" && !url.pathname.endsWith("/index.html")) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  const scripts = [
    "model-workbench.js",
    "video-duration-fix.js",
  ];

  for (const script of scripts) {
    if (!html.includes(script)) {
      html = html.replace("</body>", `  <script src="./${script}"></script>\n</body>`);
    }
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, no-cache, must-revalidate");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
