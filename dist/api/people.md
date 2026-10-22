# People and roles

List the organisation's directory, flag organisation administrators, set managers, and read an app's roles. Customer identities are separate from staff identities and can never be organisation administrators.

## List users

`GET /v1/directory/users`

Lists every person in the organisation, staff and customers.

**Auth:** administrator (portal session or API token).

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/directory/users" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "userId": "usr_00000000000000000000000002",
    "email": "pat@example.com",
    "displayName": "Pat Example",
    "kind": "staff",
    "isOrgAdmin": true,
    "managerUserId": null,
    "createdAt": "2026-10-20T03:14:07.000Z"
  }
]
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `listing the directory needs an admin token, or an organisation administrator` |

## Set organisation administrator

`PUT /v1/directory/users/{userId}/org-admin`

Promotes or demotes a user as an organisation administrator. Administrators approve extension access to data, promote others and receive incident alerts.

**Auth:** administrator (portal session or API token).

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `userId` | path | yes | The user id. |

**Example**

```bash
curl -sS -X PUT "$VMNODES_API_URL/v1/directory/users/<userId>/org-admin" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"isOrgAdmin":true}'
```

**Request body**

```json
{
  "isOrgAdmin": true
}
```

**Response** `204`

```json
null
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `flagging an organisation admin needs an organisation administrator, or an admin token` |
| 400 | `directory/unknown-user` | `user does not exist in this organisation` |
| 400 | `directory/customer-not-admin` | `customer identities cannot be organisation admins` |
| 409 | `directory/last-administrator` | `this is the only administrator of the organisation, and removing the last one cannot be undone from the console: nobody would be able to approve an extension's access to your data, promote a replacement, or receive incident alerts. Promote another administrator first, then remove this one. Nothing was changed.` |

Only `"isOrgAdmin": true` promotes. A body that leaves the field out or sends anything else demotes the user. Always send the field.

## Set a user's manager

`PUT /v1/directory/users/{userId}/manager`

Sets or clears who a user reports to.

**Auth:** administrator API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `userId` | path | yes | The user id. |

**Example**

```bash
curl -sS -X PUT "$VMNODES_API_URL/v1/directory/users/<userId>/manager" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"managerUserId":"usr_00000000000000000000000009"}'
```

**Request body**

```json
{
  "managerUserId": "usr_00000000000000000000000009"
}
```

**Response** `204`

```json
null
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `setting a manager requires an admin token` |
| 400 | `directory/self-manager` | `a user cannot be their own manager` |
| 400 | `directory/unknown-user` | `user does not exist in this organisation` |

Send `managerUserId` as `null`, or leave it out, to clear the manager.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
