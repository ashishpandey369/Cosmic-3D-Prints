import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged
} from "./firebase-auth.js";

const FEATURE_DEFAULTS = {
  catalog: true,
  sales: true,
  staff: false
};

function pageFeature() {
  const page = window.location.pathname.split("/").pop() || "admin.html";
  if (page === "admin-staff.html") return "staff";
  if (page === "admin-sales.html" || page === "admin-sale.html") return "sales";
  if (page === "admin.html") return "catalog";
  return "";
}

function getFeatures(role, profile) {
  if (role === "super_admin") {
    return { catalog: true, sales: true, staff: true };
  }

  return {
    ...FEATURE_DEFAULTS,
    ...(profile?.features && typeof profile.features === "object" ? profile.features : {}),
    ...(role === "admin" ? { staff: false } : {})
  };
}

function isExpired(profile) {
  const expiry = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;
  return !!expiry && expiry.getTime() <= Date.now();
}

function showFeatureBlocked(feature) {
  document.documentElement.classList.remove("admin-auth-checking");
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#fbf7fa;font-family:Arial,sans-serif;">
      <section style="width:min(520px,100%);background:#fff;border:1px solid #eadde5;border-radius:20px;padding:32px;box-shadow:0 20px 60px rgba(36,29,43,.08);">
        <p style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8c8177;">Gifty Hamper</p>
        <h1 style="margin:8px 0 10px;">Feature unavailable</h1>
        <p style="color:#6f6877;line-height:1.6;">The Super Admin has currently hidden the <strong>${feature}</strong> feature for this account.</p>
        <a href="admin.html" style="display:inline-block;margin-top:12px;padding:11px 16px;border-radius:10px;background:#222;color:#fff;text-decoration:none;">Return to dashboard</a>
      </section>
    </main>`;
}

function showAccessBlocked(reason) {
  document.documentElement.classList.remove("admin-auth-checking");
  const ownerExpired = reason === "owner-expired";
  const ownerAccountExpired = reason === "owner-account-expired";

  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#fbf7fa;font-family:Arial,sans-serif;">
      <section style="width:min(560px,100%);background:#fff;border:1px solid #eadde5;border-radius:20px;padding:34px;box-shadow:0 20px 60px rgba(36,29,43,.08);text-align:center;">
        <p style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8c8177;">Gifty Hamper</p>
        <h1 style="margin:8px 0 10px;">${ownerAccountExpired ? "Owner access unavailable" : "Admin access unavailable"}</h1>
        <p style="color:#6f6877;line-height:1.6;">
          ${ownerExpired
            ? "Your Owner's validity has expired. Please contact your Owner to renew access."
            : ownerAccountExpired
              ? "Your Owner account validity has expired. Kindly contact the Web Developer / Provider to renew your service."
              : "Your admin account is inactive or its validity has expired. Please contact your Owner."}
        </p>
        ${ownerAccountExpired
          ? '<a href="https://wa.me/918667298507" target="_blank" rel="noopener" style="display:inline-block;margin-top:14px;font-weight:700;color:#6f2b78;">WhatsApp: +91 8667298507 (Ashish)</a>'
          : ""}
      </section>
    </main>`;
}

async function enforceAccess(user) {
  const tokenResult = await user.getIdTokenResult(true);
  const claimRole = tokenResult.claims.role || "";
  const profileSnapshot = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
  const profileRole = profile?.role || "";
  const role = claimRole === "super_admin" ? "super_admin" : profileRole;

  const active = role === "super_admin"
    ? true
    : !!profile && profile.active !== false && !isExpired(profile);

  if (!["super_admin", "owner", "admin"].includes(role) || !active) {
    showAccessBlocked(
      role === "owner"
        ? "owner-account-expired"
        : "account-expired"
    );
    return;
  }

  // An Admin also depends on its Owner remaining active and unexpired.
  if (role === "admin") {
    const ownerSnapshot = profile?.ownerUid
      ? await getDoc(doc(db, "users", profile.ownerUid))
      : null;
    const owner = ownerSnapshot?.exists() ? ownerSnapshot.data() : null;
    if (!owner || owner.role !== "owner" || owner.active === false || isExpired(owner)) {
      showAccessBlocked("owner-expired");
      return;
    }
  }

  const features = getFeatures(role, profile);
  window.giftyAdminFeatures = features;
  window.giftyAdminUser = {
    ...(window.giftyAdminUser || {}),
    uid: user.uid,
    email: user.email || "",
    role,
    profileRole,
    active,
    firestoreProfile: profile
  };
  document.documentElement.dataset.adminFeatures = JSON.stringify(features);
  document.documentElement.dataset.adminRole = role;

  document.querySelectorAll("a[href]").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href === "admin.html") link.hidden = !features.catalog;
    if (href === "admin-sales.html" || href === "admin-sale.html") link.hidden = !features.sales;
    if (href === "admin-staff.html") link.hidden = !features.staff;
  });

  const feature = pageFeature();
  if (feature && !features[feature]) {
    showFeatureBlocked(feature);
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("admin-login.html");
    return;
  }

  try {
    await enforceAccess(user);
  } catch (error) {
    console.error("Feature access check failed:", error);
    showAccessBlocked("account-expired");
  }
});
