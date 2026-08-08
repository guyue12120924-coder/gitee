export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const response = await context.next();

  if (request.method !== "GET") return response;
  if (url.pathname !== "/" && !url.pathname.endsWith("/index.html")) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store, no-cache, must-revalidate");

  return new Response(await response.text(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
