# Identity SDK

`@vmnodes/identity` checks the signed identity token the gateway adds to every request and gives your app a user object with roles. Read this page to install it, call it, handle its errors, or check the token yourself in a language that has no SDK.

## Get the package

The package is not on npm yet. Get it from the starter's `vendor/` folder, or download `https://docs.vmnodes.com/downloads/vmnodes-identity-0.1.0.tgz`, and install it by path:

```bash
mkdir -p vendor
cp vmnodes-identity-0.1.0.tgz vendor/
npm install ./vendor/vmnodes-identity-0.1.0.tgz
```

`package.json` now has `"@vmnodes/identity": "file:vendor/vmnodes-identity-0.1.0.tgz"` and `package-lock.json` pins the file's hash. Commit `vendor/` and `package-lock.json` together.

The build must have `vendor/` before it installs. Your `Dockerfile` copies it first:

```dockerfile
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev
```

Without a `Dockerfile` the platform's Node build copies only `package.json` and `package-lock.json` before installing. See [Build, run and security checks](build-and-run.md#node-without-a-dockerfile).

The package needs Node 20 or later, ships CommonJS and ES module builds with TypeScript types, and depends on `jose` (`^5.9.0`).

## Use it

A complete app that reads the signed-in person and checks a role:

```js
const http = require("node:http");
const { VmnodesIdentity, IdentityError } = require("@vmnodes/identity");

// Reads VMNODES_PORTAL_URL, VMNODES_ISSUER_URL and VMNODES_APP_ID. Throws at start-up if they are missing.
const identity = new VmnodesIdentity();

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));   // no sign-in: the platform calls this directly
    }
    const user = await identity.currentUser(req.headers);   // throws IdentityError 401 or 503
    if (req.method === "POST") identity.requireRole(user, "expenses.approver"); // throws IdentityError 403
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ hello: user.name || user.email, roles: user.roles }));
  } catch (err) {
    const status = err instanceof IdentityError ? err.status : 500;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: status === 500 ? "something went wrong" : err.message }));
  }
});
server.listen(3000, "0.0.0.0");
```

