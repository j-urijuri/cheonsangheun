// 천상흔 R2 업로드/미디어 Worker
// Cloudflare Worker에 그대로 붙여넣을 수 있는 모듈 형식입니다.
// R2 binding 이름은 반드시 MEDIA 로 연결하세요.

const FIREBASE_API_KEY = "AIzaSyC1AxjIRKzu1Nkg7HmkC_BN0q5Hvr5zZbM";
const ADMIN_UID = "6sT3J0gEATNU1qTKbfjWPFVEWXC3";
const ALLOWED_ORIGINS = new Set([
  "https://j-urijuri.github.io",
  "http://localhost",
  "http://127.0.0.1"
]);

function cors(origin, publicRead = false) {
  const allow = publicRead ? "*" : (ALLOWED_ORIGINS.has(origin) ? origin : "https://j-urijuri.github.io");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,HEAD,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-File-Name",
    "Access-Control-Max-Age": "86400",
    "Vary": publicRead ? "" : "Origin"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}

async function verifyAdmin(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const idToken = auth.slice(7).trim();
  if (!idToken) return false;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data?.users?.[0]?.localId === ADMIN_UID && data?.users?.[0]?.disabled !== true;
}

function safeName(raw = "file") {
  let name = raw;
  try { name = decodeURIComponent(raw); } catch {}
  return name
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100) || "file";
}

function keyFromPath(pathname) {
  return pathname.slice("/media/".length).split("/").map(x => {
    try { return decodeURIComponent(x); } catch { return x; }
  }).join("/");
}

function mediaUrl(requestUrl, key, token) {
  const u = new URL(requestUrl);
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${u.origin}/media/${encoded}?t=${encodeURIComponent(token)}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "cheonsangheun-media" }, 200, origin);
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "허용되지 않은 사이트입니다." }, 403, origin);
      if (!(await verifyAdmin(request))) return json({ error: "관리자 인증이 필요합니다." }, 401, origin);

      const type = (request.headers.get("Content-Type") || "application/octet-stream").toLowerCase();
      const size = Number(request.headers.get("Content-Length") || 0);
      const isImage = type.startsWith("image/");
      const isAudio = type.startsWith("audio/");
      if (!isImage && !isAudio) return json({ error: "이미지 또는 오디오 파일만 업로드할 수 있습니다." }, 415, origin);
      if (isImage && size && size > 20 * 1024 * 1024) return json({ error: "이미지는 20MB 이하만 가능합니다." }, 413, origin);
      if (isAudio && size && size > 50 * 1024 * 1024) return json({ error: "오디오는 50MB 이하만 가능합니다." }, 413, origin);

      const kindRaw = (url.searchParams.get("kind") || (isAudio ? "audio" : "misc")).toLowerCase();
      const allowedKinds = new Set(["characters", "story", "archive", "audio", "misc"]);
      const kind = allowedKinds.has(kindRaw) ? kindRaw : "misc";
      const name = safeName(request.headers.get("X-File-Name") || "file");
      const month = new Date().toISOString().slice(0, 7);
      const key = `${kind}/${month}/${crypto.randomUUID()}-${name}`;
      const viewToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

      await env.MEDIA.put(key, request.body, {
        httpMetadata: {
          contentType: type,
          cacheControl: "private, max-age=3600"
        },
        customMetadata: {
          visibility: "private-link",
          viewToken,
          originalName: name
        }
      });

      return json({
        ok: true,
        key,
        url: mediaUrl(request.url, key, viewToken),
        contentType: type
      }, 200, origin);
    }

    if (url.pathname.startsWith("/media/")) {
      const key = keyFromPath(url.pathname);
      if (!key) return new Response("Not found", { status: 404 });

      if (request.method === "DELETE") {
        if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "허용되지 않은 사이트입니다." }, 403, origin);
        if (!(await verifyAdmin(request))) return json({ error: "관리자 인증이 필요합니다." }, 401, origin);
        await env.MEDIA.delete(key);
        return json({ ok: true, deleted: key }, 200, origin);
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const obj = request.method === "HEAD" ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
        if (!obj) return new Response("Not found", { status: 404, headers: cors(origin, true) });
        const token = url.searchParams.get("t") || "";
        const expected = obj.customMetadata?.viewToken || "";
        const visibility = obj.customMetadata?.visibility || "private-link";
        if (visibility !== "public" && (!expected || token !== expected)) {
          return new Response("Forbidden", { status: 403, headers: cors(origin, true) });
        }
        const headers = new Headers(cors(origin, true));
        obj.writeHttpMetadata(headers);
        headers.set("ETag", obj.httpEtag);
        headers.set("Cache-Control", visibility === "public" ? "public, max-age=86400" : "private, max-age=3600");
        if (request.method === "HEAD") return new Response(null, { status: 200, headers });
        return new Response(obj.body, { status: 200, headers });
      }
    }

    return json({ error: "Not found" }, 404, origin);
  }
};
