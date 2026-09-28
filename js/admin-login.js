import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from "./firebase-auth.js";

const form = document.querySelector("#admin-login-form");
const emailInput = document.querySelector("#admin-email");
const passwordInput = document.querySelector("#admin-password");
const submitButton = document.querySelector("#admin-login-submit");
const message = document.querySelector("#admin-login-message");
const resetButton = document.querySelector("#admin-reset-password");

const setMessage = (text, type = "") => {
  message.textContent = text;
  message.className = "admin-login-message " + type;
};

function isExpired(profile) {
  const expiry = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;
  return profile?.active === false || (!!expiry && expiry.getTime() <= Date.now());
}

async function handleAuthenticatedUser(user) {
  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    const profile = snapshot.exists() ? snapshot.data() : null;
    const role = profile?.role || "";

    if (role === "owner" && isExpired(profile)) {
      showRenewalScreen("owner");
      return;
    }

    if (role === "admin" && isExpired(profile)) {
      showRenewalScreen("admin");
      return;
    }

    if (role === "admin" && profile?.ownerUid) {
      const ownerSnapshot = await getDoc(doc(db, "users", profile.ownerUid));
      const owner = ownerSnapshot.exists() ? ownerSnapshot.data() : null;
      if (!owner || owner.role !== "owner" || isExpired(owner)) {
        showRenewalScreen("admin-owner");
        return;
      }
    }

    window.location.replace("admin.html");
  } catch (error) {
    console.error("Unable to check account status:", error);
    // Keep the authenticated session. The admin access guard will handle
    // the account and show the appropriate access screen.
    window.location.replace("admin.html");
  }
}

function showRenewalScreen(type) {
  const isOwner = type === "owner";
  const isAdminOwner = type === "admin-owner";
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#fbf7fa;font-family:Arial,sans-serif;">
      <section style="width:min(560px,100%);background:#fff;border:1px solid #eadde5;border-radius:20px;padding:34px;box-shadow:0 20px 60px rgba(36,29,43,.08);text-align:center;">
        <p style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8c8177;">Gifty Hamper</p>
        <h1 style="margin:8px 0 10px;">${isOwner ? "Owner access unavailable" : "Admin access unavailable"}</h1>
        <p style="color:#6f6877;line-height:1.6;">
          ${isOwner
            ? "Your Owner account validity has expired. Kindly contact the Web Developer / Provider to renew your service."
            : isAdminOwner
              ? "Your Owner's validity has expired. Please contact your Owner to renew access."
              : "Your admin account is inactive or its validity has expired. Please contact your Owner."}
        </p>
        ${isOwner
          ? '<a href="https://wa.me/918667298507" target="_blank" rel="noopener" style="display:inline-block;margin-top:14px;font-weight:700;color:#6f2b78;">WhatsApp: +91 8667298507 (Ashish)</a>'
          : ""}
      </section>
    </main>`;
  document.documentElement.classList.remove("admin-auth-checking");
}

const params = new URLSearchParams(window.location.search);
const reason = params.get("reason");
if (reason === "owner-expired") {
  setMessage(
    "Your Owner's validity has expired. Please contact your Owner to renew access.",
    "error"
  );
} else if (reason === "owner-account-expired") {
  setMessage(
    "Your Owner account validity has expired. Kindly contact the Web Developer / Provider to renew your service.",
    "error"
  );
  const providerContact = document.querySelector("#provider-contact");
  if (providerContact) providerContact.hidden = false;
} else if (reason === "account-expired") {
  setMessage(
    "Your admin account is inactive or its validity has expired. Please contact your Owner.",
    "error"
  );
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    void handleAuthenticatedUser(user);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage("Enter your email and password.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Signing in…";
  setMessage("Checking your account…");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    setMessage("Login successful. Checking account access…", "success");
    await handleAuthenticatedUser(credential.user);
  } catch (error) {
    console.error(error);
    const code = error?.code || "";
    const text = code === "auth/invalid-credential"
      ? "The email or password is incorrect."
      : code === "auth/too-many-requests"
        ? "Too many attempts. Please wait a while and try again."
        : "We could not sign you in. Please check your details.";
    setMessage(text, "error");
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
});

resetButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!email) {
    setMessage("Enter your email first, then choose Forgot password.", "error");
    emailInput.focus();
    return;
  }

  resetButton.disabled = true;
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage("If that account exists, Firebase has sent a password reset email.", "success");
  } catch (error) {
    console.error(error);
    setMessage("We could not send the reset email. Check the email address and try again.", "error");
  } finally {
    resetButton.disabled = false;
  }
});
