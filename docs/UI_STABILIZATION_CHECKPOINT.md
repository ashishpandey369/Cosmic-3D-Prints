# UI Stabilization Checkpoint

## Goal
Stabilize the mobile homepage/shop experience without introducing duplicate navigation, catalog, or recently-viewed logic.

## Current diagnosis
1. The homepage and shop intentionally have different marketplace/header markup, but the homepage must reuse the project's existing shared `.menu-toggle` + `#primary-nav` logic from `js/main.js`.
2. The homepage currently has marketplace-specific mobile header CSS that overrides the shared header grid. This is causing the menu/header arrangement to differ from the stable shop layout.
3. Recently Viewed is stored in localStorage by `js/product.js`, while the homepage reads it from `js/home-marketplace.js`. The current implementation uses an expiring list, but the homepage does not validate/refresh entries against the live Firebase catalog after rendering.
4. The homepage currently renders the first 10 active products in For You, while Recently Viewed is a separate horizontal shelf. This separation must remain: viewing a product must never remove it from For You/all products.
5. Firebase public catalog loading is centralized in `js/catalog-store.js` through `loadPublicCatalog()`; no catalog data should be duplicated or rewritten by this UI work.

## Safe implementation sequence
- Step 1: Document and isolate the existing behavior (this checkpoint) — completed.
- Step 2: Normalize the homepage mobile header to the same shared menu positioning without changing `js/main.js` — completed. Also removed a literal `\\n` text artifact from `index.html` that was visible above the header.
- Step 3: Make Recently Viewed a clean temporary reference list, deduplicated by product id, refreshed on view, expired after 7 days, and always resolved against the live catalog — completed by centralizing the storage/read logic in `js/catalog-store.js`.
- Step 4: Keep For You independent from Recently Viewed and show exactly 10 active products before the View More CTA — verified in `js/home-marketplace.js`.
- Step 5: Refresh cache versions only for files whose behavior changed — homepage cache bumped to `v=3`.
- Step 6: Verify no duplicate menu functions/selectors or catalog mutation were introduced — completed. Final checks found no `setupMarketplaceMenu` or `marketplace-menu-toggle` references; public catalog remains Firebase-backed; Recently Viewed is localStorage-only and separate from the catalog.

## Guardrails
- Do not change Firebase schema/rules for this UI task.
- Do not replace the existing shared menu logic.
- Do not remove products from the catalog because they appear in Recently Viewed.
- Do not seed or overwrite Firebase products from the homepage.
- Make one focused change at a time and update this checkpoint after each step.


## Step 7: Product-page “More to love” shelf
- Requested behavior: make the product-page More to love section use the same horizontal shelf interaction as Recently Viewed.
- Target: show up to 10 related/active products instead of 3, keep the existing View all gifts CTA, and add left/right scroll controls with disabled-state handling and touch/trackpad horizontal scrolling.
- Guardrails: keep the current product-page catalog source, do not alter Firebase data, and do not change the existing Recently Viewed behavior.
- Status: completed. The product page now renders up to 10 active related products, keeps the existing View all gifts link, and uses the same left/right horizontal shelf interaction with disabled arrow states and touch/trackpad scrolling.


## Step 8: Shared category management and storefront category browsing
- Category metadata is now stored in the Firestore `categories` collection so names/images are shared across admin sessions and storefront devices.
- Admin major and minor category cards now show an image thumbnail, pencil edit action, and delete action. Editing supports category-name changes plus image URL upload/file upload/remove.
- Category image uploads are resized in the browser before being stored as compact WebP data URLs, keeping each category image in its own Firestore document rather than adding a large catalog blob.
- Existing local category names are migrated into Firestore when the shared category collection is first initialized.
- The homepage Shop by category shelf now shows the first 15 shared categories and links to a dedicated all-categories page.
- The new all-categories page uses large circular category images, six categories per desktop row, responsive scrolling down the page, and links each category directly to the existing shop category filter.
- Existing product-category assignments are preserved when a category is renamed; deleting a category now also persists the corresponding product assignment cleanup/move before removing the category record.
- Firebase product schema and existing Recently Viewed/More to love logic remain unchanged.
- Status: completed after repository verification.


