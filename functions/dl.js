export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405);
  }

  const url = new URL(request.url);
  const rawTarget = url.searchParams.get("url") || "";
  let target;
  try { target = new URL(rawTarget); }
  catch { return jsonError("Invalid or missing url param", 400); }

  if (!isAllowedTarget(target)) {
    return jsonError("Only public HTTPS download URLs are allowed", 400);
  }

  const headers = new Headers();
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);

  let upstream;
  let current = target;
  for (let hop = 0; hop < 5; hop += 1) {
    upstream = await fetch(current.toString(), {
      method: "GET",
      headers,
      redirect: "manual",
      cache: "no-store",
    });

    if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
    const location = upstream.headers.get("location");
    if (!location) break;
    let next;
    try { next = new URL(location, current); }
    catch { return jsonError("Invalid upstream redirect", 502); }
    if (!isAllowedTarget(next)) return jsonError("Blocked unsafe upstream redirect", 502);
    current = next;
  }

  if (!upstream) return jsonError("Download failed", 502);
  if ([301, 302, 303, 307, 308].includes(upstream.status)) return jsonError("Too many upstream redirects", 502);

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("Cache-Control");
  respHeaders.delete("ETag");
  respHeaders.delete("Last-Modified");
  respHeaders.delete("Expires");
  respHeaders.delete("Age");
  respHeaders.delete("Vary");
  respHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");
  respHeaders.set("Pragma", "no-cache");
  respHeaders.delete("Content-Security-Policy");
  respHeaders.delete("X-Frame-Options");
  for (const [key, value] of Object.entries(corsHeaders())) respHeaders.set(key, value);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

function isAllowedTarget(url) {
  if (!(url instanceof URL) || url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  // Result URLs are expected to use normal public hostnames. Blocking literal IPv6
  // avoids loopback, mapped-IPv4, ULA and link-local forms without relying on DNS.
  if (host.includes(":")) return false;
  if (host === "0.0.0.0") return false;
  if (isPrivateIpv4(host)) return false;
  return true;
}

function isPrivateIpv4(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224;
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Range,Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
