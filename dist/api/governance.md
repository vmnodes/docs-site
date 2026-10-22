# Data governance

Data grants decide who may discover, read, query or aggregate a shared entity. Only an administrator API token can create one, so an app cannot widen its own access.

## Grant data access

`POST /v1/data/grants`

Lets one user, one group or one app discover, read, query or aggregate a shared entity. Name exactly one principal.

**Auth:** administrator API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/data/grants" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"entity":"quotes.quote","actions":["discover","read","query","aggregate"],"groupId":"grp_01JBX3AEWFGRGNRHA3GTM6Y8FZ","allowedFields":["quoteNumber","customer","total"],"maxRows":1000,"purpose":"Sales reporting","expiresDays":90}'
```

**Request body**

```json
{
  "entity": "quotes.quote",
  "actions": [
    "discover",
    "read",
    "query",
    "aggregate"
  ],
  "groupId": "grp_01JBX3AEWFGRGNRHA3GTM6Y8FZ",
  "allowedFields": [
    "quoteNumber",
    "customer",
    "total"
  ],
  "maxRows": 1000,
  "purpose": "Sales reporting",
  "expiresDays": 90
}
```

**Response** `201`

```json
{
  "grantId": "dg_01JBX39BR2FQD1D451Z0SXWMWA"
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `grants/forbidden-workload` | `an application's own token cannot grant access; an organisation administrator's admin token can` |
| 403 | `grants/forbidden-scope` | `granting requires the 'admin' scope` |
| 404 | `identity/not-found` | `no such resource` |
| 422 | `data/one-principal` | `exactly one of userId/groupId/applicationId is required` |
| 422 | `data/unknown-entity` | `no entity '<entity>' in this organisation` |

`actions` holds `discover`, `read`, `query` or `aggregate`. `allowedFields`, `recordScope`, `maxRows`, `purpose` and `expiresDays` are optional; leaving `allowedFields` out grants every shared field. A portal session cannot call this route. Ask your VMnodes contact for an administrator API token.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
