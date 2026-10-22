# Groups

Groups collect people so a data grant or an action grant can name them once. Group names are lowercase kebab-case.

## Create a group

`POST /v1/groups`

Creates a group in the organisation.

**Auth:** administrator (portal session or API token).

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/groups" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"name":"sales-team","description":"Everyone who sends quotes"}'
```

**Request body**

```json
{
  "name": "sales-team",
  "description": "Everyone who sends quotes"
}
```

**Response** `201`

```json
{
  "groupId": "grp_01JBX3AEWFGRGNRHA3GTM6Y8FZ",
  "name": "sales-team"
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `creating a group needs an organisation administrator, or an admin token` |
| 422 | `identity/bad-group-name` | `group names are lowercase kebab-case, 2-49 characters` |
| 409 | `identity/group-name-conflict` | `a group named '<name>' already exists in this organisation` |

`description` is optional.

## Add a group member

`POST /v1/groups/{groupId}/members`

Adds a user to a group. Adding a user who is already a member succeeds.

**Auth:** administrator (portal session or API token).

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `groupId` | path | yes | The group id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/groups/<groupId>/members" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"userId":"usr_00000000000000000000000002"}'
```

**Request body**

```json
{
  "userId": "usr_00000000000000000000000002"
}
```

**Response** `204`

```json
null
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `changing group membership needs an organisation administrator, or an admin token` |
| 422 | `identity/group-not-found` | `no group '<groupId>'` |
| 422 | `identity/user-not-found` | `no user '<userId>'` |

## Remove a group member

`DELETE /v1/groups/{groupId}/members/{userId}`

Removes a user from a group. Removing a user who is not a member also succeeds.

**Auth:** administrator (portal session or API token).

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `groupId` | path | yes | The group id. |
| `userId` | path | yes | The user id. |

**Example**

```bash
curl -sS -X DELETE "$VMNODES_API_URL/v1/groups/<groupId>/members/<userId>" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `204`

```json
null
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `changing group membership needs an organisation administrator, or an admin token` |
| 422 | `identity/group-not-found` | `no group '<groupId>'` |

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
