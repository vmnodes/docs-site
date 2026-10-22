# Sign-in and identity

Understand how a person reaches your app and how your app learns who they are. Read this before you write any code that handles a request: it is the one thing every app must do correctly.

## The gateway signs people in

Your app never shows a login page and never stores a password. The gateway sits in front of every app and does it.

1. A person opens `https://acme-notes.acme.vmnodes.com`.
2. With no session, the gateway sends the browser to the org's portal to sign in (usually with an emailed six-digit code), then back to the app's own address through `/_vmnodes/auth/callback`.
3. The gateway checks that the person has access to this app. If not, it answers 403 with the page "Not authorised": "Your account is signed in, but it has no entitlement to this application." The request never reaches your app.
4. Otherwise it forwards the request to your app with a header, `X-Vmnodes-Identity`, that says who is asking.

> **Trap:** `/_vmnodes/auth/callback` is reserved on every app. The gateway answers it and your app never receives it, so a route of your own at that path never runs. Serve nothing under `/_vmnodes/`.

The browser also holds a cookie named `__Host-vmn_app`. It opens your app and nothing else, and only the gateway reads it. Do not read it, store it or build anything on it. A request can also carry an `Authorization` header meant for the platform, so never log request headers wholesale.

## The identity header

`X-Vmnodes-Identity` is a signed token (a JWT). The platform signs it with RS256 and publishes its public keys at `<VMNODES_ISSUER_URL>/auth/jwks`.

| Claim | Holds |
|---|---|
| `sub` | the person's id |
| `email`, `name` | the person's address and display name |
| `kind` | the kind of account |
| `groups`, `groupIds` | the person's groups by name and by id, in the same order |
| `roles` | the roles the person holds on this app, for example `["starter.editor"]` |
| `manager` | the person's manager's id; absent when there is none |
| `iss` | who signed it: `VMNODES_ISSUER_URL` |
| `aud` | this app's id: `VMNODES_APP_ID` |
| `exp` | five minutes after it was issued |

A role change reaches your app on the person's next request. Nothing is cached, so check the header on every request and do not keep a decoded identity for longer than the request.

## Verify the header, do not just decode it

The contents of a token can be read by anyone. Only the signature makes it trustworthy. Code that reads the payload with a base64 decode and no signature check accepts any header a person types by hand, so anyone who reaches your app directly can claim to be anyone.

Use the platform's package, `@vmnodes/identity`. It checks the signature, the issuer, that the token is for this app, and that it was signed with RS256. Do not write your own check: dropping any one of those lets in a token from the wrong portal, a token meant for another app, or a forged one. These lines are the starter's:

```js
const { VmnodesIdentity, IdentityError } = require("@vmnodes/identity");
```

```js
identity = new VmnodesIdentity();
```

```js
const user = await identity.currentUser(req.headers);
```

```js
identity.requireRole(user, EDITOR_ROLE); // checked on the SERVER. Hiding a button is not security.
```

`currentUser` returns `{ id, email, name, kind, groups, groupIds, roles, manager }`. Install, API and errors are in [the identity package](../reference/identity-sdk.md).

## Settings the platform gives your app

| Variable | Use it for |
|---|---|
| `VMNODES_APP_ID` | this app's own id, so a token made for another app on the same platform is refused |
| `VMNODES_ISSUER_URL` | who must have signed the token, and where to fetch the keys. Verify against this one |
| `VMNODES_PORTAL_URL` | a link that sends someone to sign in. Do not verify against it |

`new VmnodesIdentity()` throws at start-up if `VMNODES_APP_ID` is missing, or if neither `VMNODES_ISSUER_URL` nor `VMNODES_PORTAL_URL` is set. Let the app stop and print that message: failing at start-up is easy to fix, and accepting every token because a setting was missing is silent. The starter does this.

## 401, 403 and 503 mean different things

Every refusal from the package is an `IdentityError` with a `status`. Keep the three apart in your responses.

| Status | Means | Example message | Tell the person |
|---|---|---|---|
| `401` | no token, or the token failed verification | `no identity header — is this app behind the VMnodes gateway?`, `identity token failed verification` | sign in again |
| `403` | the token is genuine, the person is not allowed to do this | `role 'starter.editor' required` | they lack a role; signing in again will not help |
| `503` | your app could not check the token at all | `could not verify identity: the VMnodes portal's key set was unreachable or unusable — this is not a problem with your sign-in` | it is an outage; never say "your session expired" |

Collapsing 503 into 401 sends a person to sign in again for a problem that is not theirs. The starter's handler keeps the status the package gives:

```js
const status = err instanceof IdentityError ? err.status : err instanceof SyntaxError ? 400 : 500;
```

Do not confuse the two 403s. The gateway's "Not authorised" page means the person has no access to the app and your app never ran. A 403 from `requireRole` means the person is in the app but lacks a role. See [Roles](roles.md).

## `/health` has no sign-in

The platform checks that your app is alive by calling `/health` on the container with nobody signed in. If `/health` required an identity, that check would always fail and the launch would never go live. Serve it before any identity check. A person who opens `/health` in a browser still passes through the gateway's sign-in first.

## Test locally without a switch

Never add a flag that skips the identity check "for development": such flags reach production. The starter's `npm run dev` runs a pretend portal that signs a token with its own key and publishes it at `/auth/jwks`, so your code runs the same check locally as online. Sign in as another person at `/_as/reader` and `/_as/editor`. To try your own roles, edit the `USERS` list at the top of `dev/mock-portal.js` so its role strings equal what your server checks.

## Related

- [Roles](roles.md)
- [The identity package](../reference/identity-sdk.md)
- [Environment variables](../reference/environment.md)
- [Getting started](../getting-started.md)
