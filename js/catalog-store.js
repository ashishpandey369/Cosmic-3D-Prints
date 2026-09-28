import { db } from "./firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  where,
  query
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const RECENTLY_VIEWED_KEY = "gifty-hamper-recently-viewed";
const RECENTLY_VIEWED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECENTLY_VIEWED_LIMIT = 8;

export function getRecentlyViewedIds(limit = RECENTLY_VIEWED_LIMIT) {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
    const entries = (Array.isArray(saved) ? saved : [])
      .map(entry => typeof entry === "string" ? { id: entry, viewedAt: now } : entry)
      .filter(entry => entry && entry.id && now - Number(entry.viewedAt || 0) < RECENTLY_VIEWED_TTL_MS)
      .sort((a, b) => Number(b.viewedAt || 0) - Number(a.viewedAt || 0))
      .slice(0, Math.max(1, limit));
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(entries));
    return entries.map(entry => String(entry.id));
  } catch (_) {
    return [];
  }
}

export function recordRecentlyViewed(productId, limit = RECENTLY_VIEWED_LIMIT) {
  const id = String(productId || "").trim();
  if (!id) return;
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]");
    const entries = (Array.isArray(saved) ? saved : [])
      .map(entry => typeof entry === "string" ? { id: entry, viewedAt: now } : entry)
      .filter(entry => entry && entry.id && now - Number(entry.viewedAt || 0) < RECENTLY_VIEWED_TTL_MS && String(entry.id) !== id);
    entries.unshift({ id, viewedAt: now });
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(entries.slice(0, Math.max(1, limit))));
  } catch (_) {}
}

export const DEFAULT_CATALOG = [
  { id:"little-joy", name:"The Little Joy Hamper", description:"Thoughtful everyday gifting", price:1499, occasion:"Birthday", categories:["Gift Sets","Appreciation Gifts"], label:"Everyday", imageClass:"image-sage", stock:10 },
  { id:"good-things", name:"Good Things Gift Box", description:"A warm collection of favourites", price:1999, occasion:"Thank You", categories:["Gift Sets","Premium Gifts"], label:"Curated", imageClass:"image-sand", stock:10 },
  { id:"just-for-you", name:"Just For You Hamper", description:"Made for meaningful moments", price:2499, occasion:"Birthday", categories:["Gift Sets","Celebration Gifts"], label:"Special", imageClass:"image-rose", stock:10 },
  { id:"signature-luxe", name:"Signature Luxe Hamper", description:"Premium gifting, beautifully packed", price:3999, occasion:"Corporate", categories:["Premium Gifts","Employee Gifts","Gift Sets"], label:"Premium", imageClass:"image-night", stock:10 },
  { id:"festive-glow", name:"Festive Glow Box", description:"A bright celebration in a box", price:1799, occasion:"Festive", categories:["Festive Gifts","Gift Sets"], label:"Festive", imageClass:"image-sand", stock:10 },
  { id:"office-cheer", name:"Office Cheer Hamper", description:"A polished team appreciation gift", price:2299, occasion:"Corporate", categories:["Office Accessories","Employee Gifts","Appreciation Gifts"], label:"Teams", imageClass:"image-sage", stock:10 },
  { id:"warm-thanks", name:"Warm Thanks Box", description:"A simple way to say thank you", price:1299, occasion:"Thank You", categories:["Appreciation Gifts","Gift Sets"], label:"Thoughtful", imageClass:"image-rose", stock:10 },
  { id:"grand-celebration", name:"Grand Celebration Hamper", description:"A premium gift for big moments", price:4999, occasion:"Festive", categories:["Celebration Gifts","Premium Gifts","Gift Sets"], label:"Premium", imageClass:"image-night", stock:10 }
];

const SKU_PATTERN = /^[A-Z]{2}[0-9]{4}$/;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateSku() {
  const first = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const second = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return first + second + digits;
}

export function getEffectivePrice(product) {
  const price = Math.max(0, Number(product?.price) || 0);
  const sale = product?.salePrice === "" || product?.salePrice == null
    ? null
    : Math.max(0, Number(product.salePrice) || 0);

  return sale !== null && sale < price ? sale : price;
}

export function getDiscountPercent(product) {
  const price = Math.max(0, Number(product?.price) || 0);
  const sale = getEffectivePrice(product);
  if (!price || sale >= price) return 0;
  return Math.round(((price - sale) / price) * 100);
}

