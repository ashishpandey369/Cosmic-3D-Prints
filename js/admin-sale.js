import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  signOut
} from "./firebase-auth.js";
import {
  collection,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { showBillPdf } from "./bill.js";
import { loadAdminCatalog } from "./catalog-store.js";

const KEY = "gifty-hamper-catalog";

const DEFAULT_SALE_PRODUCTS = [
  { id: "little-joy", name: "The Little Joy Hamper", description: "Thoughtful everyday gifting", price: 1499, stock: 10, active: true },
  { id: "good-things", name: "Good Things Gift Box", description: "A warm collection of favourites", price: 1999, stock: 10, active: true },
  { id: "just-for-you", name: "Just For You Hamper", description: "Made for meaningful moments", price: 2499, stock: 10, active: true },
  { id: "signature-luxe", name: "Signature Luxe Hamper", description: "Premium gifting, beautifully packed", price: 3999, stock: 10, active: true },
  { id: "festive-glow", name: "Festive Glow Box", description: "A bright celebration in a box", price: 1799, stock: 10, active: true },
  { id: "office-cheer", name: "Office Cheer Hamper", description: "A polished team appreciation gift", price: 2299, stock: 10, active: true },
  { id: "warm-thanks", name: "Warm Thanks Box", description: "A simple way to say thank you", price: 1299, stock: 10, active: true },
  { id: "grand-celebration", name: "Grand Celebration Hamper", description: "A premium gift for big moments", price: 4999, stock: 10, active: true }
];

const $ = (selector) => document.querySelector(selector);

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const normaliseProduct = (product) => ({
  ...product,
  stock: product.stock ?? 10,
  active: product.active ?? true,
  salePrice: product.salePrice ?? "",
  images: Array.isArray(product.images) && product.images.length
    ? product.images
    : (product.image ? [product.image] : [])
});

function readCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return Array.isArray(saved) && saved.length
      ? saved.map(normaliseProduct)
      : DEFAULT_SALE_PRODUCTS.map(normaliseProduct);
  } catch (_) {
    return [];
  }
}

let catalog = [];
let cart = new Map();
let signedInUser = null;

function showAccess(message, detail) {
  const box = $("#sale-access");
  box.hidden = false;
  box.innerHTML = "<strong>" + message + "</strong><span>" + detail + "</span>";
}

function parseSkuQuantitySearch() {
  const raw = ($("#sale-search").value || "").trim();

  if (!raw || !raw.includes("-")) return [];

  const parts = raw.split(",").map(part => part.trim()).filter(Boolean);
  const requested = [];

  for (const part of parts) {
    const match = part.match(/^([A-Za-z]{2}[0-9]{4})-(\d+)$/);
    if (!match) return [];

    const sku = match[1].toUpperCase();
    const quantity = Number(match[2]);

    if (!Number.isInteger(quantity) || quantity <= 0) return [];

    const product = catalog.find(item =>
      String(item.sku || "").toUpperCase() === sku
    );

    if (!product || product.active === false) return [];

    requested.push({ product, quantity });
  }

  return requested;
}

function applySkuQuantitySearch() {
  const requested = parseSkuQuantitySearch();

  if (!requested.length) return false;

  const unavailable = requested.some(({ product, quantity }) => {
    const stock = Math.max(0, Number(product.stock) || 0);
    return quantity > stock;
  });

  if (unavailable) {
    alert("One or more requested quantities are higher than the available stock.");
    return false;
  }

  cart.clear();

  requested.forEach(({ product, quantity }) => {
    cart.set(String(product.id), quantity);
  });

  return true;
}

function getSearchQuantity(product) {
  const requested = parseSkuQuantitySearch();
  const match = requested.find(item => String(item.product.id) === String(product.id));
  return match ? match.quantity : (cart.get(product.id) || 0);
}

