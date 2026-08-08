export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const response = await context.next();

  if (request.method !== "GET") return response;

  const isHtml = url.pathname === "/" || url.pathname.endsWith("/index.html");
  const isFrontendAsset = /\.(?:js|css)$/i.test(url.pathname);
  if (!isHtml && !isFrontendAsset) return response;

  const contentType = response.headers.get("content-type") || "";
  if (isHtml && !contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, no-cache, must-revalidate");

  if (isHtml) {
    headers.set("x-content-type-options", "nosniff");
    headers.set("x-frame-options", "DENY");
    headers.set("referrer-policy", "no-referrer");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  }

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