export function normaliseProduct(product) {
  const price = Math.max(0, Number(product.price) || 0);
  const rawSale = product.salePrice === "" || product.salePrice == null
    ? ""
    : Math.max(0, Number(product.salePrice) || 0);

  const salePrice = rawSale !== "" && rawSale < price ? rawSale : "";

  return {
    ...product,
    sku: typeof product.sku === "string" && SKU_PATTERN.test(product.sku.toUpperCase())
      ? product.sku.toUpperCase()
      : "",
    price,
    salePrice,
    stock: Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : 0,
    lowStock: Number.isFinite(Number(product.lowStock)) ? Math.max(0, Number(product.lowStock)) : 5,
    featured: product.featured ?? false,
    active: product.active ?? true,
    majorCategory: product.majorCategory === "Gifts" ? "Gifts for Everyone" : (product.majorCategory || "Gifts for Everyone"),
    images: Array.isArray(product.images) && product.images.length
      ? product.images
      : (product.image ? [product.image] : []),
    imageKitFileIds: Array.isArray(product.imageKitFileIds)
      ? product.imageKitFileIds.map(item => String(item || ""))
      : []
  };
}

async function saveWithSku(product, sku) {
  const normalised = {
    ...normaliseProduct(product),
    id: String(product.id),
    sku
  };

  const productRef = doc(db, "products", normalised.id);
  const skuRef = doc(db, "skus", sku);

  await runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    const skuSnapshot = await transaction.get(skuRef);

    const existing = productSnapshot.exists()
      ? normaliseProduct({ id: productSnapshot.id, ...productSnapshot.data() })
      : null;

    if (existing?.sku && existing.sku !== sku) {
      throw new Error("SKU cannot be changed after a product is created.");
    }

    if (skuSnapshot.exists() && skuSnapshot.data().productId !== normalised.id) {
      throw new Error("SKU_COLLISION");
    }

    transaction.set(productRef, normalised);

    if (!skuSnapshot.exists()) {
      transaction.set(skuRef, {
        productId: normalised.id,
        sku,
        createdAt: new Date()
      });
    }
  });

  return normalised;
}

export async function saveCatalogProduct(product) {
  const existingSku = normaliseProduct(product).sku;

  if (existingSku) {
    return saveWithSku(product, existingSku);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const sku = generateSku();
    try {
      return await saveWithSku(product, sku);
    } catch (error) {
      if (error?.message !== "SKU_COLLISION") throw error;
    }
  }

  throw new Error("Unable to generate a unique SKU. Please try again.");
}

export async function deleteCatalogProduct(id) {
  const productRef = doc(db, "products", id);

  await runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);

    if (!productSnapshot.exists()) return;

    const product = productSnapshot.data();
    const sku = typeof product.sku === "string" ? product.sku.toUpperCase() : "";

    let skuSnapshot = null;
    if (SKU_PATTERN.test(sku)) {
      skuSnapshot = await transaction.get(doc(db, "skus", sku));
    }

    transaction.delete(productRef);

    if (skuSnapshot?.exists() && skuSnapshot.data().productId === id) {
      transaction.delete(doc(db, "skus", sku));
    }
  });
}

export async function loadPublicCatalog() {
  const snapshot = await getDocs(
    query(collection(db, "products"), where("active", "==", true))
  );
  return snapshot.docs.map(item => normaliseProduct({ id:item.id, ...item.data() }));
}

export async function migrateMissingProductVisibility() {
  const snapshot = await getDocs(collection(db, "products"));
  const migrated = [];

  for (const item of snapshot.docs) {
    const raw = item.data();
    if (Object.prototype.hasOwnProperty.call(raw, "active")) continue;

    const product = normaliseProduct({ id: item.id, ...raw, active: true });
    migrated.push(await saveCatalogProduct(product));
  }

  return migrated;
}

export async function loadAdminCatalog() {
  const snapshot = await getDocs(collection(db, "products"));
  return snapshot.docs.map(item => normaliseProduct({ id:item.id, ...item.data() }));
}

export async function ensureCatalogSkus(products) {
  const migrated = [];

  for (const product of products) {
    if (product.sku && SKU_PATTERN.test(product.sku)) {
      migrated.push(product);
      continue;
    }

    migrated.push(await saveCatalogProduct(product));
  }

  return migrated;
}

export async function getCatalogProduct(id) {
  const snapshot = await getDoc(doc(db, "products", id));
  return snapshot.exists()
    ? normaliseProduct({ id:snapshot.id, ...snapshot.data() })
    : null;
}

export async function seedDefaultCatalog() {
  const seeded = [];
  for (const product of DEFAULT_CATALOG) {
    seeded.push(await saveCatalogProduct(product));
  }
  return seeded;
}
