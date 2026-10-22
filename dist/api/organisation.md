# Organisation

Incidents record what went wrong and who is handling it. Extensions are third-party apps installed into the organisation; an upgrade that widens access waits for an administrator.

## List extensions

`GET /v1/extensions`

Lists extensions installed in the organisation, with the access each one requested.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/extensions" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "extensionId": "ext_0000000000000000000000000A",
    "name": "visitor-book",
    "publisher": "Example Software",
    "version": "1.2.0",
    "status": "installed",
    "applicationId": "app_00000000000000000000000001",
    "requested": {
      "runtime": {
        "image": "registry.example.com/acme/quotes@sha256:9f2c4a1e7b3d5086a1c2e4f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a",
        "resources": {
          "cpu": "0.5",
          "memory": "256Mi"
        }
      },
      "publishes": [
        "visits.visit/v1"
      ],
      "consumes": [],
      "actions": [],
      "proposes": [],
      "permissionTemplates": [],
      "mail": {
        "send": false
      },
      "directory": {
        "inviteCustomers": false,
        "lookupPeople": false,
        "listGroupMembers": false
      },
      "ai": {
        "complete": false
      }
    },
    "detail": null
  }
]
```

`requested.runtime.resources` holds optional `cpu`, `memory` and `storage` strings. `status` is the extension's install state.

## List pending upgrades

`GET /v1/extensions/upgrades/pending`

Lists extension upgrades waiting for an administrator. A caller who is not an administrator gets an empty list.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/extensions/upgrades/pending" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "pendingUpgradeId": "pup_01JBX3KS8AVBBFNBP42W5TWSFP",
    "extensionId": "ext_0000000000000000000000000A",
    "extensionName": "visitor-book",
    "fromVersion": "1.2.0",
    "toVersion": "1.3.0",
    "widened": {
      "consumes": [
        "visits.visit"
      ],
      "publishes": [],
      "proposes": [],
      "permissions": [
        "mail.send"
      ],
      "actions": []
    },
    "status": "pending",
    "actionable": true,
    "blockedReason": null,
    "phase": null,
    "detail": null,
    "requestedBy": "usr_00000000000000000000000002",
    "requestedAt": "2026-10-21T22:41:55.000Z",
    "decidedAt": null
  }
]
```

`widened` lists only what the upgrade adds, in five lists: `consumes`, `publishes`, `proposes`, `permissions` and `actions`. An upgrade that adds nothing does not wait here. `status` is `pending` while it waits. `actionable` is false, with a `blockedReason`, when the upgrade cannot be approved as it stands.

## Approve an extension upgrade

`POST /v1/extensions/upgrades/{pendingId}/approve`

Approves a pending upgrade and installs it. Approving grants the app new access to the organisation's data, so only an administrator can.

**Auth:** administrator (portal session or API token).

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `pendingId` | path | yes | The pending upgrade id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/extensions/upgrades/<pendingId>/approve" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "status": "installed",
  "version": "1.3.0"
}
```

| Status | Code | Message |
|---|---|---|
| 422 | `extensions/no-pending-upgrade` | `no such pending upgrade` |
| 422 | `extensions/approval-forbidden` | `approving an upgrade needs an organisation administrator, or an admin token. Approving grants an application new access to your data, so it is not a decision any member of the organisation can make.` |

Also returns 422 `extensions/upgrade-decided` when the upgrade was already decided and `extensions/upgrade-partial` when it only partly applied.

## Get extension usage

`GET /v1/extensions/{extId}/usage`

Returns what one extension has consumed: published records, publish runs, action executions, deployments and compute.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `extId` | path | yes | The extension id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/extensions/<extId>/usage" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "extensionId": "ext_0000000000000000000000000A",
  "name": "visitor-book",
  "status": "installed",
  "reserved": {
    "cpu": "0.5",
    "memory": "256Mi"
  },
  "publishedRecords": 1204,
  "publishRuns": 31,
  "actionExecutions": 8,
  "deployments": 3,
  "computeSampling": {
    "sampledAt": "2026-10-21T22:41:55.000Z",
    "services": [
      {
        "serviceId": "web",
        "status": "running",
        "cpuPercent": 3.2,
        "memoryUsedMiB": 118
      }
    ]
  }
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

`reserved` is what the extension's manifest reserves. `computeSampling` is the latest sample from the host, or the string `not-collected` when none exists.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
