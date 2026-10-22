# Environment variables

The platform sets a small, fixed group of environment variables in your app's container. Read this page to know which ones exist, when each is present, and which ones are not set for you.

## Always set

| Variable | Value | Use it for |
|---|---|---|
| `VMNODES_APP_ID` | The app's id, a string | The audience your app checks in the identity token. [`@vmnodes/identity`](identity-sdk.md) reads it. |
| `VMNODES_APP_NAME` | The name you gave the app at launch, such as `expenses` | Naming the entities you share: `<VMNODES_APP_NAME>.<thing>`. |
| `VMNODES_ENVIRONMENT` | `production` for an app launched from the portal | Telling environments apart. |

## Set on the hosted platform

| Variable | Value | Use it for |
|---|---|---|
| `VMNODES_PORTAL_URL` | The portal address the platform gives your app. Read it; never type it in | Where the identity key set is found when `VMNODES_ISSUER_URL` is not set. |
| `VMNODES_ISSUER_URL` | The address that issues identity tokens | The `iss` value your app requires, and where the key set is fetched: `<VMNODES_ISSUER_URL>/auth/jwks`. |


Your app does not need to set either. If both are missing, `new VmnodesIdentity()` throws at start-up.

## Secrets

Secrets are placed in the container's environment when a version is deployed. They are never shown in the portal.

| Variable | Present when | Value |
|---|---|---|
| `DATABASE_URL` | `vmnodes.json` has ever been deployed with `"database": true` | A `postgres://` connection string. It stays set if you later remove the key. |
| `VMNODES_PUBLISH_TOKEN` | Production, and `publishes` in `vmnodes.json` is non-empty | The bearer token for the [publish calls](publish-api.md). |
| `VMNODES_API_URL` | Same as `VMNODES_PUBLISH_TOKEN` | The address to send those calls to. This one is not secret. |

An app with no `publishes` entry gets no `VMNODES_PUBLISH_TOKEN` and no `VMNODES_API_URL`. Reading the value in code gives `undefined`; write the app so it still starts, as the starter does, and publishes nothing.

If `DATABASE_URL` is set, your app's container can reach that database. It cannot reach other apps.

## Not set

- `PORT`. Your app must listen on port 3000, on all addresses (`0.0.0.0`). Read `process.env.PORT` only as a local-testing override with 3000 as the fallback.
- `NODE_ENV`, `HOST`, and every other variable not listed above. Set what you need in your `Dockerfile` with `ENV`.

An app must not depend on any variable that is not on this page. Others may exist for the platform's own use and can change.

## Build argument

`BUILD_COMMIT` is a build argument, not a runtime variable. The platform passes the exact 40-character commit it built as `--build-arg BUILD_COMMIT=<sha>`. A `Dockerfile` that wants the value at run time declares `ARG BUILD_COMMIT` and `ENV BUILD_COMMIT=$BUILD_COMMIT`, as the starter does. See [Build, run and security checks](build-and-run.md#the-buildcommit-argument).

## Local development

On your own machine none of these are set. The starter's `npm run dev` command sets `VMNODES_PORTAL_URL` and `VMNODES_APP_ID` (to `app_local_dev`) and starts a stand-in portal at `http://127.0.0.1:4100`. See [Identity SDK](identity-sdk.md#local-development).

## Related

- [vmnodes.json reference](vmnodes-json.md)
- [Identity SDK](identity-sdk.md)
- [Publish and query API](publish-api.md)
- [Build, run and security checks](build-and-run.md)