## Step 9: Homepage category images
- Fixed the homepage Shop by category mapper so it preserves each shared Firestore category's `image` field instead of rebuilding the category with an empty image.
- The homepage now uses the exact same category image stored by the Admin category editor and displayed on the all-categories page.
- Category IDs are also preserved from the shared records; fallback categories are still generated only when the shared category collection is unavailable.
- Status: completed.


## Step 10: Product image save reliability
- Product image file uploads are now resized to a maximum 1000px dimension and encoded as WebP before being stored in the Firestore product document.
- This prevents large original camera/image files and multiple uploads from unnecessarily exceeding Firestore's 1 MiB document limit.
- The admin product save error now exposes the underlying Firestore error message in addition to logging the detailed error object, making future rule/storage failures diagnosable instead of always showing a generic rules message.
- Direct image URLs continue to work unchanged.
- Status: completed.


## Step 11: ImageKit media storage integration

- New product and category image uploads now target ImageKit instead of storing new image data inside Firestore.
- The browser requests short-lived ImageKit upload authentication from the Cloudflare Worker at `gifty-hamper.arindia-in.workers.dev`; the ImageKit private key is never included in frontend code.
- Product documents retain the existing `images` array for compatibility and also store parallel `imageKitFileIds` metadata for managed-file deletion.
- Category documents retain the existing `image` field and also store `imageFileId` metadata for managed-file deletion.
- Direct image URLs entered through the Admin UI are imported into ImageKit first, so new catalog images are consistently managed by ImageKit.
- Existing Base64/data-URL images remain supported and are not deleted automatically during this migration.
- Product-image removal and product deletion remove associated ImageKit assets when a managed ImageKit file ID is available. Category image replacement/removal and category deletion follow the same rule.
- Firebase Cloud Functions are no longer used for ImageKit operations, so this integration does not require Firebase Blaze or Firebase Cloud Functions billing.
- Added `wrangler.toml` and `cloudflare-worker/src/index.js` for the secure ImageKit Worker backend.
- Status: frontend integration and Worker code are committed. The remaining deployment step is to add the ImageKit private key as a Cloudflare Worker Secret and let the existing Cloudflare Git deployment publish the new Worker script.

### Cloudflare Worker deployment checklist

1. In Cloudflare Workers & Pages, keep the existing `gifty-hamper` Worker connected to the GitHub repository.
2. The repository now contains `wrangler.toml` with `main = "cloudflare-worker/src/index.js"`. This changes the deployment from the previous static-assets-only setup to an actual Worker script.
3. In the Worker settings, add the encrypted secret named `IMAGEKIT_PRIVATE_KEY`. Paste the ImageKit private key only into Cloudflare's secret field; never commit it to GitHub or put it in frontend JavaScript.
4. Allow the Git-connected deployment to run `npx wrangler deploy`. After deployment, the Worker endpoint remains `https://gifty-hamper.arindia-in.workers.dev`.
5. Test the Worker endpoint in a browser: `https://gifty-hamper.arindia-in.workers.dev/` should return a small JSON status response. ImageKit endpoints additionally require a valid Firebase-authenticated catalog staff account.
6. Test Admin product image upload, category image upload, direct URL import, image removal, product deletion and category deletion.
7. Existing Firestore-hosted Base64/data-URL images remain intact. Only newly managed ImageKit files are removed through the ImageKit file ID metadata.
8. Do not run `firebase deploy --only functions`, do not add the ImageKit private key to Firebase, and do not upgrade the Firebase project to Blaze for this feature.
9. Never commit the ImageKit private key or expose it in `js/`, HTML, GitHub Actions logs, or other frontend files.


