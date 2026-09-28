import { db } from "./firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const CATEGORY_COLLECTION = "categories";

const cleanName = value => String(value || "").trim();
const slugify = value => cleanName(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);

export function normaliseCategory(category = {}) {
  const name = cleanName(category.name);
  return {
    id: cleanName(category.id) || slugify(name) || "category",
    name,
    type: category.type === "major" ? "major" : "minor",
    image: cleanName(category.image),
    imageFileId: cleanName(category.imageFileId),
    order: Number.isFinite(Number(category.order)) ? Number(category.order) : 0,
    active: category.active !== false
  };
}

export async function loadCategories() {
  const snapshot = await getDocs(collection(db, CATEGORY_COLLECTION));
  return snapshot.docs
    .map(item => normaliseCategory({ id: item.id, ...item.data() }))
    .filter(item => item.name && item.active !== false)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function saveCategory(category) {
  const normalised = normaliseCategory(category);
  if (!normalised.name) throw new Error("Category name is required.");

  await setDoc(doc(db, CATEGORY_COLLECTION, normalised.id), {
    name: normalised.name,
    type: normalised.type,
    image: normalised.image,
    imageFileId: normalised.imageFileId,
    order: normalised.order,
    active: normalised.active
  }, { merge: true });

  return normalised;
}

export async function deleteCategory(categoryId) {
  const id = cleanName(categoryId);
  if (!id) return;
  await deleteDoc(doc(db, CATEGORY_COLLECTION, id));
}

export function categoryId(name, type = "minor") {
  return `${type}-${slugify(name)}`;
}
