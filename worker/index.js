const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return origin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "vary": "Origin",
      }
    : {};
}

function withCors(response, request) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, response);
}

function errorResponse(message, status, request) {
  return withCors(json({ error: message }, status), request);
}

async function hashIp(ip) {
  if (!ip) return null;
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeExtension(mime) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  }[mime];
}

async function listPhotos(env, request) {
  const result = await env.DB.prepare(
    `SELECT public_id, created_at, object_key
     FROM photos
     WHERE approved = 1
     ORDER BY created_at DESC
     LIMIT 300`
  ).all();

  const origin = new URL(request.url).origin;
  const photos = (result.results || []).map((row) => ({
    publicId: row.public_id,
    createdAt: row.created_at,
    url: `${origin}/photos/${encodeURIComponent(row.public_id)}`,
  }));

  return withCors(json({ photos }), request);
}

async function uploadPhoto(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BYTES + 1024 * 1024) {
    return errorResponse("Photo is too large. Maximum size is 15 MB.", 413, request);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return errorResponse("Upload must use multipart/form-data.", 415, request);
  }

  const form = await request.formData();
  const file = form.get("photo");
  const honeypot = form.get("website");

  if (typeof honeypot === "string" && honeypot.trim()) {
    return errorResponse("Upload rejected.", 400, request);
  }

  if (!(file instanceof File)) {
    return errorResponse("Please choose a photo.", 400, request);
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return errorResponse("Photo is too large. Maximum size is 15 MB.", 413, request);
  }

  const mime = file.type.toLowerCase();
  if (!ALLOWED_TYPES.has(mime)) {
    return errorResponse("That image type is not supported.", 415, request);
  }

  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP"));
  if (ipHash) {
    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM photos
       WHERE ip_hash = ?1
       AND created_at > datetime('now', '-5 minutes')`
    )
      .bind(ipHash)
      .first();

    if (Number(recent?.count || 0) >= 12) {
      return errorResponse("Please wait a few minutes before uploading another photo.", 429, request);
    }
  }

  const publicId = crypto.randomUUID();
  const extension = safeExtension(mime);
  const objectKey = `${publicId}.${extension}`;
  const createdAt = new Date().toISOString();

  await env.PHOTOS.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: mime,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      publicId,
      createdAt,
    },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO photos
       (public_id, object_key, created_at, bytes, mime_type, ip_hash, approved)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)`
    )
      .bind(publicId, objectKey, createdAt, file.size, mime, ipHash)
      .run();
  } catch (error) {
    await env.PHOTOS.delete(objectKey);
    console.error("D1 insert failed", error);
    return errorResponse("The photo could not be added to the wall. Please try again.", 500, request);
  }

  return withCors(
    json({
      publicId,
      createdAt,
    }, 201),
    request
  );
}

async function servePhoto(request, env, publicId) {
  if (!publicId || publicId.length > 100) {
    return new Response("Not found", { status: 404 });
  }

  const row = await env.DB.prepare(
    `SELECT object_key, mime_type
     FROM photos
     WHERE public_id = ?1 AND approved = 1
     LIMIT 1`
  )
    .bind(publicId)
    .first();

  if (!row) return new Response("Not found", { status: 404 });

  const object = await env.PHOTOS.get(row.object_key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      if (url.pathname === "/api/photos" && method === "GET") {
        return await listPhotos(env, request);
      }

      if (url.pathname === "/api/upload" && method === "POST") {
        return await uploadPhoto(request, env);
      }

      if (url.pathname.startsWith("/photos/") && method === "GET") {
        const publicId = decodeURIComponent(url.pathname.slice("/photos/".length));
        return await servePhoto(request, env, publicId);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Unhandled request error", error);
      return errorResponse("Something went wrong. Please try again.", 500, request);
    }
  },
};
