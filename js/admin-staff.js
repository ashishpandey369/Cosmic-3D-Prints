import {
  auth,
  db,
  sendPasswordResetEmail,
  doc,
  getDoc,
  onAuthStateChanged,
  signOut
} from "./firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  collection,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  increment,
  deleteField
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const staffCreatorApp = initializeApp({
  apiKey: "AIzaSyA_i3OuD8zEnmsTjobg1yUt9zSHZAYb4ug",
  authDomain: "gifty-hamper.firebaseapp.com",
  projectId: "gifty-hamper",
  storageBucket: "gifty-hamper.firebasestorage.app",
  messagingSenderId: "941922060172",
  appId: "1:941922060172:web:23d85fd867bec63b7a78a9"
}, "staffCreator");

const staffCreatorAuth = getAuth(staffCreatorApp);

const $ = (selector) => document.querySelector(selector);

function showDiagnostic(message) {
  const box = $("#staff-access");
  if (!box) return;
  box.hidden = false;
  box.innerHTML = "<strong>Staff page status</strong><span>" + message + "</span>";
}

window.addEventListener("error", (event) => {
  console.error("Staff page error:", event.error || event.message);
  showDiagnostic("JavaScript error: " + (event.message || "Unknown error"));
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Staff page promise error:", event.reason);
  showDiagnostic("Firebase error: " + (event.reason?.message || String(event.reason)));
});

showDiagnostic("JavaScript loaded. Waiting for Firebase Authentication…");

async function loadLatestUpdate() {
  const target = $("#admin-last-update");
  if (!target) return;
  try {
    const response = await fetch("latest-update.txt?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to read update timestamp.");
    const value = (await response.text()).trim();
    target.textContent = value ? "Latest update: " + value : "Latest update: unavailable";
  } catch (error) {
    console.warn("Latest update timestamp error:", error);
    target.textContent = "Latest update: unavailable";
  }
}

loadLatestUpdate();

setTimeout(() => {
  const box = $("#staff-access");
  const content = $("#staff-content");
  if (box && !box.hidden && content?.hidden) {
    showAccess(
      "Authentication check is not completing",
      "Firebase did not finish the sign-in check within 12 seconds. Open F12 → Console and send me the error shown there."
    );
  }
}, 12000);

function withTimeout(promise, message = "Firebase request timed out after 10 seconds.") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 10000))
  ]);
}

function showAccess(message, detail) {
  const box = $("#staff-access");
  box.hidden = false;
  box.innerHTML = "<strong>" + message + "</strong><span>" + detail + "</span>";
}

const FEATURE_DEFAULTS = { catalog: true, sales: true, staff: true };
let detailUser = null;
let detailViewerRole = "";

function defaultFeaturesForRole(role) {
  return { ...FEATURE_DEFAULTS, ...(role === "admin" ? { staff: false } : {}) };
}

function formatDateValue(value) {
  const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
}

function openStaffDetails(user, viewerRole) {
  detailUser = user;
  detailViewerRole = viewerRole;
  const role = user.role || "admin";
  const expiresAt = user.expiresAt?.toDate ? user.expiresAt.toDate() : null;
  $("#staff-detail-title").textContent = user.email || "Member details";
  const meta = [
    ["Email", user.email || "Not recorded"],
    ["Role", roleLabel(role)],
    ["User ID", user.id],
    ["Status", user.active === true ? (expiresAt && expiresAt.getTime() <= Date.now() ? "Expired" : "Active") : "Inactive"],
    ["Valid until", expiresAt ? expiresAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "No expiry"],
    ["Owner UID", user.ownerUid || "Not applicable"],
    ["Created", formatDateValue(user.createdAt)]
  ];
  $("#staff-detail-meta").innerHTML = meta.map(([label, value]) =>
    '<div><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>'
  ).join("");
  const superAdmin = viewerRole === "super_admin";
  $("#staff-feature-section").hidden = !superAdmin;
  document.querySelector(".staff-notes-section").hidden = !superAdmin;
  $("#save-staff-details").hidden = !superAdmin;

  const canResetPassword =
    (viewerRole === "super_admin" && (role === "owner" || role === "admin")) ||
    (viewerRole === "owner" && role === "admin" && user.ownerUid === currentManagerUid);

  $("#staff-password-section").hidden = !canResetPassword;
  $("#staff-password-status").textContent = "";
  const resetPasswordButton = $("#reset-staff-password");
  if (resetPasswordButton) {
    resetPasswordButton.disabled = false;
    resetPasswordButton.textContent = "Send password reset email";
  }
  if (superAdmin) {
    const features = { ...defaultFeaturesForRole(role), ...(user.features && typeof user.features === "object" ? user.features : {}) };
    document.querySelectorAll("[data-feature-toggle]").forEach(input => {
      const key = input.dataset.featureToggle;
      input.checked = features[key] === true;
      input.disabled = role === "admin" && key === "staff";
    });
    $("#staff-member-notes").value = "Loading private notes…";
    getDoc(doc(db, "staffNotes", user.id))
      .then(snapshot => {
        if (detailUser?.id === user.id) {
          $("#staff-member-notes").value = snapshot.exists() ? (snapshot.data().notes || "") : "";
        }
      })
      .catch(error => {
        console.error("Load private staff note error:", error);
        if (detailUser?.id === user.id) $("#staff-member-notes").value = "";
      });
  }
  $("#staff-detail-status").textContent = "";
  $("#staff-detail-modal").hidden = false;
}