## Step 12 — Stage category images until save
- Category image selection is now staged in the admin editor instead of uploading immediately to ImageKit.
- File/URL selection shows a preview, but ImageKit upload happens only when the category is actually saved.
- If category save fails, any newly uploaded ImageKit file is deleted automatically.
- Cancel/close or replacing a pending selection no longer creates unnecessary ImageKit assets.
- Existing saved category ImageKit files remain protected until the new category save succeeds.
- Removing an existing category image clears Firestore and then deletes the old ImageKit file.
- Admin cache was refreshed so the new workflow is loaded by GitHub Pages.
- Status: completed after repository verification.


## Step 13 — Most Sold Categories homepage slideshow
- Added a separate Firestore-backed homepage showcase setting at `homepageSettings/mostSoldCategories`.
- Admin now has a dedicated Most Sold Categories panel directly above Major categories, with support for up to 20 separate PNG/JPG/WebP images.
- Selected images are staged locally and uploaded to ImageKit only when Save slideshow is pressed.
- Removed saved images are deleted from ImageKit only after the Firestore slideshow settings save succeeds; failed saves clean up newly uploaded files.
- Homepage hero logo position now uses the saved images as a random slideshow with automatic rotation, previous/next controls and slide dots. If no images are configured, the existing Gifty Hamper logo remains as the fallback.
- Existing product/category/catalog behavior was left unchanged.
- Added Firestore rules for public active slideshow reads and catalog-staff management.
- Admin cache was refreshed.
- Status: completed in GitHub. The new Firestore rule block must be published in Firebase before the first slideshow settings save.


## Step 14 — Most Sold product selection instead of image uploads
- Replaced the Most Sold image-upload workflow with product selection from the existing shared catalog.
- Admin now lets staff select up to 20 active products for the homepage Most Sold slideshow; no additional photos are uploaded to ImageKit.
- The selection is stored directly on each product as `mostSold: true/false`, using the existing catalog write permissions. This avoids introducing a new Firestore settings collection and removes the previous slideshow save-permission problem.
- The homepage slideshow now reads the selected active products and uses each product's existing primary image.
- Clicking the slideshow opens `shop.html?collection=most-sold`, which shows all currently selected Most Sold products.
- Existing product images, ImageKit management, category management, product deletion, and normal catalog behavior remain unchanged.
- Removed the unused image-based Most Sold settings store and its Firestore rule.
- Status: completed in GitHub. No new image uploads are required for Most Sold.


## Step 15 — Compact Most Sold product picker
- Split the Most Sold admin control into two panes: searchable All Products on the left and Selected Most Sold on the right.
- Product cards are compact to avoid a large vertical list.
- Ticking a product immediately reflects it in the Selected Most Sold pane.
- Selected products can be removed individually from the right pane.
- Save action is separated into a bottom row.
- Maximum remains 20 selected products.
- Status: completed in GitHub.


## Step 16 — Most Sold slideshow timing and category navigation
- Most Sold homepage slides now change every 1 second.
- Clicking the current slideshow opens a dedicated Most Sold category view instead of the generic Most Sold product list.
- The category view shows only categories represented by the selected Most Sold products.
- Selecting one of those categories opens the shop with both the Most Sold collection and that category filter applied.
- Status: completed in GitHub.


## Step 17 — Restore legacy products to the public shop
- Investigated the storefront catalog query: the shop intentionally reads products where `active == true`, while older product documents can predate the `active` field.
- Added an admin-side migration that finds legacy product documents missing `active` and saves them with `active: true`, matching the existing normalisation behavior.
- Refreshed the storefront catalog module cache.
- Existing products explicitly marked inactive remain hidden as intended.
- Status: completed in GitHub.


## Step 18 — Final glass slideshow visual refinement
- Most Sold slides remain on a 1.5-second interval.
- Removed the previous white/translucent panel overlay from the product image.
- Removed previous/next arrow buttons from the hero slideshow.
- Increased the product title text slightly and kept it directly over the image with a shadow instead of a banner.
- Glass treatment is now a reflective shine/sweep over the sharp product image rather than a blurred/translucent panel.
- Refreshed the slideshow script cache.
- Status: completed in GitHub.