function renderProducts() {
  const rawQuery = ($("#sale-search").value || "").trim().toLowerCase();
  const searchTerms = rawQuery.split(",").map(term => term.trim()).filter(Boolean).map(term => term.replace(/-\d+$/, ""));
  const products = catalog.filter(product => {
    if (product.active === false) return false;
    const searchable = [product.name, product.id, product.sku, product.description, product.occasion, product.majorCategory, ...(product.categories || [])].join(" ").toLowerCase();
    return !searchTerms.length || searchTerms.some(term => searchable.includes(term));
  });

  $("#sale-product-list").innerHTML = products.map(product => {
    const stock = Math.max(0, Number(product.stock) || 0);
    const selected = getSearchQuantity(product);
    const image = product.images?.[0];

    return `<article class="sale-product-card">
      <div class="sale-product-image">
        ${image ? '<img src="' + image + '" alt="">' : '<span>🎁</span>'}
      </div>
      <div class="sale-product-info">
        <h3>${escapeHtml(product.name)}</h3>
        <p>SKU: ${escapeHtml(product.sku || product.id)}</p>
        ${Number(product.salePrice || 0) > 0 && Number(product.salePrice) < Number(product.price) ? "<del>" + money(product.price) + "</del> " : ""}
        <strong>${money(product.salePrice || product.price)}</strong>
        <span class="sale-stock ${stock === 0 ? "out" : ""}">${stock === 0 ? "Out of stock" : stock + " in stock"}</span>
      </div>
      <div class="sale-quantity">
        <button type="button" data-minus="${escapeHtml(product.id)}" ${selected === 0 ? "disabled" : ""}>−</button>
        <strong>${selected}</strong>
        <button type="button" data-plus="${escapeHtml(product.id)}" ${selected >= stock ? "disabled" : ""}>+</button>
      </div>
    </article>`;
  }).join("") || '<div class="sale-empty">No active products found.</div>';
}

function renderCart() {
  const entries = [...cart.entries()]
    .map(([id, quantity]) => {
      const product = catalog.find(item => item.id === id);
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);

  const totalQuantity = entries.reduce((sum, item) => sum + item.quantity, 0);
  const total = entries.reduce((sum, item) =>
    sum + (Number(item.product.salePrice || item.product.price) || 0) * item.quantity, 0
  );

  $("#sale-item-count").textContent = entries.length + (entries.length === 1 ? " item" : " items");
  $("#sale-total-quantity").textContent = totalQuantity;
  $("#sale-total").textContent = money(total);
  $("#complete-sale").disabled = totalQuantity === 0;

  $("#sale-cart").innerHTML = entries.length
    ? entries.map(({ product, quantity }) => `
      <div class="sale-cart-row">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${quantity} × ${money(product.salePrice || product.price)}</span>
        </div>
        <div class="sale-cart-actions">
          <button type="button" data-cart-minus="${escapeHtml(product.id)}">−</button>
          <strong>${quantity}</strong>
          <button type="button" data-cart-plus="${escapeHtml(product.id)}">+</button>
        </div>
      </div>`).join("")
    : '<div class="sale-empty">No products selected yet.<br>Use the + button to add items.</div>';
}

function changeQuantity(id, delta) {
  const product = catalog.find(item => item.id === id);
  if (!product) return;

  const stock = Math.max(0, Number(product.stock) || 0);
  const current = cart.get(id) || 0;
  const next = Math.max(0, Math.min(stock, current + delta));

  if (next === 0) cart.delete(id);
  else cart.set(id, next);

  renderProducts();
  renderCart();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function completeSale() {
  if (!signedInUser) {
    alert("Your session is not ready. Please refresh and try again.");
    return;
  }

  const entries = [...cart.entries()]
    .map(([id, quantity]) => {
      const product = catalog.find(item => item.id === id);
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);

  if (!entries.length) {
    alert("Please add at least one product.");
    return;
  }

  const items = entries.map(({ product, quantity }) => {
    const unitPrice = Number(product.salePrice || product.price) || 0;

    return {
      productId: String(product.id),
      sku: String(product.sku || ""),
      productName: String(product.name || "Product"),
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity
    };
  });

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const orderId = "GH-" + Date.now().toString(36).toUpperCase();

  const button = $("#complete-sale");
  button.disabled = true;
  button.textContent = "Saving sale…";

  try {
    const saleRef = doc(collection(db, "sales"));

    await runTransaction(db, async (transaction) => {
      const productRefs = entries.map(({ product }) => doc(db, "products", product.id));
      const productSnapshots = [];

      for (const productRef of productRefs) {
        productSnapshots.push(await transaction.get(productRef));
      }

      productSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists()) {
          throw new Error("Product no longer exists in the shared catalog.");
        }

        const requested = entries[index].quantity;
        const currentStock = Number(snapshot.data().stock) || 0;

        if (currentStock < requested) {
          throw new Error(
            entries[index].product.name + " has only " + currentStock +
            " item" + (currentStock === 1 ? "" : "s") + " left in stock."
          );
        }

        transaction.update(productRefs[index], {
          stock: currentStock - requested
        });
      });

      transaction.set(saleRef, {
        orderId,
        sellerUid: signedInUser.uid,
        sellerEmail: signedInUser.email || "",
        items,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        total,
        createdAt: serverTimestamp()
      });
    });

    cart.clear();
    renderProducts();
    renderCart();

    const completedSale = {
      id: orderId,
      orderId,
      sellerUid: signedInUser.uid,
      sellerEmail: signedInUser.email || "",
      items,
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      total,
      createdAt: new Date()
    };

    try {
      await showBillPdf(completedSale);
    } catch (pdfError) {
      console.error("Bill PDF error:", pdfError);
      alert("Sale was saved successfully, but the bill PDF could not be generated. Please open Sales and use Regenerate bill.");
    }
  } catch (error) {
    console.error("Complete sale error:", error);
    alert(
      "Unable to complete the sale.\n\n" +
      (error?.message || "Please check your Firebase rules and internet connection.")
    );
  } finally {
    button.textContent = "Complete Sale";
    button.disabled = cart.size === 0;
  }
}