function closeStaffDetails() {
  detailUser = null;
  $("#staff-detail-modal").hidden = true;
}

async function resetStaffPassword() {
  if (!detailUser) return;

  const role = detailUser.role || "admin";
  const allowed =
    (detailViewerRole === "super_admin" && (role === "owner" || role === "admin")) ||
    (detailViewerRole === "owner" && role === "admin" && detailUser.ownerUid === currentManagerUid);

  if (!allowed || !detailUser.email) return;

  const button = $("#reset-staff-password");
  const status = $("#staff-password-status");
  button.disabled = true;
  button.textContent = "Sending…";
  status.textContent = "";

  try {
    await sendPasswordResetEmail(auth, detailUser.email);
    status.textContent = "Password reset email sent to " + detailUser.email + ".";
    button.textContent = "Reset email sent";
  } catch (error) {
    console.error("Password reset error:", error);
    status.textContent =
      error?.code === "auth/too-many-requests"
        ? "Too many reset requests. Please wait and try again."
        : (error?.message || "Unable to send the password reset email.");
    button.disabled = false;
    button.textContent = "Send password reset email";
  }
}

async function saveStaffDetails() {
  if (!detailUser || detailViewerRole !== "super_admin") return;
  const button = $("#save-staff-details");
  const status = $("#staff-detail-status");
  const features = {};
  document.querySelectorAll("[data-feature-toggle]").forEach(input => {
    features[input.dataset.featureToggle] = input.disabled ? false : input.checked;
  });
  button.disabled = true;
  status.textContent = "Saving…";
  try {
    await updateDoc(doc(db, "users", detailUser.id), { features });
    await setDoc(
      doc(db, "staffNotes", detailUser.id),
      { notes: $("#staff-member-notes").value.trim(), updatedAt: Timestamp.now() },
      { merge: true }
    );
    status.textContent = "Details saved.";
    await loadStaff("super_admin", currentManagerUid);
    setTimeout(closeStaffDetails, 500);
  } catch (error) {
    console.error("Save staff details error:", error);
    status.textContent = error?.message || "Unable to save member details.";
  } finally {
    button.disabled = false;
  }
}
function roleLabel(role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return role || "Unknown";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadStaff(currentRole, currentUid) {
  let users = [];

  if (currentRole === "owner") {
    // Owner sees their own Owner profile so they can always see
    // their account status and expiry, plus the Admin profiles.
    const [ownerSnapshot, adminSnapshot] = await Promise.all([
      withTimeout(getDoc(doc(db, "users", currentUid))),
      withTimeout(
        getDocs(collection(db, "ownerStaff", currentUid, "admins"))
      )
    ]);

    if (ownerSnapshot.exists()) {
      users.push({
        id: ownerSnapshot.id,
        ...ownerSnapshot.data(),
        isCurrentOwner: true
      });
    }

    currentManagerAdminCount = adminSnapshot.size;
    users.push(
      ...adminSnapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }))
    );
  } else {
    currentManagerAdminCount = 0;
    const snapshot = await withTimeout(getDocs(collection(db, "users")));

    users = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    // Keep the Owner Admin-cap metadata synchronized with the real
    // ownerStaff Admin mirrors. This is a Super Admin-only reconciliation
    // used to initialize existing Owners before the rule-enforced counter
    // becomes the source of truth for future Owner changes.
    const owners = users.filter(item => item.role === "owner");
    if (owners.length) {
      const ownerCounts = await Promise.all(
        owners.map(async owner => {
          const adminSnapshot = await withTimeout(
            getDocs(collection(db, "ownerStaff", owner.id, "admins"))
          );
          const adminUids = {};
          adminSnapshot.docs.forEach(item => {
            adminUids[item.id] = true;
          });
          return { ownerUid: owner.id, adminCount: adminSnapshot.size, adminUids };
        })
      );

      const syncBatch = writeBatch(db);
      ownerCounts.forEach(({ ownerUid, adminCount, adminUids }) => {
        syncBatch.set(
          doc(db, "ownerStaff", ownerUid),
          {
            adminCount,
            adminUids,
            lastAdminOperation: { type: "sync", uid: "" }
          },
          { merge: true }
        );
      });
      if (ownerCounts.length) await withTimeout(syncBatch.commit());
    }
  }

  const list = $("#staff-list");

  if (!users.length) {
    list.innerHTML = '<tr><td colspan="6">' +
      (currentRole === "owner"
        ? "No Owner or Admin profiles found."
        : "No staff profiles found.") +
      "</td></tr>";
    return;
  }

  list.innerHTML = users.map(user => {
    const role = user.role || "admin";
    const active = user.active === true;
    const expiresAt = user.expiresAt?.toDate ? user.expiresAt.toDate() : null;
    const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    const linkedOwner = role === "admin" && user.ownerUid
      ? users.find(item => item.id === user.ownerUid && item.role === "owner")
      : null;
    const ownerExpired = role === "admin"
      ? (!linkedOwner || linkedOwner.active === false || !!(linkedOwner.expiresAt?.toDate && linkedOwner.expiresAt.toDate().getTime() <= Date.now()))
      : false;
    const effectiveActive = active && !expired && !ownerExpired;

    const canManage = currentRole === "super_admin"
      ? role === "owner" || role === "admin"
      : role === "admin" && user.id !== currentUid;

    const canDelete = canManage && user.id !== currentUid;
    const canManageValidity =
      currentRole === "super_admin" &&
      (role === "owner" || role === "admin");

    const saleButton = role === "admin"
      ? '<a class="admin-secondary staff-sale-button" href="admin-sale.html">Sale</a>'
      : "";

    const roleOptions = currentRole === "super_admin"
      ? '<option value="owner"' + (role === "owner" ? " selected" : "") + '>Owner</option>' +
        '<option value="admin"' + (role === "admin" ? " selected" : "") + '>Admin</option>'
      : '<option value="admin" selected>Admin</option>';

    const ownerMarker = user.isCurrentOwner
      ? ' <small style="display:block;margin-top:4px;opacity:.7;">Your account</small>'
      : "";

    return `<tr>
      <td><strong>${escapeHtml(user.email || "No email")}</strong>${ownerMarker}</td>
      <td><span class="staff-role">${escapeHtml(roleLabel(role))}</span></td>
      <td><span class="status-pill ${effectiveActive ? "" : "draft"}">${expired ? "Expired" : (ownerExpired ? "Paused — Owner expired" : (active ? "Active" : "Inactive"))}</span></td>
      <td><span class="staff-validity ${expired ? "expired" : ""}" data-expiry="${expiresAt ? expiresAt.toISOString() : ""}">${expiresAt ? formatRemaining(expiresAt) : "No expiry"}</span></td>
      <td><code>${escapeHtml(user.id)}</code></td>
      <td><div class="staff-actions"><button type="button" class="admin-secondary" data-view-user="${escapeHtml(user.id)}">View</button>${canManage
        ? `<div class="staff-actions">
            <select data-role-for="${escapeHtml(user.id)}">${roleOptions}</select>
            <button type="button" class="admin-secondary" data-save-user="${escapeHtml(user.id)}">Save</button>
            ${canManageValidity
              ? `<button type="button" class="admin-secondary" data-extend-user="${escapeHtml(user.id)}">Extend</button>
                 <button type="button" class="admin-secondary danger" data-expire-user="${escapeHtml(user.id)}">Expire now</button>`
              : (expired
                ? ""
                : `<button type="button" class="admin-secondary" data-toggle-user="${escapeHtml(user.id)}">${effectiveActive ? "Deactivate" : "Activate"}</button>`)}
            ${canDelete ? `<button type="button" class="admin-secondary danger" data-delete-user="${escapeHtml(user.id)}">Delete</button>` : ""}
            ${saleButton}
          </div>`
        : saleButton}</div></td>
    </tr>`;
  }).join("");

  list.querySelectorAll("[data-view-user]").forEach(button => {
    button.addEventListener("click", () => {
      const user = users.find(item => item.id === button.dataset.viewUser);
      if (user) openStaffDetails(user, currentRole);
    });
  });

  list.querySelectorAll("[data-save-user]").forEach(button => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.saveUser;
      const select = list.querySelector('[data-role-for="' + CSS.escape(userId) + '"]');
      if (!select) return;

      button.disabled = true;

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, "users", userId), { role: select.value });
        if (currentRole === "owner") {
          batch.update(doc(db, "ownerStaff", currentUid, "admins", userId), {
            role: select.value
          });
        }
        await batch.commit();
        alert("Staff role updated.");
        await loadStaff(currentRole, currentUid);
      } catch (error) {
        console.error(error);
        alert("Unable to update this staff role. Check the Firebase rules and account permissions.");
      } finally {
        button.disabled = false;
      }
    });
  });

  list.querySelectorAll("[data-extend-user]").forEach(button => {
    button.addEventListener("click", async () => {
      if (currentRole !== "super_admin") return;

      const userId = button.dataset.extendUser;
      const user = users.find(item => item.id === userId);
      if (!user || !["owner", "admin"].includes(user.role)) return;

      const input = window.prompt(
        "Extend " + (user.email || "this account") + " by how many days?",
        "30"
      );
      if (input === null) return;

      const days = Number(input);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        alert("Enter a whole number of days between 1 and 3650.");
        return;
      }

      button.disabled = true;
      button.textContent = "Extending…";

      try {
        const now = Date.now();
        const currentExpiry = user.expiresAt?.toDate ? user.expiresAt.toDate().getTime() : 0;
        const base = Math.max(currentExpiry, now);
        const newExpiry = new Date(base + days * 86400000);
        const updates = {
          active: true,
          expiresAt: Timestamp.fromDate(newExpiry)
        };

        const batch = writeBatch(db);
        batch.update(doc(db, "users", userId), updates);

        if (user.role === "admin" && user.ownerUid) {
          batch.update(
            doc(db, "ownerStaff", user.ownerUid, "admins", userId),
            updates
          );
        }

        await batch.commit();
        alert(
          (user.email || "Staff account") +
          " extended until " +
          newExpiry.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) +
          "."
        );
        await loadStaff(currentRole, currentUid);
      } catch (error) {
        console.error("Extend staff validity error:", error);
        alert("Unable to extend this account validity. Check the Firebase rules.");
      } finally {
        button.disabled = false;
        button.textContent = "Extend";
      }
    });
  });

  list.querySelectorAll("[data-expire-user]").forEach(button => {
    button.addEventListener("click", async () => {
      if (currentRole !== "super_admin") return;

      const userId = button.dataset.expireUser;
      const user = users.find(item => item.id === userId);
      if (!user || !["owner", "admin"].includes(user.role)) return;

      if (!confirm(
        "Expire " + (user.email || "this account") +
        " immediately? They will see the renewal/access screen even if their current expiry date is still in the future."
      )) {
        return;
      }

      button.disabled = true;
      button.textContent = "Expiring…";

      try {
        // Store an expiry one second in the past so this account is
        // immediately expired regardless of its previous future date.
        const updates = {
          active: true,
          expiresAt: Timestamp.fromMillis(Date.now() - 1000)
        };

        const batch = writeBatch(db);
        batch.update(doc(db, "users", userId), updates);

        if (user.role === "admin" && user.ownerUid) {
          batch.update(
            doc(db, "ownerStaff", user.ownerUid, "admins", userId),
            updates
          );
        }

        await batch.commit();
        alert((user.email || "Staff account") + " is now expired.");
        await loadStaff(currentRole, currentUid);
      } catch (error) {
        console.error("Expire staff validity error:", error);
        alert("Unable to expire this account. Check the Firebase rules.");
      } finally {
        button.disabled = false;
        button.textContent = "Expire now";
      }
    });
  });
  list.querySelectorAll("[data-delete-user]").forEach(button => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.deleteUser;
      const row = button.closest("tr");
      const email = row?.querySelector("td strong")?.textContent || userId;

      if (!confirm("Delete " + email + " from Gifty Hamper staff? This will remove their application access.")) {
        return;
      }

      button.disabled = true;
      button.textContent = "Deleting…";

      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", userId));
        if (currentRole === "owner") {
          batch.delete(doc(db, "ownerStaff", currentUid, "admins", userId));
          batch.set(
            doc(db, "ownerStaff", currentUid),
            {
              adminCount: increment(-1),
              ["adminUids." + userId]: deleteField(),
              lastAdminOperation: { type: "remove", uid: userId }
            },
            { merge: true }
          );
        } else {
          const targetProfile = await withTimeout(getDoc(doc(db, "users", userId)));
          const targetOwnerUid = targetProfile.exists() ? targetProfile.data().ownerUid : null;
          if (targetOwnerUid) {
            batch.delete(doc(db, "ownerStaff", targetOwnerUid, "admins", userId));
            batch.set(
              doc(db, "ownerStaff", targetOwnerUid),
              {
                adminCount: increment(-1),
                ["adminUids." + userId]: false,
                lastAdminOperation: { type: "remove", uid: userId }
              },
              { merge: true }
            );
          }
        }
        await batch.commit();
        alert("Staff user deleted successfully.");
        await loadStaff(currentRole, currentUid);
      } catch (error) {
        console.error("Delete staff error:", error);
        alert("Unable to delete this staff user. Check the Firebase Firestore rules.");
        button.disabled = false;
        button.textContent = "Delete";
      }
    });
  });

  list.querySelectorAll("[data-toggle-user]").forEach(button => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.toggleUser;
      const row = button.closest("tr");
      const activeNow = row?.querySelector(".status-pill")?.textContent.trim() === "Active";

      button.disabled = true;

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, "users", userId), { active: !activeNow });
        if (currentRole === "owner") {
          batch.update(doc(db, "ownerStaff", currentUid, "admins", userId), {
            active: !activeNow
          });
        }
        await batch.commit();
        alert(activeNow ? "Staff account marked inactive." : "Staff account activated.");
        await loadStaff(currentRole, currentUid);
      } catch (error) {
        console.error(error);
        alert("Unable to update this staff status.");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function formatRemaining(expiresAt) {
  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / 86400000);
  return days === 1 ? "1 day left" : days + " days left";
}