## Step 19 — Unlimited Most Sold product selection
- Removed the previous 20-product limit from the Most Sold admin selector.
- Staff can now mark any number of existing catalog products as Most Sold.
- Homepage slideshow randomly rotates through the complete Most Sold selection every 1.5 seconds.
- Clicking the slideshow continues to open the Shop filtered to the complete Most Sold selection.
- Status: completed in GitHub.


## Step 20 — Owner validity controls Admin access
- Admin dashboard access now requires the Owner linked through `ownerUid` to be active and unexpired.
- Admins whose Owner validity has expired are blocked from the dashboard and shown a clear message to contact their Owner.
- Expired Owners are blocked from the dashboard and shown a dedicated provider-renewal message.
- The Owner expiry message provides the Web Developer / Provider WhatsApp contact: +91 8667298507 (Ashish).
- Firestore security rules now enforce the Owner dependency for Admin permissions as well, so frontend checks are backed by database authorization.
- Status: completed in GitHub. The updated `firestore.rules` must be published in Firebase Console for the server-side enforcement to take effect.

## Step 21 — Block expired access without logging out
- Expired/inactive Owners and Admins are no longer signed out or redirected to the login page.
- The current admin page is replaced with a blank, non-navigable access-block screen containing the appropriate renewal/contact message.
- An Admin whose own account expires receives the Owner-contact message; an Admin whose linked Owner expires receives the Owner-expired message; an expired Owner receives the provider-renewal message and WhatsApp contact.
- This is a frontend access block only; Firestore rules continue to enforce the Owner/Admin validity dependency server-side.
- Status: completed in GitHub.


## Step 22 — Staff password reset workflow
- Staff account creation continues to use the password entered by the Super Admin or Owner; the password is never stored in Firestore.
- After creation, the entered password is intentionally not persisted for later retrieval.
- Super Admin can open any Owner/Admin profile and send a Firebase password-reset email.
- Owner can open only their own linked Admin profiles and send a Firebase password-reset email.
- The reset control does not expose or store the existing password; the staff member chooses the new password through Firebase's reset flow.
- Existing Owner/Admin creation, validity, role, feature, and Owner dependency controls remain unchanged.
- Status: completed in GitHub.


## Step 23 — Correct Owner expiry screen and suppress expired catalog alerts
- Updated the shared admin access screen so an expired Owner sees “Owner access unavailable” instead of the generic Admin heading.
- Removed the secondary admin guard's logout/redirect behavior for expired or inactive accounts so it no longer races the access-block screen.
- Prevented the catalog page from starting Firestore catalog reads when the current Owner is expired/inactive, or when an Admin's linked Owner is expired/inactive. This avoids the misleading “Unable to load the shared product catalog” alert before the access screen appears.
- Password reset behavior remains unchanged and continues to work for authorized Owner/Admin management.
- Status: completed in GitHub.


## Step 24 — Allow expired members to authenticate and receive renewal screen
- Expired Owner/Admin Firebase accounts remain able to authenticate with their existing credentials instead of being rejected by the login-page flow.
- After authentication, the login page checks the Firestore staff profile and linked Owner validity before redirecting to the admin panel.
- Expired Owners receive the provider-renewal screen; expired Admins receive either the Owner-expired message or their own account-expired message as appropriate.
- Expired members are not signed out by this flow.
- Password reset behavior remains unchanged.
- Status: completed in GitHub.

