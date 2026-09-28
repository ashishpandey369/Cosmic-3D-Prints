const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const IMAGEKIT_API_URL = "https://api.imagekit.io/v1/files";

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "https://ashishpandey369.github.io";
  const allowOrigin = origin === allowed ? origin : allowed;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env)
    }
  });
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase ID token.");

  const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const payload = JSON.parse(atob(padded));
  if (!payload.sub) throw new Error("Firebase ID token has no user ID.");
  return payload;
}

function firestoreValue(value) {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([key, item]) => [key, firestoreValue(item)]));
  }
  if ("arrayValue" in value) {
    return (value.arrayValue?.values || []).map(firestoreValue);
  }
  return undefined;
}

async function requireCatalogStaff(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: "You must be signed in." };
  }

  const idToken = match[1].trim();
  let claims;

  try {
    claims = decodeJwtPayload(idToken);
  } catch (_) {
    return { ok: false, status: 401, error: "Invalid Firebase ID token." };
  }

  const projectId = env.FIREBASE_PROJECT_ID || "gifty-hamper";
  const uid = claims.sub;
  const userUrl =
    "https://firestore.googleapis.com/v1/projects/" +
    encodeURIComponent(projectId) +
    "/databases/(default)/documents/users/" +
    encodeURIComponent(uid);

  // Firestore validates the Firebase ID token cryptographically and applies
  // the project's Firestore security rules before returning the user profile.
  const response = await fetch(userUrl, {
    headers: {
      Authorization: "Bearer " + idToken
    }
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 401 ? 401 : 403,
      error: "Your Firebase account could not be authorized for catalog access."
    };
  }

  const document = await response.json();
  const fields = document.fields || {};
  const profile = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)])
  );

  const tokenRole = claims.role || claims["https://gifty-hamper/role"] || "";
  const isSuperAdmin = tokenRole === "super_admin" || profile.role === "super_admin";
  const active = profile.active === true;
  const roleAllowed = isSuperAdmin || profile.role === "owner" || profile.role === "admin";
  const catalogEnabled = isSuperAdmin || profile.features?.catalog !== false;

  let expired = false;
  if (profile.expiresAt) {
    const expiry = Date.parse(String(profile.expiresAt));
    expired = Number.isFinite(expiry) && expiry <= Date.now();
  }

  if ((!active || expired) && !isSuperAdmin) {
    return { ok: false, status: 403, error: "Your account is inactive or expired." };
  }

  if (!roleAllowed || !catalogEnabled) {
    return { ok: false, status: 403, error: "Catalog access is disabled for your account." };
  }

  return {
    ok: true,
    uid,
    role: isSuperAdmin ? "super_admin" : profile.role
  };
}

function safeFileName(value = "image.webp") {
  const cleaned = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  return cleaned || "image.webp";
}

function safeFolder(value, fallback = "gifty-hamper/other") {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9/_-]+/g, "_")
    .replace(/\\+/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return "/" + (cleaned || fallback);
}

function imageKitBasicAuth(env) {
  return "Basic " + btoa(env.IMAGEKIT_PRIVATE_KEY + ":");
}

async function createImageKitAuth(env) {
  const expire = Math.floor(Date.now() / 1000) + 60 * 30;
  const token = crypto.randomUUID();

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.IMAGEKIT_PRIVATE_KEY),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(token + expire)
  );

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    token,
    expire,
    signature,
    publicKey: env.IMAGEKIT_PUBLIC_KEY
  };
}

async function importImageFromUrl(body, env) {
  const sourceUrl = String(body?.sourceUrl || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error("Only public HTTP/HTTPS image URLs can be imported.");
  }

  const form = new FormData();
  form.append("file", sourceUrl);
  form.append("fileName", safeFileName(body?.fileName || "image.webp"));
  form.append("folder", safeFolder(body?.folder));
  form.append("useUniqueFileName", "true");

  const response = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: imageKitBasicAuth(env)
    },
    body: form
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || "ImageKit could not import that image URL.");
  }

  return {
    fileId: result.fileId || "",
    filePath: result.filePath || "",
    url: result.url || "",
    thumbnailUrl: result.thumbnailUrl || "",
    width: result.width || 0,
    height: result.height || 0,
    size: result.size || 0
  };
}

async function deleteImageKitFile(fileId, env) {
  if (!fileId) return { deleted: false, fileId: "" };

  const response = await fetch(
    IMAGEKIT_API_URL + "/" + encodeURIComponent(fileId),
    {
      method: "DELETE",
      headers: {
        Authorization: imageKitBasicAuth(env),
        Accept: "application/json"
      }
    }
  );

  if (!response.ok && response.status !== 404) {
    const message = await response.text();
    console.error("ImageKit delete failed", response.status, message);
    throw new Error("ImageKit could not delete the file.");
  }

  return { deleted: true, fileId };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/imagekit/auth" && request.method === "GET") {
      const access = await requireCatalogStaff(request, env);
      if (!access.ok) return json({ error: access.error }, access.status, request, env);

      try {
        return json(await createImageKitAuth(env), 200, request, env);
      } catch (error) {
        console.error("ImageKit auth generation failed", error);
        return json({ error: "Unable to create ImageKit upload authorization." }, 500, request, env);
      }
    }

    if (url.pathname === "/imagekit/import-url" && request.method === "POST") {
      const access = await requireCatalogStaff(request, env);
      if (!access.ok) return json({ error: access.error }, access.status, request, env);

      try {
        const body = await request.json();
        return json(await importImageFromUrl(body, env), 200, request, env);
      } catch (error) {
        console.error("ImageKit URL import failed", error);
        return json({ error: error.message || "ImageKit URL import failed." }, 400, request, env);
      }
    }

    if (url.pathname === "/imagekit/delete" && request.method === "POST") {
      const access = await requireCatalogStaff(request, env);
      if (!access.ok) return json({ error: access.error }, access.status, request, env);

      try {
        const body = await request.json();
        const fileId = String(body?.fileId || "").trim();
        if (!fileId) return json({ error: "An ImageKit file ID is required." }, 400, request, env);
        return json(await deleteImageKitFile(fileId, env), 200, request, env);
      } catch (error) {
        console.error("ImageKit delete failed", error);
        return json({ error: error.message || "ImageKit deletion failed." }, 400, request, env);
      }
    }

    return json(
      {
        service: "gifty-hamper-imagekit",
        status: "ok",
        endpoints: ["/imagekit/auth", "/imagekit/import-url", "/imagekit/delete"]
      },
      200,
      request,
      env
    );
  }
};
