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
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { showBillPdf } from "./bill.js";

const $ = (selector) => document.querySelector(selector);

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

function showAccess(message, detail) {
  const box = $("#sales-access");
  box.hidden = false;
  box.innerHTML = "<strong>" + message + "</strong><span>" + detail + "</span>";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saleDate(sale) {
  if (sale.createdAt?.toDate) return sale.createdAt.toDate();
  return null;
}

function formatDate(date) {
  if (!date) return "Pending timestamp";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function periodStart(period) {
  const now = new Date();
  if (period === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

async function loadSales(role, uid, period = "week") {
  const salesCollection = collection(db, "sales");
  const snapshot = role === "admin"
    ? await getDocs(query(salesCollection, where("sellerUid", "==", uid)))
    : await getDocs(salesCollection);

  let sales = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  const start = periodStart(period);
  if (start) {
    sales = sales.filter(sale => {
      const date = saleDate(sale);
      return date && date >= start;
    });
  }

  window.__giftySales = sales;

  sales.sort((a, b) => {
    const dateA = saleDate(a)?.getTime() || 0;
    const dateB = saleDate(b)?.getTime() || 0;
    return dateB - dateA;
  });

  const totalSales = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const totalItems = sales.reduce((sum, sale) => sum + (Number(sale.totalQuantity) || 0), 0);

  $("#stat-orders").textContent = sales.length;
  $("#stat-sales").textContent = money(totalSales);
  $("#stat-items").textContent = totalItems;
  $("#stat-average").textContent = money(sales.length ? totalSales / sales.length : 0);

  const periodLabel = {
    week: "This week",
    month: "This month",
    year: "This year",
    all: "All time"
  }[period] || "This week";

  $("#sales-heading").textContent =
    periodLabel + " — " + (role === "admin" ? "My sales" : "All sales");

  const list = $("#sales-list");

  if (!sales.length) {
    list.innerHTML = '<tr><td colspan="6" class="sales-empty-cell">No completed sales yet.</td></tr>';
    return;
  }

  list.innerHTML = sales.map(sale => {
    const itemNames = Array.isArray(sale.items)
      ? sale.items.map(item => {
          const quantity = Number(item.quantity) || 0;
          return escapeHtml(item.productName || item.productId || "Product") +
            " × " + quantity;
        }).join("<br>")
      : "—";

    return `<tr>
      <td>
        <strong>${escapeHtml(sale.orderId || sale.id)}</strong>
        <small class="sales-doc-id">${escapeHtml(sale.id)}</small>
      </td>
      <td>
        <strong>${escapeHtml(sale.sellerEmail || "Unknown seller")}</strong>
        <small class="sales-doc-id">${escapeHtml(sale.sellerUid || "")}</small>
      </td>
      <td>${itemNames}</td>
      <td><strong>${money(sale.total)}</strong></td>
      <td>${escapeHtml(formatDate(saleDate(sale)))}</td>
      <td><button class="bill-regenerate" type="button" data-regenerate-bill="${escapeHtml(sale.id)}">Regenerate bill</button></td>
    </tr>`;
  }).join("");
}

function setupBillButtons() {
  const list = $("#sales-list");
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-regenerate-bill]");
    if (!button) return;
    const saleId = button.dataset.regenerateBill;
    const sale = window.__giftySales?.find(item => item.id === saleId);
    if (!sale) {
      alert("This sale could not be found. Please refresh the page.");
      return;
    }
    button.disabled = true;
    button.textContent = "Generating…";
    try {
      await showBillPdf(sale);
    } catch (error) {
      console.error("Regenerate bill error:", error);
      alert("Unable to regenerate the bill. Please try again.");
    } finally {
      button.disabled = false;
      button.textContent = "Regenerate bill";
    }
  });
}

async function startSales(user) {
  const tokenResult = await user.getIdTokenResult(true);
  const claimRole = tokenResult.claims.role || "";

  const profileSnapshot = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
  const profileRole = profile?.role || "";

  const role = claimRole === "super_admin" ? "super_admin" : profileRole;

  if (!["super_admin", "owner", "admin"].includes(role)) {
    showAccess("Access restricted", "Your account does not have permission to view sales.");
    return;
  }

  $("#admin-user-email").textContent =
    (user.email || "Signed-in admin") + " • " + role;

  const expiry = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;

  if (role === "super_admin") {
    $("#admin-account-validity").textContent = "Unlimited access";
  } else if (expiry) {
    const updateValidity = () => {
      const diff = expiry.getTime() - Date.now();
      $("#admin-account-validity").textContent =
        diff <= 0 ? "Expired" : Math.ceil(diff / 86400000) + " days left";
    };
    updateValidity();
    setInterval(updateValidity, 60000);
  }

  let currentPeriod = "week";
  setupBillButtons();

  // Show the dashboard immediately after Firebase role verification.
  // Loading the sales records happens separately so the page never remains
  // misleadingly stuck on "Checking access".
  $("#sales-access").hidden = true;
  $("#sales-content").hidden = false;

  await loadSales(role, user.uid, currentPeriod);

  document.querySelectorAll(".sales-period").forEach(button => {
    button.addEventListener("click", async () => {
      currentPeriod = button.dataset.period;
      document.querySelectorAll(".sales-period").forEach(item => item.classList.toggle("active", item === button));
      button.disabled = true;
      try {
        await loadSales(role, user.uid, currentPeriod);
      } catch (error) {
        console.error("Sales period error:", error);
        alert("Unable to load this sales period.");
      } finally {
        button.disabled = false;
      }
    });
  });

  $("#sales-refresh").addEventListener("click", async () => {
    const button = $("#sales-refresh");
    button.disabled = true;
    button.textContent = "Refreshing…";
    try {
      await loadSales(role, user.uid, currentPeriod);
    } catch (error) {
      console.error("Sales refresh error:", error);
      alert("Unable to refresh sales.");
    } finally {
      button.disabled = false;
      button.textContent = "Refresh";
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("admin-login.html");
    return;
  }

  try {
    await startSales(user);
  } catch (error) {
    console.error("Sales page error:", error);
    showAccess(
      "Unable to load sales",
      error?.message || "Please refresh the page and check your Firebase connection."
    );
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
