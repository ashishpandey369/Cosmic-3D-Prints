import { auth } from "./firebase-auth.js";

export const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/giftyhamper";
export const IMAGEKIT_PUBLIC_KEY = "public_Rt1oqiUStVe495Q5BXhyFI19G+c=";

// Cloudflare Worker keeps the ImageKit private key off the frontend.
// This Worker is deployed from the same GitHub repository.
export const IMAGEKIT_WORKER_URL = "https://gifty-hamper.arindia-in.workers.dev";

function safeFileName(value = "image.webp") {
  const cleaned = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  return cleaned || "image.webp";
}

async function workerRequest(path, { method = "GET", body } = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to manage catalog images.");
  }

  const idToken = await user.getIdToken();

  const headers = {
    Authorization: "Bearer " + idToken
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(IMAGEKIT_WORKER_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || "ImageKit backend request failed.");
  }

  return result;
}

export async function getImageKitUploadAuth() {
  return workerRequest("/imagekit/auth");
}

export async function uploadImageFile(file, { folder, fileName } = {}) {
  if (!(file instanceof Blob)) {
    throw new Error("A valid image file is required.");
  }

  const uploadAuth = await getImageKitUploadAuth();
  const form = new FormData();

  form.append("file", file);
  form.append("fileName", safeFileName(fileName || "image.webp"));
  form.append("folder", folder || "/gifty-hamper/other");
  form.append("useUniqueFileName", "true");
  form.append("publicKey", uploadAuth.publicKey || IMAGEKIT_PUBLIC_KEY);
  form.append("token", uploadAuth.token);
  form.append("signature", uploadAuth.signature);
  form.append("expire", String(uploadAuth.expire));

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.message || "ImageKit upload failed.");
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

export async function uploadImageUrl(sourceUrl, { folder, fileName } = {}) {
  return workerRequest("/imagekit/import-url", {
    method: "POST",
    body: {
      sourceUrl,
      folder: folder || "/gifty-hamper/other",
      fileName: safeFileName(fileName || "image.webp")
    }
  });
}

export async function deleteImageFile(fileId) {
  if (!fileId) return { deleted: false, fileId: "" };

  return workerRequest("/imagekit/delete", {
    method: "POST",
    body: { fileId }
  });
}
