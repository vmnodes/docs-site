# Identity and the app directory

Apps that sign people in verify a gateway-issued identity token against the public keys below, and can invite customers or look up people through the directory calls. Directory calls need the matching scope on the app's token, which the manifest `permissions.directory` block requests.

## Get the identity public keys

`GET /auth/jwks`

Returns the public keys that verify the identity tokens the gateway issues. Cache the keys and refetch when a token names a `kid` you do not hold. This route is at the root of the API address, not under `/v1`.

**Auth:** none.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/auth/jwks"
```

**Response** `200`

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
      "e": "AQAB",
      "kid": "key_01JBX3WP08XKV737QED1DQE8GP",
      "alg": "RS256",
      "use": "sig"
    }
  ]
}
```

Identity tokens are RS256 JWTs. Each key has `use` of `sig`.

## Invite a customer

`POST /v1/directory/customers`

Creates a customer identity entitled to one app and emails them an invite. The same email can be invited again to a different app. A customer is a separate kind of user from staff.

**Auth:** API token with the directory.invite-customers scope.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/directory/customers" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"email":"pat@example.com","displayName":"Pat Example","applicationId":"app_00000000000000000000000001"}'
```

**Request body**

```json
{
  "email": "pat@example.com",
  "displayName": "Pat Example",
  "applicationId": "app_00000000000000000000000001"
}
```

**Response** `201`

```json
{
  "userId": "usr_00000000000000000000000002",
  "entitled": true
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `token lacks the directory.invite-customers scope` |
| 400 | `directory/no-application` | `applicationId is required` |
| 400 | `directory/foreign-application` | `a workload token invites customers to its own application only` |
| 400 | `directory/unknown-application` | `application does not exist in this organisation` |
| 400 | `directory/bad-email` | `invalid email address` |
| 400 | `directory/kind-conflict` | `a <kind> user already exists with this email` |

`displayName` is optional. An app's own token is pinned to its own app, so `applicationId` can be left out when the app calls; an administrator API token must send it. `kind` in the last error is the existing user's kind, for example `staff`.

## Look up people

`GET /v1/directory/lookup`

Searches the organisation's people for the calling app, matching a name or email fragment. Only people entitled to the app are returned. Only an app's own token can call it.

**Auth:** API token with the directory.lookup scope.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/directory/lookup?q=pat&limit=20" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "userId": "usr_00000000000000000000000002",
    "displayName": "Pat Example",
    "email": "pat@example.com",
    "kind": "staff"
  }
]
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `token lacks the directory.lookup scope — declare permissions.directory.lookupPeople in the manifest` |
| 400 | `directory/no-application` | `a directory lookup is scoped to one application` |
| 400 | `directory/foreign-application` | `unknown application in this organisation` |

`limit` defaults to 20 and is held between 1 and 50.

## List groups for an app

`GET /v1/directory/groups`

Lists the groups attached to the calling app, for an app that shows or filters by group membership.

**Auth:** API token with the directory.group-members scope.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/directory/groups" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "groups": [
    {
      "groupId": "grp_01JBX3AEWFGRGNRHA3GTM6Y8FZ",
      "name": "sales-team"
    }
  ],
  "truncated": false
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `token lacks the directory.group-members scope — declare permissions.directory.listGroupMembers in the manifest` |

Needs an app's own token.

## List members of a group

`GET /v1/directory/groups/{groupId}/members`

Lists up to 1000 members of a group attached to the calling app. `truncated` is true when more exist.

**Auth:** API token with the directory.group-members scope.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `groupId` | path | yes | The group id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/directory/groups/<groupId>/members" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "members": [
    {
      "userId": "usr_00000000000000000000000002",
      "displayName": "Pat Example",
      "kind": "staff"
    }
  ],
  "truncated": false
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `directory/forbidden` | `token lacks the directory.group-members scope — declare permissions.directory.listGroupMembers in the manifest` |
| 404 | `directory/group-not-found` | `group does not exist` |

A group that is missing, in another organisation, or not attached to the app all answer 404.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
