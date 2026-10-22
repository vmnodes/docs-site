# Applications and deployments

Create an app, build or register an image, deploy it to an environment, roll it back, stop and start it, read its configuration, logs and diagnosis, and provision its database. Every app has a `staging` and a `production` environment. Deployments are immutable and pinned to an image digest.

## List applications

`GET /v1/applications`

Lists the organisation's applications with a one-word status.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "id": "app_00000000000000000000000001",
    "name": "quotes",
    "displayName": "Quotes",
    "type": "web",
    "hostId": "host_00000000000000000000000003",
    "status": "active"
  }
]
```

`status` is `active`, `failed` or `never deployed`.

## Create an application

`POST /v1/applications`

Creates an app on the organisation's host and gives it a `staging` and a `production` environment. Nothing runs until you deploy.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"name":"quotes","port":3000,"displayName":"Quotes","type":"web","resourceProfile":"standard","healthEndpoint":"/health"}'
```

**Request body**

```json
{
  "name": "quotes",
  "port": 3000,
  "displayName": "Quotes",
  "type": "web",
  "resourceProfile": "standard",
  "healthEndpoint": "/health"
}
```

**Response** `201`

```json
{
  "id": "app_00000000000000000000000001",
  "organisationId": "org_00000000000000000000000004",
  "hostId": "host_00000000000000000000000003",
  "name": "quotes",
  "displayName": "Quotes",
  "type": "web",
  "port": 3000,
  "resourceProfile": "standard",
  "accessProfile": "company",
  "healthEndpoint": "/health",
  "databaseEnabled": false,
  "persistentStorage": false,
  "telemetryProfile": "standard",
  "createdAt": "2026-10-20T03:14:07.000Z",
  "updatedAt": "2026-10-20T03:14:07.000Z"
}
```

| Status | Code | Message |
|---|---|---|
| 422 | `app/invalid-manifest` | `name and port are required` |
| 422 | `app/reserved-name` | `That name is reserved.` |
| 422 | `app/no-host` | `no healthy host with a live node available` |
| 422 | `app/name-taken` | `You already have an app called <name>. Choose a different name.` |

`name` and `port` are required. `type` is `web`, `api`, `worker`, `scheduled-job` or `mcp-server`. `resourceProfile` is `tiny`, `standard`, `large`, `compute` or `custom` and defaults to `standard`. `hostId` is optional and defaults to the organisation's host. A name that is too long returns 422 `app/name-too-long`.

## Get an application

`GET /v1/applications/{appId}`

Returns one application.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "id": "app_00000000000000000000000001",
  "organisationId": "org_00000000000000000000000004",
  "hostId": "host_00000000000000000000000003",
  "name": "quotes",
  "displayName": "Quotes",
  "type": "web",
  "port": 3000,
  "resourceProfile": "standard",
  "accessProfile": "company",
  "healthEndpoint": "/health",
  "databaseEnabled": false,
  "persistentStorage": false,
  "telemetryProfile": "standard",
  "createdAt": "2026-10-20T03:14:07.000Z",
  "updatedAt": "2026-10-20T03:14:07.000Z"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

## Build an image from git

`POST /v1/applications/{appId}/builds`

Builds the repository at a public git URL into an image and returns its digest. The repository needs a `Dockerfile`. The digest is registered for this app, ready to deploy.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/builds" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"source":{"kind":"git","url":"https://github.com/example/quotes.git","ref":"main"}}'
```

**Request body**

```json
{
  "source": {
    "kind": "git",
    "url": "https://github.com/example/quotes.git",
    "ref": "main"
  }
}
```

**Response** `201`

```json
{
  "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
  "undeclaredTemplateRoles": []
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 403 | `build/path-source-disabled` | `path sources are disabled on this control plane; build from a git URL` |

`ref` is optional. A failed build returns 422 with a code and a message naming the cause. The response can also carry `fetchPath`. `undeclaredTemplateRoles` lists permission-template roles the app uses but its manifest does not declare.

## Register an image digest

`POST /v1/applications/{appId}/images`

Registers an image you built elsewhere so it can be deployed. Send a full digest reference.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/images" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"digest":"registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a","gitCommit":"4c1d9e07a35b82f6d0e1c4b97a52f3860de1b7c9"}'
```

**Request body**

```json
{
  "digest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
  "gitCommit": "4c1d9e07a35b82f6d0e1c4b97a52f3860de1b7c9"
}
```

**Response** `201`

```json
{
  "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 422 | `deploy/placeholder-digest` | `image is the release placeholder, not a built digest — the all-zero digest is well-formed enough to pass a shape check and to sign, and fails only at pull. Register the digest from the signing commit, not the tagged one.` |
| 422 | `deploy/bad-digest` | `image must be a digest reference: <registry>/<repo>[:tag]@sha256:<64 hex>` |
| 422 | `deploy/bad-git-commit` | `gitCommit must be the full 40-character lowercase hex sha — got '<value>'. An abbreviated or otherwise malformed commit is refused, not stored: a stored abbreviation invites prefix comparison later, and prefix comparison is label-matching.` |

`gitCommit` is optional. When sent it must be the full 40-character commit.

## List environments

`GET /v1/applications/{appId}/environments`

Lists an app's environments. Use it to turn `staging` or `production` into an environment id.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>/environments" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "id": "env_00000000000000000000000005",
    "applicationId": "app_00000000000000000000000001",
    "name": "staging",
    "isProduction": false,
    "createdAt": "2026-10-20T03:14:07.000Z",
    "stoppedAt": null,
    "stoppedBy": null
  },
  {
    "id": "env_00000000000000000000000006",
    "applicationId": "app_00000000000000000000000001",
    "name": "production",
    "isProduction": true,
    "createdAt": "2026-10-20T03:14:07.000Z",
    "stoppedAt": null,
    "stoppedBy": null
  }
]
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