$("#sale-search").addEventListener("input", () => {
  renderProducts();
});

function commitSkuSearchToSale() {
  const added = applySkuQuantitySearch();

  if (added) {
    renderProducts();
    renderCart();
  }
  return added;
}

$("#sale-search").addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  commitSkuSearchToSale();
});

$("#sale-search").addEventListener("keyup", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  commitSkuSearchToSale();
});

$("#sale-search").addEventListener("search", () => {
  commitSkuSearchToSale();
});

$("#sale-product-list").addEventListener("click", (event) => {
  const plus = event.target.closest("[data-plus]");
  const minus = event.target.closest("[data-minus]");
  if (plus) changeQuantity(plus.dataset.plus, 1);
  if (minus) changeQuantity(minus.dataset.minus, -1);
});

$("#sale-cart").addEventListener("click", (event) => {
  const plus = event.target.closest("[data-cart-plus]");
  const minus = event.target.closest("[data-cart-minus]");
  if (plus) changeQuantity(plus.dataset.cartPlus, 1);
  if (minus) changeQuantity(minus.dataset.cartMinus, -1);
});


let quickOrder = [];

function applyQuickOrderToSale() {
  if (!quickOrder.length) return false;

  const unavailable = quickOrder.filter(item => item.quantity > item.stock);
  if (unavailable.length) {
    return false;
  }

  cart.clear();

  quickOrder.forEach(item => {
    cart.set(String(item.product.id), Number(item.quantity));
  });

  renderProducts();
  renderCart();

  return true;
}

function parseQuickOrderCommand() {
  const input = $("#quick-order-command").value.trim();
  const result = $("#quick-order-result");
  const sendButton = $("#quick-order-whatsapp");

  quickOrder = [];

  if (!input) {
    result.hidden = true;
    result.innerHTML = "";
    sendButton.disabled = true;
    return;
  }

  const parts = input.split(",").map(part => part.trim()).filter(Boolean);
  const combined = new Map();
  const invalid = [];

  for (const part of parts) {
    const match = part.match(/^([A-Za-z]{2}[0-9]{4})-(\d+)$/);
    if (!match) {
      invalid.push(part);
      continue;
    }

    const sku = match[1].toUpperCase();
    const quantity = Number(match[2]);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      invalid.push(part);
      continue;
    }

    combined.set(sku, (combined.get(sku) || 0) + quantity);
  }

  for (const [sku, quantity] of combined) {
    const product = catalog.find(item => String(item.sku || "").toUpperCase() === sku);

    if (!product) {
      invalid.push(sku);
      continue;
    }

    const unitPrice = Number(product.salePrice || product.price) || 0;
    const stock = Math.max(0, Number(product.stock) || 0);

    quickOrder.push({
      product,
      sku,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      stock
    });
  }

  if (invalid.length) {
    result.hidden = false;
    result.innerHTML =
      '<div class="quick-order-error"><strong>Check these entries:</strong> ' +
      invalid.map(escapeHtml).join(", ") +
      '</div>';
  } else {
    result.hidden = true;
    result.innerHTML = "";
  }

  if (!quickOrder.length) {
    sendButton.disabled = true;
    if (!invalid.length) {
      result.hidden = false;
      result.innerHTML = '<div class="quick-order-error">Enter at least one valid SKU and quantity.</div>';
    }
    return;
  }

  const total = quickOrder.reduce((sum, item) => sum + item.lineTotal, 0);

  // Load the command into the normal Complete Sale cart.
  applyQuickOrderToSale();

  result.hidden = false;
  result.innerHTML =
    '<div class="quick-order-list">' +
    quickOrder.map(item => {
      const stockWarning = item.quantity > item.stock
        ? '<span class="quick-order-warning">Requested ' + item.quantity + ', current stock ' + item.stock + '</span>'
        : '';
      return '<div class="quick-order-row">' +
        '<div><strong>' + escapeHtml(item.product.name) + '</strong><span>SKU: ' + escapeHtml(item.sku) + ' • ' + item.quantity + ' × ' + money(item.unitPrice) + '</span>' + stockWarning + '</div>' +
        '<strong>' + money(item.lineTotal) + '</strong>' +
      '</div>';
    }).join("") +
    '<div class="quick-order-total"><span>SUBTOTAL</span><strong>' + money(total) + '</strong></div>' +
    '</div>';

  sendButton.disabled = false;
}

