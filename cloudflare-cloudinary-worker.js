const 허용주소 = "https://j-urijuri.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== 허용주소) return 응답({ error: "허용되지 않은 주소입니다." }, 403, origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/") {
        return 응답({ ok: true, message: "천상흔 업로드 서버가 작동 중입니다." }, 200, origin);
      }
      if (request.method === "POST" && url.pathname === "/sign-upload") {
        await 관리자확인(request, env);
        const body = await request.json().catch(() => ({}));
        const folder = 폴더정리(body.folder || "기타");
        const publicId = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const timestamp = Math.floor(Date.now() / 1000);
        const params = { public_id: publicId, timestamp };
        const signature = await 서명만들기(params, env.CLOUDINARY_API_SECRET);
        return 응답({
          ok: true,
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          timestamp,
          signature,
          publicId,
          uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
        }, 200, origin);
      }
      if (request.method === "POST" && url.pathname === "/delete") {
        await 관리자확인(request, env);
        const body = await request.json().catch(() => ({}));
        const publicId = String(body.public_id || "").trim();
        const resourceType = String(body.resource_type || "image").trim();
        if (!publicId) return 응답({ error: "public_id가 없습니다." }, 400, origin);
        if (!["image", "video", "raw"].includes(resourceType)) return 응답({ error: "잘못된 파일 종류입니다." }, 400, origin);
        const timestamp = Math.floor(Date.now() / 1000);
        const params = { invalidate: "true", public_id: publicId, timestamp };
        const signature = await 서명만들기(params, env.CLOUDINARY_API_SECRET);
        const form = new FormData();
        form.append("public_id", publicId);
        form.append("timestamp", String(timestamp));
        form.append("invalidate", "true");
        form.append("api_key", env.CLOUDINARY_API_KEY);
        form.append("signature", signature);
        const result = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`, { method: "POST", body: form });
        const data = await result.json();
        if (!result.ok) return 응답({ error: "Cloudinary 파일 삭제 실패", detail: data }, result.status, origin);
        return 응답({ ok: true, result: data.result }, 200, origin);
      }
      return 응답({ error: "존재하지 않는 경로입니다." }, 404, origin);
    } catch (error) {
      return 응답({ error: error?.message || "서버 오류가 발생했습니다." }, error?.status || 500, origin);
    }
  },
};

async function 관리자확인(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw 오류("로그인이 필요합니다.", 401);
  const idToken = auth.slice(7).trim();
  if (!idToken) throw 오류("로그인 토큰이 없습니다.", 401);
  const firebaseRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken })
  });
  if (!firebaseRes.ok) throw 오류("Firebase 로그인이 유효하지 않습니다.", 401);
  const firebaseData = await firebaseRes.json();
  const user = firebaseData.users?.[0];
  if (!user) throw 오류("사용자를 확인할 수 없습니다.", 401);
  if (user.disabled) throw 오류("비활성화된 계정입니다.", 403);
  if (user.localId !== env.FIREBASE_ADMIN_UID) throw 오류("관리자만 사용할 수 있습니다.", 403);
  return user;
}

async function 서명만들기(params, secret) {
  if (!secret) throw 오류("Cloudinary 비밀키가 설정되지 않았습니다.", 500);
  const text = Object.entries(params).filter(([, value]) => value !== undefined && value !== null).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  const input = new TextEncoder().encode(text + secret);
  const digest = await crypto.subtle.digest("SHA-1", input);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function 폴더정리(value) {
  let folder = String(value || "기타").trim().replace(/[^a-zA-Z0-9가-힣/_-]+/g, "-").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  if (!folder) folder = "기타";
  if (!folder.startsWith("cheonsangheun/")) folder = `cheonsangheun/${folder}`;
  return folder.slice(0, 150);
}

function cors(origin) {
  const headers = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" };
  if (origin === 허용주소) headers["Access-Control-Allow-Origin"] = 허용주소;
  return headers;
}
function 응답(data, status, origin) { return new Response(JSON.stringify(data), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function 오류(message, status = 500) { return Object.assign(new Error(message), { status }); }