`stoppedAt` and `stoppedBy` are set while the environment is stopped, otherwise null.

## Deploy an image

`POST /v1/applications/{appId}/deployments`

Starts a deployment of an image digest to an environment. The call returns at once with status `deploying`; poll the deployments list for `active` or `failed`. A deployment that fails its health check does not take traffic.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/deployments" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"environmentId":"env_00000000000000000000000006","imageDigest":"registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a"}'
```

**Request body**

```json
{
  "environmentId": "env_00000000000000000000000006",
  "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a"
}
```

**Response** `202`

```json
{
  "id": "dep_00000000000000000000000007",
  "applicationId": "app_00000000000000000000000001",
  "environmentId": "env_00000000000000000000000006",
  "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
  "createdBy": "usr_00000000000000000000000002",
  "status": "deploying",
  "startedAt": "2026-10-21T22:41:55.000Z"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 422 | `deploy/env-not-found` | `no environment <environmentId>` |
| 422 | `deploy/unknown-image` | `image digest not in registry metadata — build first` |
| 422 | `deploy/scan-gate` | `image scan status is '<status>' — refused regardless of the scan gate mode` |
| 422 | `deploy/host-not-ready` | `no ready node on the application's host` |

Deployment `status` is `pending`, `building`, `deploying`, `validating`, `active`, `failed`, `rolled-back` or `superseded`. Other 422 codes: `deploy/image-withdrawn`, `deploy/no-address`, `deploy/agent-too-old`, `deploy/no-service`, and database codes when the app's database is not ready. A scan that blocks the deploy can also say `the scan gate blocks this deploy` in the same code.

## List deployments

`GET /v1/applications/{appId}/deployments`

Lists up to 50 deployments of one environment, newest first.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>/deployments?environmentId=env_00000000000000000000000006" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "id": "dep_00000000000000000000000007",
    "applicationId": "app_00000000000000000000000001",
    "environmentId": "env_00000000000000000000000006",
    "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
    "createdBy": "usr_00000000000000000000000002",
    "status": "deploying",
    "startedAt": "2026-10-21T22:41:55.000Z"
  },
  {
    "id": "dep_00000000000000000000000008",
    "applicationId": "app_00000000000000000000000001",
    "environmentId": "env_00000000000000000000000006",
    "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
    "createdBy": "usr_00000000000000000000000002",
    "status": "superseded",
    "startedAt": "2026-10-20T03:14:07.000Z",
    "completedAt": "2026-10-20T03:14:07.000Z"
  }
]
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 400 | `deployments/environment-required` | `environmentId query parameter is required` |

`environmentId` is required. A deployment may also carry `previousDeploymentId`, `failureReason` and `viaAgent`.

## Roll back

`POST /v1/applications/{appId}/rollback`