function sendQuickOrderToWhatsApp() {
  if (!quickOrder.length) return;

  const subtotal = quickOrder.reduce((sum, item) => sum + item.lineTotal, 0);
  const skuCommand = quickOrder.map(item => item.sku + "-" + item.quantity).join(", ");

  const message = [
    "Hello from Gifty Hamper 👋",
    "",
    "Thank you for your order enquiry.",
    "",
    "✅ AVAILABILITY CONFIRMATION",
    "",
    "Yes, the requested items are available.",
    "",
    "🛍️ ORDER DETAILS",
    "",
    ...quickOrder.map((item, index) => [
      (index + 1) + ". " + item.product.name,
      "",
      "   Quantity: " + item.quantity,
      "",
      "   Amount: " + money(item.lineTotal),
      ""
    ].join("\n")),
    "💰 TOTAL AMOUNT: " + money(subtotal),
    "(SKU: " + skuCommand + ")",
    "",
    "The above amount is based on the current listed sale prices.",
    "Please stay in contact with us for delivery details and any available discounts or special offers.",
    "",
    "Thank you for choosing Gifty Hamper! 🎁"
  ].join("\n");

  window.open(
    "https://wa.me/919448588793?text=" + encodeURIComponent(message),
    "_blank",
    "noopener"
  );
}

$("#quick-order-parse").addEventListener("click", () => {
  parseQuickOrderCommand();
  applyQuickOrderToSale();
});
$("#quick-order-command").addEventListener("input", parseQuickOrderCommand);
$("#quick-order-command").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    parseQuickOrderCommand();
  }
});
$("#quick-order-whatsapp").addEventListener("click", sendQuickOrderToWhatsApp);

$("#complete-sale").addEventListener("click", completeSale);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("admin-login.html");
    return;
  }

  signedInUser = user;

  try {
    const tokenResult = await user.getIdTokenResult(true);
    const claimRole = tokenResult.claims.role || "";

    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    const profileRole = profile?.role || "";
    const role = claimRole === "super_admin" ? "super_admin" : profileRole;

    $("#admin-user-email").textContent = (user.email || "Signed-in admin") + " • " + (role || "unknown");

    if (!["admin", "owner", "super_admin"].includes(role)) {
      showAccess("Access restricted", "Your account does not have permission to use sales.");
      return;
    }

    const expiry = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;
    const expired = expiry ? expiry.getTime() <= Date.now() : false;

    if (role !== "super_admin" && (profile?.active === false || expired)) {
      showAccess("Access restricted", "Your sales access is inactive or expired.");
      return;
    }

    catalog = await loadAdminCatalog();

    // Explicitly hide the loading notice after role verification.
    // The cache-busted script version below also prevents an older page script
    // from leaving the previous "Checking access" notice on screen.
    const accessBox = $("#sale-access");
    accessBox.hidden = true;
    accessBox.style.display = "none";

    const contentBox = $("#sale-content");
    contentBox.hidden = false;
    contentBox.style.display = "grid";

    const validity = $("#admin-account-validity");
    if (validity) {
      if (role === "super_admin") {
        validity.textContent = "Unlimited access";
      } else if (expiry) {
        const updateValidity = () => {
          const diff = expiry.getTime() - Date.now();
          validity.textContent = diff <= 0 ? "Expired" : Math.ceil(diff / 86400000) + " days left";
        };
        updateValidity();
        setInterval(updateValidity, 60000);
      }
    }

    renderProducts();
    renderCart();
  } catch (error) {
    console.error("Sale page error:", error);
    showAccess("Unable to load sales", error?.message || "Please refresh the page and try again.");
  }

  const logout = $("#admin-logout");
  if (logout) {
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      logout.textContent = "Signing out…";
      await signOut(auth);
      window.location.replace("admin-login.html");
    });
  }
});