function refreshValidityLabels() {
  document.querySelectorAll("[data-expiry]").forEach(element => {
    const raw = element.dataset.expiry;
    if (!raw) return;
    const expiresAt = new Date(raw);
    const diff = expiresAt.getTime() - Date.now();

    if (diff <= 0) {
      element.textContent = "Expired";
      element.classList.add("expired");
      return;
    }

    const days = Math.ceil(diff / 86400000);
    element.textContent = days === 1 ? "1 day left" : days + " days left";
  });
}

setInterval(refreshValidityLabels, 60000);

let staffRoleToCreate = "admin";
let staffCreateMode = "create";
let currentManagerRole = "";
let currentManagerUid = "";
let currentManagerAdminCount = 0;
let staffCreateOwners = [];

function isActiveOwnerProfile(user) {
  if (!user || user.role !== "owner" || user.active !== true) return false;
  const expiresAt = user.expiresAt?.toDate ? user.expiresAt.toDate() : null;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

function populateOwnerSelector(owners) {
  const field = $("#new-staff-owner-field");
  const select = $("#new-staff-owner");
  if (!field || !select) return;

  staffCreateOwners = owners.filter(isActiveOwnerProfile);
  select.innerHTML = '<option value="">Choose an Owner</option>' +
    staffCreateOwners
      .sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")))
      .map(owner =>
        '<option value="' + escapeHtml(owner.id) + '">' +
        escapeHtml(owner.email || owner.id) +
        '</option>'
      )
      .join("");
}

async function loadOwnerChoices() {
  if (currentManagerRole !== "super_admin") {
    populateOwnerSelector([]);
    return;
  }

  const snapshot = await withTimeout(getDocs(collection(db, "users")));
  populateOwnerSelector(
    snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(item => item.role === "owner")
  );
}

async function openStaffModal(role) {
  if (role === "admin" && currentManagerRole === "owner" && currentManagerAdminCount >= 5) {
    alert("This Owner already has 5 Admins. The maximum is 5 Admin accounts.");
    return;
  }

  staffCreateMode = "create";
  staffRoleToCreate = role;
  $("#staff-modal-title").textContent = role === "owner" ? "Add Owner" : "Add Admin";
  $("#new-staff-role").textContent = role === "owner" ? "Owner" : "Admin";
  $("#new-staff-email").value = "";
  $("#new-staff-password").value = "";
  $("#new-staff-password-confirm").value = "";
  $("#new-staff-validity").value = "60";
  $("#new-staff-validity").disabled = role === "admin" && currentManagerRole === "owner";
  const validityLabel = $("#new-staff-validity")?.closest(".staff-modal-label");
  if (validityLabel) validityLabel.hidden = role === "admin" && currentManagerRole === "owner";

  const ownerField = $("#new-staff-owner-field");
  if (ownerField) ownerField.hidden = !(role === "admin" && currentManagerRole === "super_admin");
  $("#new-staff-owner").value = "";

  if (role === "admin" && currentManagerRole === "super_admin") {
    $("#staff-modal-status").textContent = "Loading active Owners…";
    try {
      await loadOwnerChoices();
      if (!staffCreateOwners.length) {
        $("#staff-modal-status").textContent = "No active Owners are available. Create or activate an Owner first.";
      }
    } catch (error) {
      console.error("Load Owner choices error:", error);
      $("#staff-modal-status").textContent = error?.message || "Unable to load Owner accounts.";
    }
  }

  $("#staff-modal-description").textContent =
    role === "admin" && currentManagerRole === "owner"
      ? "Owners can create up to 5 Admins. Each Owner-created Admin receives exactly 60 days of validity."
      : role === "admin" && currentManagerRole === "super_admin"
        ? "Choose the Owner who will manage this Admin. The Admin will be linked to that Owner and appear in the Owner's staff account."
        : "Set the email, initial password and how many days this account should remain active.";
  $("#staff-modal-status").textContent =
    role === "admin" && currentManagerRole === "super_admin" && !staffCreateOwners.length
      ? "No active Owners are available. Create or activate an Owner first."
      : "";
  $("#create-staff-account").disabled = false;
  $("#staff-modal").hidden = false;
  setTimeout(() => $("#new-staff-email")?.focus(), 0);
}

function closeStaffModal() {
  $("#staff-modal").hidden = true;
}

function randomTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => chars[value % chars.length]).join("");
}

