# MCP server

The VMnodes MCP server lets an AI assistant inspect, deploy and operate your organisation's apps through the same API the portal uses. This page lists every tool it offers, with an example call.

> **Coming:** a packaged MCP server you can add to your own assistant. Today it is run for you by your VMnodes contact, with an API token they issue.

Every tool acts with the authority of the API token it runs with, and every action is recorded against it. Approvals still need a person.

## Tools

| Tool | What it does |
|---|---|
| [`create_application`](#createapplication) | Creates an application with a staging and a production environment. |
| [`inspect_application`](#inspectapplication) | Shows one application, its environments and the recent deployments of each. |
| [`deploy_application`](#deployapplication) | Builds a public git repository, or reuses an image digest, and deploys it to an environment. |
| [`get_application_status`](#getapplicationstatus) | Reports the latest deployment of an environment and the four before it. |
| [`get_logs`](#getlogs) | Reads recent log lines for an environment, optionally filtered by a substring. |
| [`get_health`](#gethealth) | Reports the health of a host and its nodes, with a capacity snapshot. |
| [`diagnose_application`](#diagnoseapplication) | Explains why an application is broken in one call. |
| [`rollback_application`](#rollbackapplication) | Rolls an environment back to its previous known-good deployment, or to a named one. |
| [`stop_application`](#stopapplication) | Pauses an environment by stopping its container, without losing the deployment. |
| [`start_application`](#startapplication) | Resumes a stopped environment by redeploying the image it was running. |
| [`get_capacity`](#getcapacity) | Reports a host's capacity, reserved resources, utilisation and estimated headroom. |
| [`get_backup_status`](#getbackupstatus) | Reports a host's backup health: last snapshot, last database dump and any failing backups. |
| [`request_database`](#requestdatabase) | Provisions the application's own PostgreSQL database; safe to call again. |
| [`set_secret`](#setsecret) | Sets a secret on one environment; the value is write-only and reaches the app on its next deploy. |
| [`discover_data`](#discoverdata) | Lists the shared entities the caller can discover, with the fields and actions each allows. |
| [`describe_entity`](#describeentity) | Describes one shared entity: its version, source, classification and visible fields. |
| [`query_entity`](#queryentity) | Runs one governed query against a shared entity and returns rows with provenance. |
| [`ask_data`](#askdata) | Answers one business question in plain language from data the caller may read. |
| [`list_actions`](#listactions) | Lists the actions the caller may propose or approve, with input schemas and risk. |
| [`propose_action`](#proposeaction) | Proposes one typed action; it queues at once or waits for a different person to approve. |
| [`get_action_status`](#getactionstatus) | Reports the status and result of one action invocation. |
| [`list_pending_approvals`](#listpendingapprovals) | Lists action proposals waiting for approval that the caller may approve. |
| [`list_incidents`](#listincidents) | Lists the organisation's incidents, optionally only those with one status. |
| [`get_incident`](#getincident) | Shows one incident with its full timeline. |
| [`remediate_incident`](#remediateincident) | Proposes a governed action as a fix for an incident. |

## create_application

Creates an application with a staging and a production environment.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | machine name, lowercase (e.g. 'timesheets') |
| `displayName` | string | no |  |
| `port` | number | yes | port the app listens on |
| `healthEndpoint` | string | no | HTTP path for health checks, e.g. /health |
| `type` | string | no |  |

**Example arguments**

```json
{
  "name": "quotes",
  "port": 3000,
  "displayName": "Quotes",
  "type": "web",
  "healthEndpoint": "/health"
}
```

**Returns:** The new application with its id, name, port and resource profile.

**Calls:** `POST /v1/applications`

## inspect_application

Shows one application, its environments and the recent deployments of each.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001"
}
```

**Returns:** An object with `application`, `environments` and `deployments` keyed by environment name.

**Calls:** `GET /v1/applications/{appId}`, `GET /v1/applications/{appId}/environments`, `GET /v1/applications/{appId}/deployments?environmentId={environmentId}`

## deploy_application

Builds a public git repository, or reuses an image digest, and deploys it to an environment.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes | 'staging' or 'production' |
| `gitUrl` | string | no | public git repo to build (Dockerfile required) |
| `gitRef` | string | no |  |
| `imageDigest` | string | no | skip the build and deploy an existing digest ref |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "staging",
  "gitUrl": "https://github.com/example/quotes.git",
  "gitRef": "main"
}
```

**Returns:** The new deployment, with status `deploying`; poll `get_application_status` for `active` or `failed`.

**Calls:** `GET /v1/applications/{appId}/environments`, `POST /v1/applications/{appId}/builds`, `POST /v1/applications/{appId}/deployments`

## get_application_status

Reports the latest deployment of an environment and the four before it.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "production"
}
```

**Returns:** An object with `latest` (the newest deployment, or null) and `history` (up to four earlier ones).

**Calls:** `GET /v1/applications/{appId}/environments`, `GET /v1/applications/{appId}/deployments?environmentId={environmentId}`

## get_logs

Reads recent log lines for an environment, optionally filtered by a substring.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |
| `sinceMinutes` | number | no | look-back window, default 60 |
| `search` | string | no | substring filter |
| `limit` | number | no |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "production",
  "sinceMinutes": 30,
  "search": "error",
  "limit": 50
}
```

**Returns:** An object with `lines`, each a timestamp and a log line.

**Calls:** `GET /v1/applications/{appId}/environments`, `GET /v1/applications/{appId}/logs`

## get_health

Reports the health of a host and its nodes, with a capacity snapshot.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `hostId` | string | yes |  |

**Example arguments**

```json
{
  "hostId": "host_00000000000000000000000003"
}
```

**Returns:** An object with `host`, `nodes` and `capacity`.

**Calls:** `GET /v1/hosts/{hostId}`, `GET /v1/hosts/{hostId}/nodes`, `GET /v1/hosts/{hostId}/capacity`

## diagnose_application

Explains why an application is broken in one call.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "production"
}
```

**Returns:** A plain `summary` plus the latest deployment, node health and recent error lines.

**Calls:** `GET /v1/applications/{appId}/environments`, `GET /v1/applications/{appId}/diagnose`

## rollback_application

Rolls an environment back to its previous known-good deployment, or to a named one.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |
| `toDeploymentId` | string | no | target deployment; defaults to the previous known-good |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "production",
  "toDeploymentId": "dep_00000000000000000000000008"
}
```

**Returns:** The new deployment that restores the older image, with status `deploying`.

**Calls:** `GET /v1/applications/{appId}/environments`, `POST /v1/applications/{appId}/rollback`

## stop_application

Pauses an environment by stopping its container, without losing the deployment.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "staging"
}
```

**Returns:** An object with `stoppedAt` and `stoppedBy`.

**Calls:** `GET /v1/applications/{appId}/environments`, `POST /v1/applications/{appId}/environments/{environmentId}/stop`

## start_application

Resumes a stopped environment by redeploying the image it was running.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "staging"
}
```

**Returns:** The new deployment, with status `deploying`.

**Calls:** `GET /v1/applications/{appId}/environments`, `POST /v1/applications/{appId}/environments/{environmentId}/start`

## get_capacity

Reports a host's capacity, reserved resources, utilisation and estimated headroom.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `hostId` | string | yes |  |

**Example arguments**

```json
{
  "hostId": "host_00000000000000000000000003"
}
```

**Returns:** The host's capacity figures as one object.

**Calls:** `GET /v1/hosts/{hostId}/capacity`

## get_backup_status

Reports a host's backup health: last snapshot, last database dump and any failing backups.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `hostId` | string | yes |  |

**Example arguments**

```json
{
  "hostId": "host_00000000000000000000000003"
}
```

**Returns:** The host's backup status as one object.

**Calls:** `GET /v1/hosts/{hostId}/backups`

## request_database

Provisions the application's own PostgreSQL database; safe to call again.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001"
}
```

**Returns:** An object with `databaseId`, `name`, `roleName` and status `provisioning`.

**Calls:** `POST /v1/applications/{appId}/database`

## set_secret

Sets a secret on one environment; the value is write-only and reaches the app on its next deploy.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `applicationId` | string | yes |  |
| `environment` | string | yes |  |
| `name` | string | yes |  |
| `value` | string | yes |  |

**Example arguments**

```json
{
  "applicationId": "app_00000000000000000000000001",
  "environment": "production",
  "name": "QUOTES_SIGNING_KEY",
  "value": "example-not-a-real-secret"
}
```

**Returns:** The secret's name and version; the value is never returned.

**Calls:** `GET /v1/applications/{appId}/environments`, `PUT /v1/applications/{appId}/secrets`

## discover_data

Lists the shared entities the caller can discover, with the fields and actions each allows.

No arguments.

**Example arguments**

```json
{}
```

**Returns:** An array of entities, each with `entity`, `version`, `description`, `actions` and `fields`.

**Calls:** `GET /v1/data/entities`

## describe_entity

Describes one shared entity: its version, source, classification and visible fields.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `entity` | string | yes |  |

**Example arguments**

```json
{
  "entity": "quotes.quote"
}
```

**Returns:** An object with `entity`, `version`, `description`, `classification`, `source` and `fields`.

**Calls:** `GET /v1/data/entities/{entity}`

## query_entity

Runs one governed query against a shared entity and returns rows with provenance.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `entity` | string | yes |  |
| `select` | array | yes | explicit field names |
| `filter` | array | no |  |
| `orderBy` | object | no |  |
| `limit` | number | no |  |
| `aggregate` | object | no |  |

**Example arguments**

```json
{
  "entity": "quotes.quote",
  "select": [
    "quoteNumber",
    "customer",
    "total"
  ],
  "filter": [
    {
      "field": "total",
      "op": "gte",
      "value": 1000
    }
  ],
  "orderBy": {
    "field": "total",
    "dir": "desc"
  },
  "limit": 20
}
```

**Returns:** An object with `rows`, `provenance`, `rowCount` and whether the result was `truncated`.

**Calls:** `POST /v1/data/query`

## ask_data

Answers one business question in plain language from data the caller may read.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `question` | string | yes |  |

**Example arguments**

```json
{
  "question": "What is the total value of quotes sent this month, by customer?"
}
```

**Returns:** A cited `answer`, the `queries` that ran, their `rows` and `provenance`.

**Calls:** `POST /v1/data/ask`

## list_actions

Lists the actions the caller may propose or approve, with input schemas and risk.

No arguments.

**Example arguments**

```json
{}
```

**Returns:** An array of actions, each with `action`, `description`, `risk`, `approvalPolicy` and `inputSchema`.

**Calls:** `GET /v1/actions`

## propose_action

Proposes one typed action; it queues at once or waits for a different person to approve.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `action` | string | yes | namespace.name, e.g. 'vmnodes.sync-xero' |
| `input` | object | no |  |
| `idempotencyKey` | string | no | supply to dedupe retried proposals |

**Example arguments**

```json
{
  "action": "quotes.send-quote",
  "input": {
    "quoteNumber": "Q-1042"
  },
  "idempotencyKey": "send-Q-1042-2026-10-22"
}
```

**Returns:** An object with `invocationId`, `status` (`proposed` or `queued`) and `deduplicated`.

**Calls:** `POST /v1/actions/propose`

## get_action_status

Reports the status and result of one action invocation.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `invocationId` | string | yes |  |

**Example arguments**

```json
{
  "invocationId": "inv_01JBX3VSJ2D3QV2Z0B17EQ78VS"
}
```

**Returns:** An object with `status`, `input`, `result`, `attempts` and the proposer and approver.

**Calls:** `GET /v1/actions/{invocationId}`

## list_pending_approvals

Lists action proposals waiting for approval that the caller may approve.

No arguments.

**Example arguments**

```json
{}
```

**Returns:** An array of pending proposals, each with `invocationId`, `action`, `input` and `proposedBy`.

**Calls:** `GET /v1/actions/pending`

## list_incidents

Lists the organisation's incidents, optionally only those with one status.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `status` | string | no |  |

**Example arguments**

```json
{
  "status": "open"
}
```

**Returns:** An array of incidents, each with `incidentId`, `title`, `status`, `priority` and `openedAt`.

**Calls:** `GET /v1/incidents`

## get_incident

Shows one incident with its full timeline.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `incidentId` | string | yes |  |

**Example arguments**

```json
{
  "incidentId": "inc_01JBX3CNKGNNSTZAG068YNXZ21"
}
```

**Returns:** The incident plus a `timeline` of signals, comments and remediation outcomes.

**Calls:** `GET /v1/incidents/{incidentId}`

## remediate_incident

Proposes a governed action as a fix for an incident.

| Argument | Type | Required | Meaning |
|---|---|---|---|
| `incidentId` | string | yes |  |
| `action` | string | yes |  |
| `input` | object | no |  |

**Example arguments**

```json
{
  "incidentId": "inc_01JBX3CNKGNNSTZAG068YNXZ21",
  "action": "quotes.restart-worker",
  "input": {
    "worker": "mailer"
  }
}
```

**Returns:** An object with `invocationId` and `status`; the proposal follows the action's approval policy.

**Calls:** `POST /v1/incidents/{incidentId}/remediate`

## Related

- [API reference](api/index.md)
