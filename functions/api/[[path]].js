export async function onRequest(context) {
  const { request, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const path = (params.path || []).join("/");
  const targetUrl = new URL(`https://ai.gitee.com/v1/${path}`);
  const reqUrl = new URL(request.url);
  targetUrl.search = reqUrl.search;

  // Forward only headers required by the Gitee API. This avoids leaking browser
  // cookies, Cloudflare metadata, referrers, or unrelated site headers upstream.
  const headers = new Headers();
  for (const name of ["Authorization", "Content-Type", "Accept", "Range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json, */*");

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstream = await fetch(targetUrl.toString(), init);

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("Cache-Control");
  respHeaders.delete("ETag");
  respHeaders.delete("Last-Modified");
  respHeaders.delete("Expires");
  respHeaders.delete("Age");
  respHeaders.delete("Vary");
  respHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");
  respHeaders.set("Pragma", "no-cache");
  respHeaders.set("X-Content-Type-Options", "nosniff");
  for (const [key, value] of Object.entries(corsHeaders())) respHeaders.set(key, value);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept,Range",
    "Access-Control-Max-Age": "86400",
  };
}