async function createStaffAccount() {
  const email = $("#new-staff-email").value.trim().toLowerCase();
  const password = $("#new-staff-password").value;
  const confirmPassword = $("#new-staff-password-confirm").value;
  const ownerCreatingAdmin = currentManagerRole === "owner" && staffRoleToCreate === "admin";
  const superAdminCreatingAdmin = currentManagerRole === "super_admin" && staffRoleToCreate === "admin";
  const selectedOwnerUid = superAdminCreatingAdmin ? $("#new-staff-owner").value.trim() : "";
  const validityDays = ownerCreatingAdmin ? 60 : Number($("#new-staff-validity").value);
  const status = $("#staff-modal-status");
  const button = $("#create-staff-account");

  if (!email || !email.includes("@")) {
    status.textContent = "Enter a valid email address.";
    return;
  }
  if (password.length < 6) {
    status.textContent = "Password must be at least 6 characters.";
    return;
  }
  if (password !== confirmPassword) {
    status.textContent = "Passwords do not match.";
    return;
  }
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) {
    status.textContent = "Validity must be between 1 and 3650 days.";
    return;
  }
  if (ownerCreatingAdmin && currentManagerAdminCount >= 5) {
    status.textContent = "This Owner already has the maximum of 5 Admins.";
    return;
  }
  if (superAdminCreatingAdmin && !selectedOwnerUid) {
    status.textContent = "Choose an Owner for this Admin.";
    return;
  }

  let selectedOwner = null;
  let ownerAdminUids = {};
  let selectedOwnerAdminCount = 0;

  if (superAdminCreatingAdmin) {
    selectedOwner = staffCreateOwners.find(owner => owner.id === selectedOwnerUid) || null;
    if (!selectedOwner || !isActiveOwnerProfile(selectedOwner)) {
      status.textContent = "Choose an active Owner account.";
      return;
    }

    status.textContent = "Checking selected Owner capacity…";
    const mirrorSnapshot = await withTimeout(
      getDocs(collection(db, "ownerStaff", selectedOwnerUid, "admins"))
    );
    if (mirrorSnapshot.size >= 5) {
      status.textContent = "This Owner already has the maximum of 5 Admins.";
      return;
    }

    mirrorSnapshot.docs.forEach(item => {
      ownerAdminUids[item.id] = true;
    });
    selectedOwnerAdminCount = mirrorSnapshot.size;

    await withTimeout(
      setDoc(
        doc(db, "ownerStaff", selectedOwnerUid),
        {
          adminCount: selectedOwnerAdminCount,
          adminUids: ownerAdminUids,
          lastAdminOperation: { type: "sync", uid: "" }
        },
        { merge: true }
      )
    );
  }

  button.disabled = true;
  status.textContent = "Checking Owner Admin capacity…";

  if (ownerCreatingAdmin) {
    const mirrorSnapshot = await withTimeout(
      getDocs(collection(db, "ownerStaff", currentManagerUid, "admins"))
    );
    if (mirrorSnapshot.size >= 5) {
      status.textContent = "This Owner already has the maximum of 5 Admins.";
      button.disabled = false;
      currentManagerAdminCount = mirrorSnapshot.size;
      return;
    }

    mirrorSnapshot.docs.forEach(item => {
      ownerAdminUids[item.id] = true;
    });
    currentManagerAdminCount = mirrorSnapshot.size;

    // Reconcile the rule-enforced counter with the real Admin mirror
    // before attempting the new atomic creation.
    await withTimeout(
      setDoc(
        doc(db, "ownerStaff", currentManagerUid),
        {
          adminCount: currentManagerAdminCount,
          adminUids: ownerAdminUids,
          lastAdminOperation: { type: "sync", uid: "" }
        },
        { merge: true }
      )
    );
  }

  status.textContent = "Creating Firebase account…";

  try {
    const credential = await createUserWithEmailAndPassword(
      staffCreatorAuth,
      email,
      password
    );

    const expiresAt = new Date(Date.now() + validityDays * 86400000);

    try {
      const profileData = {
        email,
        role: staffRoleToCreate,
        active: true,
        expiresAt: Timestamp.fromDate(expiresAt),
        validityDays,
        createdAt: Timestamp.now(),
        features: defaultFeaturesForRole(staffRoleToCreate),
        ...(staffRoleToCreate === "admin" && (currentManagerRole === "owner" || currentManagerRole === "super_admin")
          ? { ownerUid: currentManagerRole === "owner" ? currentManagerUid : selectedOwnerUid }
          : {})
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "users", credential.user.uid), profileData);

      if (staffRoleToCreate === "admin" && (currentManagerRole === "owner" || currentManagerRole === "super_admin")) {
        const ownerUid = currentManagerRole === "owner" ? currentManagerUid : selectedOwnerUid;
        const currentOwnerAdminCount = currentManagerRole === "owner"
          ? currentManagerAdminCount
          : selectedOwnerAdminCount;
        const nextAdminUids = { ...ownerAdminUids, [credential.user.uid]: true };

        batch.set(
          doc(db, "ownerStaff", ownerUid, "admins", credential.user.uid),
          profileData
        );
        batch.set(
          doc(db, "ownerStaff", ownerUid),
          {
            adminCount: currentOwnerAdminCount + 1,
            adminUids: nextAdminUids,
            lastAdminOperation: { type: "add", uid: credential.user.uid }
          },
          { merge: true }
        );
      } else if (staffRoleToCreate === "owner" && currentManagerRole === "super_admin") {
        // Initialize the Owner's rule-enforced Admin counter immediately.
        batch.set(
          doc(db, "ownerStaff", credential.user.uid),
          {
            adminCount: 0,
            adminUids: {},
            lastAdminOperation: { type: "sync", uid: "" }
          },
          { merge: true }
        );
      }

      await batch.commit();
    } catch (profileError) {
      await deleteUser(credential.user);
      throw profileError;
    }

    if (ownerCreatingAdmin) currentManagerAdminCount += 1;
    status.textContent = "Account created successfully.";
    $("#new-staff-email").value = "";
    $("#new-staff-password").value = "";
    $("#new-staff-password-confirm").value = "";
    $("#new-staff-owner").value = "";

    setTimeout(async () => {
      closeStaffModal();
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      const profile = await getDoc(doc(db, "users", auth.currentUser.uid));
      const role = tokenResult.claims.role === "super_admin"
        ? "super_admin"
        : (profile.exists() ? profile.data().role : "admin");
      await loadStaff(role, currentManagerUid);
    }, 700);
  } catch (error) {
    console.error("Create staff error:", error);
    status.textContent = error?.code === "auth/email-already-in-use"
      ? "That email already has a Firebase account."
      : (error?.message || "Unable to create the staff account.");
    button.disabled = false;
  }
}

