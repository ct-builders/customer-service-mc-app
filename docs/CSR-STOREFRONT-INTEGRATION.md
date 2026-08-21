# Adding CSR mode ("shop as customer") to your storefront

This Merchant Center application lets a Customer Service agent place an order **on behalf
of a customer**: the agent picks a customer, clicks *Place order for customer*, and lands in
your storefront already logged in as that person.

The Merchant Center side of that is done for you. **The storefront side is not** — your
storefront has to accept the handoff, and this document is the contract.

Read the security requirements before you implement. This endpoint creates an
authenticated customer session; getting it wrong is an authentication bypass.

---

## 1. Why it works the way it does

A Merchant Center Custom Application is a **static bundle**. It has no server and no
private key: anything embedded in it is readable by anyone who can load the app. So it
cannot sign the handoff, and a shared secret passed in the URL would be extractable from
the bundle, would sit in access logs and browser history, and would never expire.

Instead, commercetools itself is the trusted channel:

```
  MC app                        commercetools                  Your storefront
    │                                 │                               │
    │ 1. POST /custom-objects         │                               │
    │    container: csr-launch-tokens │                               │
    │    key:       <opaque token>    │                               │
    │    value:     {customerId, …}   │                               │
    │────────────────────────────────>│                               │
    │                                 │                               │
    │ 2. open /api/auth/impersonate?token=<opaque token>              │
    │────────────────────────────────────────────────────────────────>│
    │                                 │                               │
    │                                 │ 3. GET the custom object      │
    │                                 │<──────────────────────────────│
    │                                 │    {customerId, expiresAt, …} │
    │                                 │──────────────────────────────>│
    │                                 │                               │
    │                                 │ 4. DELETE it (single use)     │
    │                                 │<──────────────────────────────│
    │                                 │                               │
    │                     5. session created as that customer <───────│
```

The token is opaque, single-use, and expires in about two minutes. Nothing sensitive
travels in the URL, and a token that has been redeemed — or merely seen — is worthless.