To try it on your machine with a stand-in sign-in, see [Local development](#local-development). Online, a request from a signed-in person reaches your app with the header; the gateway answers a request from anyone else itself.

### Constructor

```js
new VmnodesIdentity(portalUrl?, appId?, issuerUrl?)
```

With no arguments the constructor reads `VMNODES_PORTAL_URL`, `VMNODES_APP_ID` and `VMNODES_ISSUER_URL` from the environment; an argument overrides its variable. It fetches the key set from `<issuer>/auth/jwks`, where the issuer is `issuerUrl`, or else `VMNODES_ISSUER_URL`, or else the portal URL. See [Environment variables](environment.md).

It throws at construction in two cases:

- `VMNODES_ISSUER_URL or VMNODES_PORTAL_URL is required (set by the platform)`
- ``VMNODES_APP_ID is required (set by the platform at install). Without it the audience check is not merely skipped — no `aud` claim is required at all, so another application's identity token on this same portal would verify here.``

Let it stop the app. Do not catch it and carry on.

### Methods

| Call | Returns or throws |
|---|---|
| `await identity.currentUser(headers)` | The user object. `headers` is the lowercase-keyed headers object of the request, such as `req.headers`. It reads `x-vmnodes-identity`, using the first value if there are several. |
| `identity.requireRole(user, role)` | Nothing, or throws `IdentityError` 403. |
| `identity.requireGroup(user, group)` | Nothing, or throws 403. Matches a group by name. |
| `identity.requireGroupId(user, groupId)` | Nothing, or throws 403. Matches a group by id. |

Check roles on the server for every action that changes something. Hiding a button is not a check.

### The user object

| Field | Type | Meaning |
|---|---|---|
| `id` | string | The person's id. Opaque: store it as it is. |
| `email` | string | Their email address. |
| `name` | string | Their display name. It can be empty; fall back to `email`. |
| `kind` | `employee`, `contractor`, `guest`, `service`, `agent` or `customer` | What sort of person or principal this is. |
| `groups` | string[] | Names of the groups they belong to. |
| `groupIds` | string[] | The ids of those groups. |
| `roles` | string[] | The live roles they hold in this app. Retired roles are not included. |
| `manager` | string, optional | The id of their manager, only when one is recorded. |

Roles are read again on every request, so a change an administrator makes reaches your app on the person's next request.

## Errors and statuses

`IdentityError` has a `message` and a `status`. `err.cause` carries the underlying error, if any. The function `identityFailureStatus(err)` is also exported; it returns `401` or `503` for any error thrown while checking the token.

| Status | Meaning | Message |
|---|---|---|
| 401 | The request carries no valid identity: refused. Do not retry. | `no identity header — is this app behind the VMnodes gateway?` or `identity token failed verification` |
| 503 | No verdict was possible; the key set could not be reached. Retry later. | `could not verify identity: the VMnodes portal's key set was unreachable or unusable — this is not a problem with your sign-in` |
| 403 | Signed in, and not allowed. | `role '<role>' required` or `group '<group>' required` |

401 covers a bad signature, an expired token, the wrong issuer or audience, a malformed token, an algorithm other than RS256, and a key that does not match. Any error the package does not recognise is a 503, never a 401, so a platform fault does not tell a signed-in person they are signed out.

Answer a 401 or 503 with that same status. A person who sees 403 on your page needs a role: the portal's **Change roles** screen is where an administrator gives it.

## Raw contract for any language

Use this when your app is not Node, or has no `Dockerfile` to bring in the package. Every request to your app through the gateway carries:

- Header `X-Vmnodes-Identity`: a JWT signed with RS256.

Verify it on every request, with these rules:

1. Fetch the key set from `<VMNODES_ISSUER_URL>/auth/jwks`. It returns `{"keys":[{"kty":"RSA","n":"…","e":"…","kid":"…","alg":"RS256","use":"sig"}]}`. Pick the key whose `kid` matches the token's header. Cache the key set, and fetch it again when a `kid` is not found.
2. Accept the algorithm RS256 only.
3. Require `iss` to equal `VMNODES_ISSUER_URL`.
4. Require `aud` to be present and to equal `VMNODES_APP_ID`. A token with no `aud` must be refused; an app that skips this accepts tokens made for other apps.
5. Require `exp` to be in the future. A token lives for 300 seconds from `iat`, and the gateway makes a fresh one for each request.
6. Refuse the request with 401 when any rule fails, and with 503 when the key set cannot be fetched.

Claims:

| Claim | Meaning |
|---|---|
| `sub` | The person's id. Opaque. |
| `iat`, `exp` | Issued at, and expiry (`iat` + 300 seconds). |
| `iss` | `VMNODES_ISSUER_URL`. |
| `aud` | `VMNODES_APP_ID`, a string. |
| `email`, `name` | As in the user object. |
| `kind` | `employee`, `contractor`, `guest`, `service`, `agent` or `customer`. |
| `groups`, `groupIds` | Group names, and group ids. |
| `roles` | Live roles in this app. Retired roles are not included. |
| `manager` | The manager's person id, only when present. |

The `/health` path is called by the platform without the header; leave it open.

## Local development

The starter's `npm run dev` starts a stand-in portal at `http://127.0.0.1:4100`, sets `VMNODES_PORTAL_URL` to it and `VMNODES_APP_ID` to `app_local_dev`, and runs the starter's `server.js` behind it. `npm run dev` signs you in as a person with the editor role; `npm run dev -- reader` signs you in as a read-only person; while it runs, `/_as/reader` and `/_as/editor` switch between them. It does not talk to the real platform. Copy the starter's `dev/` folder into your own app to get the same.

## Related

- [Sign-in and identity](../concepts/sign-in-and-identity.md)
- [Roles](../concepts/roles.md)
- [Environment variables](environment.md)
- [vmnodes.json reference](vmnodes-json.md)