$("#add-owner")?.addEventListener("click", () => openStaffModal("owner"));
$("#add-admin")?.addEventListener("click", () => openStaffModal("admin"));
$("#create-staff-account")?.addEventListener("click", createStaffAccount);

document.querySelectorAll("[data-close-staff-modal]").forEach(element => {
  element.addEventListener("click", closeStaffModal);
});

document.querySelectorAll("[data-close-detail-modal]").forEach(element => {
  element.addEventListener("click", closeStaffDetails);
});

$("#save-staff-details")?.addEventListener("click", saveStaffDetails);
$("#reset-staff-password")?.addEventListener("click", resetStaffPassword);

onAuthStateChanged(auth, async (user) => {
  showDiagnostic(user ? "Firebase Authentication detected your signed-in account. Loading permissions…" : "Firebase Authentication is ready, but no signed-in account was detected.");
  if (!user) {
    window.location.replace("admin-login.html");
    return;
  }

  try {
    showDiagnostic("Signed in as " + (user.email || "your account") + ". Reading your Firebase permissions…");
    const tokenResult = await withTimeout(user.getIdTokenResult(true), "Firebase token request timed out after 10 seconds.");
    const claimRole = tokenResult.claims.role || "";
    const profileSnapshot = await withTimeout(getDoc(doc(db, "users", user.uid)));
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    const profileRole = profile?.role || "";

    currentManagerUid = user.uid;
    currentManagerRole = claimRole === "super_admin" ? "super_admin" : profileRole;

    const effectiveRole = claimRole === "super_admin" ? "super_admin" : profileRole;

    $("#admin-user-email").textContent =
      (user.email || "Signed-in admin") + " • " + (effectiveRole || "unknown");

    const managerExpiry = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;
    const managerExpired = managerExpiry ? managerExpiry.getTime() <= Date.now() : false;

    if (
      !["super_admin", "owner"].includes(effectiveRole) ||
      profile?.active === false ||
      managerExpired
    ) {
      showAccess("Access restricted", "Only the Super Admin and active Owner can manage staff.");
      return;
    }

    $("#staff-access").hidden = true;
    $("#staff-content").hidden = false;

    const validity = $("#admin-account-validity");

    if (validity) {
      if (effectiveRole === "super_admin") {
        validity.textContent = "Unlimited access";
      } else if (managerExpiry) {
        const updateManagerValidity = () => {
          const diff = managerExpiry.getTime() - Date.now();
          validity.textContent =
            diff <= 0
              ? "Expired"
              : (Math.ceil(diff / 86400000) + " days left");
        };

        updateManagerValidity();
        setInterval(updateManagerValidity, 60000);
      }
    }

    $("#add-owner").hidden = effectiveRole !== "super_admin";
    $("#add-admin").hidden = !["super_admin", "owner"].includes(effectiveRole);

    await loadStaff(effectiveRole, user.uid);
  } catch (error) {
    console.error("Staff page error:", error);
    showAccess(
      "Unable to load staff management",
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

$("#staff-refresh")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const tokenResult = await user.getIdTokenResult(true);
  const profile = await getDoc(doc(db, "users", user.uid));
  const role = tokenResult.claims.role === "super_admin"
    ? "super_admin"
    : (profile.exists() ? profile.data().role : "admin");

  await loadStaff(role, user.uid);
});