> One thing to expect: several hosting platforms (Netlify's Next.js runtime among them)
> append the incoming query string to a redirect's `Location`, so after redemption the
> consumed token can show up in the address bar as `/?token=…`. That is cosmetic rather
> than a leak — the token no longer exists in the project by the time the browser sees it —
> but it is worth knowing before you file it as a bug. Strip it with `history.replaceState`
> if it bothers you.

**Where the authorization comes from:** the MC app reaches commercetools only through the
Merchant Center API gateway, which authenticates as the signed-in Merchant Center user and
enforces that user's permissions. A launch token can therefore only exist if a real MC user
holding `manage_key_value_documents` on this project created it. That is the signal your
storefront is trusting when it honours a token — not a secret, but the fact that
commercetools accepted the write.

---

## 2. The contract

### Request

```
GET /api/auth/impersonate?token=<opaque token>
```

Also handle the exit case, which ends impersonation:

```
GET /api/auth/impersonate?exit=1
```

That is the entire surface. No headers, no body, no secret.

### The launch token

A Custom Object in the same commercetools project:

| | |
|---|---|
| **container** | `csr-launch-tokens` |
| **key** | the opaque token from the query string (43-char base64url, 256 bits of entropy) |

Its `value`:

```jsonc
{
  "customerId":      "8f3c…",              // required — who to log in as
  "businessUnitKey": "acme-north",         // optional, B2B only
  "agentEmail":      "csr@example.com",    // optional — the MC user driving the session
  "agentName":       "Dana Okafor",        // optional
  "issuedAt":        "2026-08-21T14:03:11.482Z",
  "expiresAt":       "2026-08-21T14:05:11.482Z"  // required — reject past this
}
```

`agentEmail` / `agentName` are how you attribute the resulting order to the agent who
placed it. Both are optional: treat a token without them as valid but unattributed.

### What your endpoint MUST do

1. **Read** the Custom Object `csr-launch-tokens / <token>`. Missing → reject.
2. **Reject if `expiresAt` is in the past.** Do this before anything else.
3. **Delete the Custom Object**, and only continue if the delete succeeded. This is what
   makes the token single-use — see the note on ordering below.
4. **Load the customer** by `customerId`. Not found → reject.
5. **Create the session** as that customer, flagged as CSR mode, carrying the agent
   identity.
6. **Redirect** into the storefront.

On any rejection, redirect to your home page or login. Do not report *why* — a caller who
can distinguish "expired" from "never existed" from "already used" learns more than they
should.

> **Order matters.** Delete *before* you create the session, not after. If you create the
> session first and the delete fails, you have just issued a reusable impersonation token.
> Deleting first means the worst case is a failed launch, which the agent can simply retry.

### Required commercetools scopes

Your storefront's existing API client needs, in addition to whatever it already has:

- `view_key_value_documents` — read the token
- `manage_key_value_documents` — delete it

It also needs to read customers (`view_customers`), which a storefront that supports login
already has. **Do not** give a storefront a `manage_project` client for this.

---

## 3. Reference implementation

Next.js App Router. Adapt freely — the logic is small and framework-agnostic.

```ts
// app/api/auth/impersonate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCustomerById } from '@/lib/ct/auth';
import { setSession, clearSession } from '@/lib/session';
import { apiRoot } from '@/lib/ct/client';

const LAUNCH_TOKEN_CONTAINER = 'csr-launch-tokens';

type CsrLaunchToken = {
  customerId: string;
  businessUnitKey?: string;
  agentEmail?: string;
  agentName?: string;
  issuedAt: string;
  expiresAt: string;
};

/**
 * Redeem a single-use CSR launch token minted by the Customer Service Merchant
 * Center application, and start a session as the named customer.
 *
 * A relative Location is used on purpose: this route often runs inside the MC
 * app's iframe, where an absolute redirect built from `origin` can resolve to
 * the platform's internal host — leaving the custom domain, dropping the
 * just-set SameSite=None cookie, and falling outside the frame-src allowlist.
 */
function relativeRedirect(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const home = relativeRedirect('/');

  // Exit CSR mode: drop the whole session, not just the csrMode flag.
  if (searchParams.get('exit')) {
    await clearSession(home);
    return home;
  }

  const token = searchParams.get('token');
  if (!token) return home;

  try {
    // 1. Read the token.
    const { body: object } = await apiRoot()
      .customObjects()
      .withContainerAndKey({ container: LAUNCH_TOKEN_CONTAINER, key: token })
      .get()
      .execute();

    const launch = object.value as CsrLaunchToken;

    // 2. Expiry first — before any side effect.
    if (!launch?.expiresAt || Date.parse(launch.expiresAt) < Date.now()) {
      // Best-effort cleanup of a token that can never be used again.
      await apiRoot()
        .customObjects()
        .withContainerAndKey({ container: LAUNCH_TOKEN_CONTAINER, key: token })
        .delete({ queryArgs: { version: object.version } })
        .execute()
        .catch(() => undefined);
      return home;
    }

    // 3. Consume it. The version guard makes this atomic: two concurrent
    //    redemptions of the same token cannot both succeed, because the loser
    //    gets a 409 and never reaches the session below.
    await apiRoot()
      .customObjects()
      .withContainerAndKey({ container: LAUNCH_TOKEN_CONTAINER, key: token })
      .delete({ queryArgs: { version: object.version } })
      .execute();

    // 4. Resolve the customer.
    const customer = await getCustomerById(launch.customerId);

    // 5. Start the session, flagged as CSR so the UI can show it and orders can
    //    be attributed.
    await setSession(home, {
      customerId: customer.id,
      customerEmail: customer.email,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      ...(launch.businessUnitKey ? { businessUnitKey: launch.businessUnitKey } : {}),
      csrMode: true,
      csrAgentEmail: launch.agentEmail,
      csrAgentName: launch.agentName,
    });

    return home;
  } catch {
    // Unknown token, already redeemed (404), lost the delete race (409), or the
    // customer is gone. All indistinguishable to the caller, on purpose.
    return home;
  }
}
```

### If your storefront is not Next.js

Nothing above is framework-specific. You need one route that can read a query parameter,
make three commercetools calls, and set a session cookie. The only detail worth carrying
over is the **relative redirect**, which matters whenever the storefront is framed.

---

## 4. The rest of CSR mode

Redeeming the token gets the agent logged in. Making CSR mode *useful* is the other half,
and it is entirely your storefront's design. What tends to be needed:

**A visible CSR banner.** The agent must never be confused about whose session this is, and
the customer must be able to see it in screen-shares. Show who is being impersonated, who
the agent is, and an **Exit CSR mode** control pointing at `?exit=1`.

**Order attribution.** Record `csrAgentEmail` / `csrAgentName` on the order — a custom field
on the cart or order is the usual route — so afterwards it is clear the order was placed by
an agent rather than the customer. Without this, an assisted order is indistinguishable from
a self-service one in your reporting.

**Session scoping for B2B.** If `businessUnitKey` is present, resolve it the same way your
normal B2B login does (business unit → store → channels) so pricing, catalogs, and
approvals match what that buyer would actually see. Reusing your login path here rather
than writing a parallel one is what keeps CSR mode honest.

**Deciding what an agent may do.** Impersonation is not the same as being the customer.
Consider blocking password changes, address-book deletion, and stored-payment management
while `csrMode` is set.

**Embedding, and why a new tab is the reliable option.** To render *inside* the Merchant
Center the storefront must be framable by the MC app's origin: send
`Content-Security-Policy: frame-ancestors https://mc.<region>.<cloud>.commercetools.com`
(and **not** `X-Frame-Options: DENY`), and issue session cookies with `SameSite=None;
Secure`.

Expect that not to be enough. Inside the Merchant Center's iframe your session cookie is a
**third-party cookie**, and browsers increasingly refuse to store those regardless of
`SameSite=None; Secure`. The failure is quietly confusing: the handshake *succeeds* — the
token is redeemed and deleted exactly as designed — but the page that loads next has no
session, so the frame comes up blank, logged out, or bounced to your login. Nothing in the
logs looks wrong, because nothing was.

Verified on this implementation: the identical launch renders a fully logged-in CSR session
when opened as a top-level tab, and comes up blank in the frame, with the token consumed in
both cases.

So treat embedding as a nice-to-have and **opening in a new tab as the path that works**.
That is a first-party context, so the cookie sticks. The MC app's default launch mode
(`Auto`) embeds only when the origin is in the compiled CSP allowlist; set it to **Always
open a new browser tab** to skip the frame entirely, and its shop page surfaces an
"open in a new tab" fallback if an embedded frame has not come up after a few seconds.

---

## 5. Configuring the Merchant Center app

On the app's **Settings** screen: set your B2C and B2B storefront URLs (origin only), pick
how the storefront opens, and set the launch-token lifetime. These are stored as a Custom
Object, so you can re-point the app without a rebuild.

Build-time `STOREFRONT_B2C_URL` / `STOREFRONT_B2B_URL` still act as the defaults. One thing
genuinely cannot move to runtime: the CSP `frame-src` allowlist is compiled into the static
bundle, so an origin that was not present at build time can be opened in a new tab but
**cannot be embedded**. Add it via `CSR_EXTRA_FRAME_SRC` and rebuild. The Settings screen
labels each storefront with whether it qualifies, so this is visible rather than mysterious.

---

## 6. Testing it

1. In the MC app, open a customer and click **Place order for customer**.
2. You should land in your storefront logged in as that customer, with your CSR banner up.
3. Check the project for leftovers:
   `GET /custom-objects/csr-launch-tokens` should be empty or hold only unredeemed tokens.
   The MC app sweeps expired ones opportunistically when it mints a new token.
4. **Replay:** copy a launch URL, use it, then load it again. The second attempt must land
   on your home page unauthenticated.
5. **Expiry:** mint a token, wait past the configured TTL, then load the URL. It must be
   rejected.
6. **Forgery:** request `/api/auth/impersonate?token=made-up-value`. It must be rejected
   without creating a session.

Tests 4–6 are the ones worth writing down as automated tests. They are the difference
between this being a working feature and being an open door.
