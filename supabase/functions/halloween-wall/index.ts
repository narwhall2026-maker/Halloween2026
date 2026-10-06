import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BASE = "https://raw.githubusercontent.com/narwhall2026-maker/Halloween2026/main/web";
const routes: Record<string, { path: string; contentType: string }> = {
  "/": { path: "index.html", contentType: "text/html; charset=utf-8" },
  "/index.html": { path: "index.html", contentType: "text/html; charset=utf-8" },
  "/app.js": { path: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/styles.css": { path: "styles.css", contentType: "text/css; charset=utf-8" },
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const route = routes[url.pathname];
  if (!route) return new Response("Not Found", { status: 404 });

  const upstream = await fetch(`${BASE}/${route.path}`, { headers: { Accept: "*/*" }, cache: "no-store" });
  if (!upstream.ok) return new Response("Site asset unavailable", { status: 502 });

  const headers = new Headers(upstream.headers);
  headers.set("content-type", route.contentType);
  headers.set("cache-control", route.path === "index.html" ? "no-store" : "public, max-age=60");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return new Response(upstream.body, { status: 200, headers });
});