## Step 25 — Super Admin validity controls
- Super Admin staff management now has direct validity controls for every Owner/Admin profile: **Extend** and **Expire now**.
- Extend asks for a whole number of days from 1 to 3650. If the existing expiry is still in the future, the new period is added after that expiry; if the account is already expired, the extension starts from the current time.
- Extending an account also sets `active: true`, so an expired account can be restored immediately.
- Expire now writes an expiry timestamp one second in the past, so the account becomes expired immediately even when its previous expiry date was in the future.
- For Admin profiles, validity changes are written to both `users/{uid}` and the linked `ownerStaff/{ownerUid}/admins/{uid}` mirror so Owner staff views remain synchronized.
- Existing Firestore rules already permit Super Admin validity updates; no new Firebase rule block is required for this control.
- Status: completed in GitHub.


## Step 26 — Owner Admin limits and inherited Owner validity
- Owner-created Admin accounts are limited to a maximum of 5 from the Staff page.
- Owner-created Admin validity is fixed at 30 days; the Owner no longer chooses a validity period when creating an Admin.
- Owner cannot renew an Admin. The Owner can still deactivate an Admin, but an Admin whose own validity has expired cannot be reactivated by the Owner.
- Admins keep their own `expiresAt` validity. When the linked Owner expires, the Admin becomes operationally unavailable through the existing Owner-dependency access guard without changing the Admin's own expiry timestamp.
- When the Super Admin renews the Owner, Admins whose own validity is still alive automatically regain access. Admins whose own validity has also expired remain expired.
- Super Admin continues to be able to manage Owner/Admin validity directly through the Staff panel.
- The Super Admin staff view now labels an Admin with a valid personal expiry but an expired Owner as “Paused — Owner expired”, making the inherited access dependency visible.
- Firestore rules now enforce the Owner-created Admin 30-day validity window and prevent an Owner from reactivating an Admin after that Admin's own validity has expired.
- The 5-Admin cap is enforced server-side through the ownerStaff/{ownerUid} counter, adminUids map, and getAfter() atomic-write checks; the Owner UI also blocks the fifth account and above for a clear user experience.
- Status: completed in GitHub. The updated `firestore.rules` must be published in Firebase Console for the server-side 30-day/renewal restrictions to take effect.

## Step 27 — Rule-backed 5-Admin cap and Owner renewal access fix
- Replaced the Owner Admin-count UI-only limit with a Firestore-backed counter document at `ownerStaff/{ownerUid}`.
- The counter stores `adminCount` plus an `adminUids` map. Owner Admin creation/deletion must update the counter, UID map, `users/{uid}`, and `ownerStaff/{ownerUid}/admins/{uid}` atomically.
- Firestore Security Rules use `getAfter()` to verify that the counter change corresponds to the same Admin being created or deleted and that the resulting count never exceeds 5.
- Super Admin staff loading reconciles the counter for existing Owners from their current `ownerStaff/{ownerUid}/admins` documents. Newly created Owners start with a zeroed counter.
- Owner-created Admin validity remains fixed at 30 days and Owner renewal still does not alter an Admin's own `expiresAt`.
- Fixed the renewal access issue where an Admin could not re-check its linked Owner after the Owner was renewed: Admins can now read only their linked Owner profile, allowing the existing frontend dependency check to see the renewed Owner state.
- Cache versions were refreshed for the login/access-guard pages.
- Status: completed in GitHub. The updated `firestore.rules` must still be published in Firebase Console before the rule-backed cap and linked-Owner read permission take effect.


### Step 28 — Owner Admin validity set to 60 days
- Owner-created Admin accounts now receive exactly 60 days by default.
- The Owner create-admin screen no longer exposes the validity-days field.
- Owner cannot extend or modify Admin expiry.
- Only Super Admin can use Extend/Expire controls to change Admin validity.
- Firestore rules enforce the 60-day Owner-created Admin validity and the existing maximum of 5 Admins.


