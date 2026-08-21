# Registering the Customer Service Custom Application in the Merchant Center

Registration is **per commercetools project**. The same deployed build can be registered
against several projects — each gets its own Application ID, and each needs its own
entry point URI path (they are globally unique), so each also needs its own build.

> Region for these demos: GCP `us-central1` → cloud identifier `gcp-us`.

## Pick the entry point URI path first

The entry point URI path is **globally unique across every commercetools organization**, not
just your own — and it **cannot be changed after registration**. The bare `customer-service`
is already taken by someone else, so registering with it fails with:

> A Custom Application with this value already exists. Please chose another unique value.

Namespace it per deployment — `<org>-customer-service`, e.g. `acme-customer-service`. Set it
as `ENTRY_POINT_URI_PATH` in the build environment **and rebuild before registering**: appkit
bakes the value into the bundle, and if the registration and the bundle disagree the Merchant
Center reload-loops forever.

Order of operations matters:

1. DNS + SSL for `APPLICATION_URL` resolve.
2. Build & deploy (appkit bakes `APPLICATION_URL` into `<base href>` and the CSP).
3. Register in the MC → get the Application ID.
4. Set `CUSTOM_APPLICATION_ID` and **redeploy**.

---

## Method A — CLI (`config:sync`)

> ⚠️ **Does not work with SSO logins.** `mc-scripts login` mints an `oidcForDevelopment`
> session token that the Merchant Center **settings** service (which registers customizations)
> rejects with `UNAUTHENTICATED`. commercetools employee accounts are SSO, so `config:sync`
> fails for them — verified. Use **Method B** unless you have a **non-SSO service account**;
> then this path works and is the fastest.

### A1. Log in (interactive)
```bash
npx mc-scripts login          # opens a browser; authenticate with your MC account
```
This stores a 36-hour API token in `~/.commercetools/mc-credentials.json` for the
`us-central1` environment. (SSO is fine here — only non-interactive `--headless` mode can't.)

### A2. Sync the config → creates the registration + Application ID
```bash
npx mc-scripts config:sync --dry-run       # preview without mutating
npx mc-scripts config:sync                 # creates (or updates) the customization
# If your account is in more than one Organization, pass one of:
#   CT_ORGANIZATION_ID=<org-id> npx mc-scripts config:sync
#   CT_ORGANIZATION_NAME="<org name>" npx mc-scripts config:sync
```
`config:sync` reads `custom-application-config.mjs` and creates the Custom Application with the
right **name, entry point, OAuth scopes, and menu links**. On create it writes the new
Application ID to a file in the config directory and prints it.

### A3. Set the Application ID and redeploy
Set `CUSTOM_APPLICATION_ID` in the build environment (Netlify → Site configuration →
Environment variables) and trigger a redeploy.

### A4. Finish in the MC UI (state + install)
`config:sync` creates the customization in the **Draft** state. To make it usable:
1. Profile icon → **Manage organizations & teams** → your Org → **Custom Applications**.
2. Open **Customer Service**, set **State → Ready** (requires a verified contact email — add
   one under *Configure Custom Applications* if you haven't).
3. **Install** it to the Org and grant access to the relevant **Teams**.
4. Open the project — **Customer Service** appears in the left navigation.

---

## Method B — fully manual (MC UI)

1. **Verify a contact email:** Profile → Manage organizations & teams → Org → Custom
   Applications → Configure Custom Applications → add & verify an email.
2. **Add a Custom Application:**
   - Application name: `Customer Service`
   - Application URL: your `APPLICATION_URL`
   - Entry point URI path: your `ENTRY_POINT_URI_PATH` (namespaced — see above)
3. **Permissions (Default group)** — must match `oAuthScopes` in the config:
   - View: `view_customers`, `view_orders`, `view_products`, `view_published_products`,
     `view_cart_discounts`, `view_discount_codes`, `view_shopping_lists`, `view_stores`,
     `view_business_units`, `view_key_value_documents`, `view_states`
   - Manage: `manage_customers`, `manage_orders`, `manage_shopping_lists`,
     `manage_key_value_documents`
4. **Menu links** — Main: `Customer Service`. No submenu links: the entry point lands on the
   dashboard, which is the hub for every module.
5. **Register**, copy the **Application ID** into `CUSTOM_APPLICATION_ID`, redeploy.
6. **State → Ready**, then **Install** to the Org and grant **Team** access.

---

## Notes
- The app reads/writes Custom Objects in containers `csr-cases`, `csr-store-credit`, and
  `csr-order-comments`. These are created on first write — no manual setup needed.
- Infinite reload after install ⇒ the registered entry point URI path doesn't match the
  `entryPointUriPath` baked into the bundle. They must be identical.
- Registering the same app in a second project: repeat Method B step 2 onward inside that
  project's Organization. Nothing in the build needs to change unless the Application ID
  differs, in which case deploy a second Netlify site with its own `CUSTOM_APPLICATION_ID`.
