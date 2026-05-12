export const config = { runtime: "edge" };

const TARGET = "https://ns.mgiwqlpvxy.sbs:443";

const BLOCKED_REQ = new Set([
  "host", "connection", "keep-alive", "te", "trailer",
  "transfer-encoding", "upgrade", "forwarded",
  "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
  "proxy-authenticate", "proxy-authorization",
]);

const BLOCKED_RES = new Set([
  "transfer-encoding", "connection", "keep-alive",
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = TARGET + url.pathname + url.search;

  const headers = new Headers();
  let clientIp = null;

  for (const [k, v] of req.headers) {
    const key = k.toLowerCase();
    if (BLOCKED_REQ.has(key)) continue;
    if (key.startsWith("x-vercel-")) continue;
    if (key === "x-real-ip") { clientIp = v; continue; }
    if (key === "x-forwarded-for") { if (!clientIp) clientIp = v; continue; }
    headers.set(k, v);
  }
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const method = req.method;

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      redirect: "manual",
      ...(method !== "GET" && method !== "HEAD" && {
        body: req.body,
        duplex: "half",
      }),
    });

    const out = new Headers();
    for (const [k, v] of upstream.headers) {
      if (BLOCKED_RES.has(k.toLowerCase())) continue;
      out.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  } catch {
    return new Response("Bad gateway", { status: 502 });
  }
}