## Step 29 — Final Owner Admin rules and legacy-counter fix
- Firestore Rules now enforce Owner-created Admin validity at exactly 60 days.
- Owner-created Admins remain limited to a maximum of 5 through the `ownerStaff/{ownerUid}` counter and UID map.
- Legacy Owners whose `ownerStaff/{ownerUid}` counter document does not yet exist can create their first Admin; the same atomic batch creates the counter with `adminCount: 1`.
- Subsequent Owner Admin creation requires the existing counter to be below 5 and increments it atomically with the user and Admin mirror.
- Super Admin remains the only role that can change Owner/Admin `expiresAt`.
- All post-batch existence checks use the supported `existsAfter()` function. No `getAfter(...).exists()` calls remain.
- Product, SKU, category, sales, order and inventory rule behavior was preserved; the only catalog-rule syntax change is the required `existsAfter()` form for the existing product/SKU delete check.
- Status: committed to GitHub. The rules still need to be published in Firebase Console before the live Firestore project uses this ruleset.



## Step 31 — Owner Admin creation authorization hardening

- Removed the Owner-only `staff` feature flag from Owner staff-management writes. The Owner staff page already requires an active Owner, and this prevents an old/explicit `features.staff: false` value from blocking Admin creation.
- Hardened `ownerStaff` counter field access with safe map `.get()` calls.
- Owner Admin creation now reconciles `ownerStaff/{ownerUid}` from the real Admin mirror before creating a new account.
- The creation batch writes an explicit `adminCount` and complete `adminUids` map instead of relying on an increment transform, making the rule evaluation deterministic.
- The existing 5-Admin cap and exact 60-day Owner-created Admin validity remain enforced by Firestore rules.
- Unrelated product, SKU, category, sales, order, and inventory rules were not changed.
- Rules commit: `ade4fa2c29377fff97b0d2bc16f14d63b302d0c7`.
- Staff flow commit: `1b7ca2c78611d1e82f32c62903e4a6127d767939`.
- The updated rules still must be published in Firebase Console before the live database uses them.

## Step 30 — Simplified staff batch authorization
- Reworked only the staff-management portion of firestore.rules after repeated Owner Add Admin permission failures.
- Owner Admin creation now authorizes the three writes independently: /users/{adminUid}, /ownerStaff/{ownerUid}/admins/{adminUid}, and /ownerStaff/{ownerUid}.
- Removed the fragile getAfter() dependency chain from the staff create/delete bookkeeping rules, reducing Firestore batched-write access calls and avoiding rejection caused by legacy counter shapes.
- Owner-created Admins remain exactly 60 days and the maximum remains 5.
- Super Admin-created Admin profiles now require a valid active, unexpired Owner UID, preventing creation of an Admin that can never pass the linked-Owner login check.
- Product, SKU, category, sales, order and inventory rules were left outside this staff-only change.
- Rules commit: c0fa5408fbac19bc933d8edaf0d5ba9d8bc30d0a.
- Status: committed to GitHub; this exact ruleset must be published in Firebase Console before live testing.

## Step 32 — Final Owner counter-rule alignment

- Removed the remaining Owner `featureEnabled('staff')` gate from the `ownerStaff/{ownerUid}` counter update. Owner staff management is now authorized by active Owner identity; the Owner staff page itself already restricts access to active Owners.
- Removed the temporary `counterSyncedAt` field from Owner counter writes because the counter update rule intentionally allows only `adminCount`, `adminUids`, and `lastAdminOperation` changes.
- Final rules commit: `28129312da56d09737a2e2b6369fe652724a3025`.
- Final staff-flow commit: `48fd1a15b077ec4cfe3751c9946dbaad4cdab0c8`.

## Step 33 — Super Admin Owner selection for Admin creation
- Super Admin Admin creation now requires selecting an active Owner.
- The selected Owner is written to the new Admin profile as `ownerUid`.
- The same Admin is atomically mirrored under `ownerStaff/{ownerUid}/admins/{adminUid}`.
- The Owner's `adminCount` and `adminUids` are updated in the same batch.
- The Super Admin creation path respects the same 5-Admin-per-Owner capacity.
- Existing Owner-created Admin behavior remains unchanged, including its exact 60-day validity.
- Firestore rules now authorize Super Admin Admin mirrors only when the mirror points to the selected Owner.