Rolls an environment back to its previous known-good deployment, or to a named one. The rollback is itself a new deployment of the older image.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/rollback" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"environmentId":"env_00000000000000000000000006","toDeploymentId":"dep_00000000000000000000000008"}'
```

**Request body**

```json
{
  "environmentId": "env_00000000000000000000000006",
  "toDeploymentId": "dep_00000000000000000000000008"
}
```

**Response** `202`

```json
{
  "id": "dep_00000000000000000000000007",
  "applicationId": "app_00000000000000000000000001",
  "environmentId": "env_00000000000000000000000006",
  "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
  "createdBy": "usr_00000000000000000000000002",
  "status": "deploying",
  "startedAt": "2026-10-21T22:41:55.000Z",
  "previousDeploymentId": "dep_00000000000000000000000007"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 422 | `rollback/no-target` | `no previous deployment to roll back to` |

`toDeploymentId` is optional. A portal session may also call this route.

## Stop an environment

`POST /v1/applications/{appId}/environments/{environmentId}/stop`

Pauses an environment by stopping its container. Reversible: start redeploys the same image. It frees CPU and memory on the host.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |
| `environmentId` | path | yes | The environment id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/environments/<environmentId>/stop" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `202`

```json
{
  "stoppedAt": "2026-10-21T22:41:55.000Z",
  "stoppedBy": "usr_00000000000000000000000002"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 403 | `environment/permission-denied` | `stopping or starting an application needs an organisation administrator, or the application's admin or owner role` |
| 404 | `environment/not-found` | `no environment <environmentId>` |
| 409 | `environment/stop-conflict` | `this environment is already stopped` |

The caller must be an organisation administrator or hold the app's admin or owner role.

## Start an environment

`POST /v1/applications/{appId}/environments/{environmentId}/start`

Resumes a stopped environment by redeploying the image it was running. The deploy gates apply again, so a build the scan now refuses cannot be restarted.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |
| `environmentId` | path | yes | The environment id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/environments/<environmentId>/start" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `202`

```json
{
  "id": "dep_00000000000000000000000007",
  "applicationId": "app_00000000000000000000000001",
  "environmentId": "env_00000000000000000000000006",
  "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
  "createdBy": "usr_00000000000000000000000002",
  "status": "deploying",
  "startedAt": "2026-10-21T22:41:55.000Z"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 403 | `environment/permission-denied` | `stopping or starting an application needs an organisation administrator, or the application's admin or owner role` |
| 404 | `environment/not-found` | `no environment <environmentId>` |
| 409 | `environment/start-conflict` | `this environment is not stopped; there is nothing to start` |
| 422 | `environment/no-deployment` | `this environment has never had a successful deployment to restart` |

The caller must be an organisation administrator or hold the app's admin or owner role.

## List configuration

`GET /v1/applications/{appId}/config`

Lists an environment's configuration entries. Values of secret entries are never returned.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>/config?environmentId=env_00000000000000000000000006" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "name": "LOG_LEVEL",
    "isSecret": false,
    "removed": false,
    "version": 2,
    "setAt": "2026-10-20T03:14:07.000Z",
    "inEffect": true,
    "value": "info"
  },
  {
    "name": "DATABASE_URL",
    "isSecret": true,
    "removed": false,
    "version": 1,
    "setAt": "2026-10-20T03:14:07.000Z",
    "inEffect": true
  }
]
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

`value` is present only when `isSecret` is false. `inEffect` is false until the entry reaches a running deployment.

## List secret names

`GET /v1/applications/{appId}/secrets`

Lists the names of an environment's secrets with their versions. Values are never returned.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>/secrets?environmentId=env_00000000000000000000000006" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "name": "DATABASE_URL",
    "version": 1,
    "createdAt": "2026-10-20T03:14:07.000Z"
  }
]
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

## Provision the database

`POST /v1/applications/{appId}/database`

Provisions the app's own PostgreSQL database. It is safe to call again. `DATABASE_URL` is set as a secret in every environment and reaches the app on its next deploy.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/applications/<appId>/database" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `202`

```json
{
  "databaseId": "db_01JBX34A08YC14FXVWRVX8PVFT",
  "name": "quotes",
  "roleName": "app_quotes_user",
  "status": "provisioning"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |
| 422 | `db/name-conflict` | `host <hostId> already has a database named '<name>' (<dbId>), owned by application <appId>. Application names that normalise to the same identifier cannot share a host: rename one, or place it on another host. Nothing was provisioned.` |

The database name is the app name in lowercase with any character outside `a-z`, `0-9` and `_` replaced by `_`. `db/name-conflict` returns 422 when another app's database on the same host already has that name.

## List restore points

`GET /v1/databases/{dbId}/restore-points`

Lists the 20 most recent verified restore points for a database, newest first.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `dbId` | path | yes | The database id, from the database provisioning response. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/databases/<dbId>/restore-points" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "id": "rp_01JBX36K6RCQY1G9B7XF4DR5SB",
    "backupId": "bak_01JBX3FVAJCWG4HWPXX3847K8P",
    "databaseId": "db_01JBX34A08YC14FXVWRVX8PVFT",
    "verifiedAt": "2026-10-21T22:41:55.000Z",
    "createdAt": "2026-10-21T22:41:55.000Z"
  }
]
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

## Read logs

`GET /v1/applications/{appId}/logs`

Reads recent log lines for an environment, optionally filtered by a substring.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>/logs?environmentId=env_00000000000000000000000006&sinceMinutes=60&search=error&limit=100" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "lines": [
    {
      "timestamp": "2026-10-21T22:41:55.000Z",
      "line": "error: connection refused to upstream"
    }
  ]
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

`environmentId` is required. `sinceMinutes` defaults to 60 and `limit` to 100. `search` matches a substring.

## Diagnose an application

`GET /v1/applications/{appId}/diagnose`

Answers why an app is broken in one call: the latest deployment, node health, recent error lines and a plain summary.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `appId` | path | yes | The application id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/applications/<appId>/diagnose?environmentId=env_00000000000000000000000006" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "summary": "The latest deployment failed its health check: the app did not answer on port 3000.",
  "deployment": {
    "id": "dep_00000000000000000000000007",
    "status": "failed",
    "imageDigest": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
    "startedAt": "2026-10-21T22:41:55.000Z"
  },
  "recentErrors": [
    "error: listen EADDRINUSE: address already in use :::3000"
  ],
  "node": {
    "status": "ready",
    "lastHeartbeatAt": "2026-10-21T22:41:55.000Z"
  }
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

`deployment` and `node` are left out when there is none. `environmentId` is required.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
