import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  signOut
} from "./firebase-auth.js";

const setLoadingState = () => {
  document.documentElement.classList.add("admin-auth-checking");
};

setLoadingState();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("admin-login.html");
    return;
  }

  try {
    // Refresh the ID token so newly assigned Firebase custom claims are available.
    const tokenResult = await user.getIdTokenResult(true);
    const claimRole = tokenResult.claims.role || "";

    // Super Admin is identified by the secure custom claim.
    // Owner/Admin roles are stored in the user's Firestore profile.
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    const profileRole = profile?.role || "";
    const role = claimRole === "super_admin" ? "super_admin" : (profileRole || "admin");
    const expiresAt = profile?.expiresAt?.toDate ? profile.expiresAt.toDate() : null;
    const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    const active = profile?.active !== false && !expired;

    document.documentElement.classList.remove("admin-auth-checking");

    const email = document.querySelector("#admin-user-email");
    if (email) {
      email.textContent = `${user.email || "Signed-in admin"} • ${claimRole}`;
    }

    let ownerProfile = null;
    let ownerExpired = false;
    if (profileRole === "admin" && profile?.ownerUid) {
      const ownerSnapshot = await getDoc(doc(db, "users", profile.ownerUid));
      ownerProfile = ownerSnapshot.exists() ? ownerSnapshot.data() : null;
      const ownerExpiry = ownerProfile?.expiresAt?.toDate ? ownerProfile.expiresAt.toDate() : null;
      ownerExpired = !ownerProfile || ownerProfile.role !== "owner" || ownerProfile.active === false || (ownerExpiry && ownerExpiry.getTime() <= Date.now());
    }

    // Access blocking is handled by admin-feature-guard.js so expired users
    // stay signed in and receive the correct Owner/Admin access message.
    if (claimRole !== "super_admin" && (!profile || !profileRole || !active || ownerExpired)) {
      return;
    }

    // Make the authenticated user and both Firebase role sources
    // available to the admin dashboard.
    window.giftyAdminUser = {
      uid: user.uid,
      email: user.email || "",
      role,
      profileRole,
      active,
      firestoreProfile: profile
    };

    document.documentElement.dataset.adminRole = role;

    const validity = document.querySelector("#admin-account-validity");
    if (validity && role === "owner" && expiresAt) {
      validity.dataset.expiry = expiresAt.toISOString();
      const updateValidity = () => {
        const diff = expiresAt.getTime() - Date.now();
        validity.textContent = diff <= 0 ? "Expired" : (Math.ceil(diff / 86400000) + " days left");
      };
      updateValidity();
      setInterval(updateValidity, 60000);
    } else if (validity && role === "super_admin") {
      validity.textContent = "Unlimited access";
    } else if (validity && role === "admin" && ownerProfile?.expiresAt?.toDate) {
      const ownerExpiry = ownerProfile.expiresAt.toDate();
      const updateOwnerValidity = () => {
        const diff = ownerExpiry.getTime() - Date.now();
        validity.textContent = diff <= 0 ? "Owner expired" : ("Owner: " + Math.ceil(diff / 86400000) + " days left");
      };
      updateOwnerValidity();
      setInterval(updateOwnerValidity, 60000);
    }

    console.log("Gifty Hamper admin:", {
      uid: user.uid,
      email: user.email,
      customClaimRole: claimRole || "none",
      firestoreRole: profileRole,
      effectiveRole: role,
      active,
      expiresAt,
      expired,
      firestoreProfileFound: !!profile
    });
  } catch (error) {
    console.error("Unable to read Firebase admin profile:", error);
    document.documentElement.classList.remove("admin-auth-checking");
    // Do not sign the user out here. The feature guard owns access blocking
    // and will show the appropriate access screen.
    return;
  }

  const logout = document.querySelector("#admin-logout");
  if (logout) {
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      logout.textContent = "Signing out…";
      await signOut(auth);
      window.location.replace("admin-login.html");
    });
  }
});
