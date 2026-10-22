# Reading shared data

Discover, describe and query the entities other apps share, ask a question in plain language, and pin the answers as charts. What a caller sees is decided by data grants, not by the request. An entity with no grant for the caller is invisible. A grant is created with POST /v1/data/grants by a caller holding an administrator-scoped API token for your org. The portal cannot issue API tokens or create grants today, even for an org administrator, so ask your VMnodes contact to create the grant and to give your app its token.

## List entities

`GET /v1/data/entities`

Lists the shared entities the caller can discover, with the fields the caller may see and the actions the caller holds. An entity the caller can discover but not read carries a `note`.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/data/entities" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "entity": "quotes.quote",
    "version": 1,
    "description": "A quote sent to a customer",
    "classification": "internal",
    "actions": [
      "discover",
      "read",
      "query",
      "aggregate"
    ],
    "fields": [
      {
        "name": "quoteNumber",
        "type": "string"
      },
      {
        "name": "customer",
        "type": "string"
      },
      {
        "name": "total",
        "type": "number"
      },
      {
        "name": "sentAt",
        "type": "timestamp"
      }
    ],
    "retired": false
  },
  {
    "entity": "visits.visit",
    "version": 1,
    "description": "A visitor sign-in",
    "classification": "internal",
    "actions": [
      "discover"
    ],
    "fields": [],
    "retired": false,
    "note": "You can see this exists. Ask its owner for access to read it."
  }
]
```

An app's own token works here and sees only what its grants allow. `retired` is true once the owner stops sharing the entity.

## Describe an entity

`GET /v1/data/entities/{entity}`

Returns one entity's definition: version, description, classification, source and the fields the caller may see.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `entity` | path | yes | The entity name, `<appName>.<local>`, for example `quotes.quote`. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/data/entities/<entity>" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "entity": "quotes.quote",
  "version": 1,
  "description": "A quote sent to a customer",
  "classification": "internal",
  "source": "quotes",
  "vmnodesOwned": false,
  "fields": [
    {
      "name": "quoteNumber",
      "type": "string"
    },
    {
      "name": "customer",
      "type": "string"
    },
    {
      "name": "total",
      "type": "number"
    },
    {
      "name": "sentAt",
      "type": "timestamp"
    }
  ],
  "retired": false
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `api/not-found` | `no such resource` |

An unknown entity and an entity the caller has no grant for answer identically with 404.

## Query an entity

`POST /v1/data/query`

Runs one governed query. Name the fields to return in `select`. Filters are ANDed. Add `aggregate` to count, sum, min or max, optionally grouped. Each row carries `_provenance`, and the response says how fresh the data is and whether it was cut short.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/data/query" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"entity":"quotes.quote","select":["quoteNumber","customer","total"],"filter":[{"field":"total","op":"gte","value":1000}],"orderBy":{"field":"total","dir":"desc"},"limit":2}'
```

**Request body**

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
  "limit": 2
}
```

**Response** `200`

```json
{
  "rows": [
    {
      "quoteNumber": "Q-1042",
      "customer": "Example Pty Ltd",
      "total": 1850,
      "_provenance": {
        "sourceRef": "5d41402abc4b2a76b9719d911017c592e2b7a0c3f4d6e8a1b9c0d2e4f6a8b0c1",
        "lastSeenAt": "2026-10-21T22:41:55.000Z"
      }
    }
  ],
  "provenance": {
    "entity": "quotes.quote/v1",
    "source": "quotes",
    "freshestAt": "2026-10-21T22:41:55.000Z",
    "stalestAt": "2026-10-20T03:14:07.000Z"
  },
  "truncated": false,
  "truncation": "none",
  "rowCount": 1
}
```

| Status | Code | Message |
|---|---|---|
| 422 | `data/denied` | `no query access to '<entity>'` |
| 422 | `data/field-denied` | `field '<field>' is not available to you on '<entity>'` |
| 422 | `data/grain-not-readable` | `rows of '<entity>' are identified by <grain>, and <hidden> <is\|are> not available to you — two rows could differ in a way you cannot see. Aggregate instead (count, sum, min, max), which needs no row identity.` |
| 422 | `data/bad-op` | `unknown operator '<op>'` |
| 422 | `data/no-select` | `select is required — select at least one field` |
| 422 | `data/bad-entity` | `entity is required and must be a string` |
| 422 | `data/bad-select` | `select must be an array of field names` |
| 422 | `data/bad-filter` | `'in' needs 1-100 values` |
| 422 | `data/bad-order-by` | `orderBy.dir must be 'asc' or 'desc' when given` |
| 422 | `data/bad-aggregate` | `aggregate.fn must be one of count, sum, min, max` |
| 422 | `data/bad-limit` | `limit must be a positive integer` |
| 403 | `auth/on-behalf-of-not-permitted` | `only an application may act on behalf of a user` |

`filter[].op` is one of `eq`, `ne`, `in` (1 to 100 values), `gt`, `gte`, `lt`, `lte`, `contains`. `limit` defaults to 50 and is at most 200. `orderBy.dir` defaults to ascending. `aggregate` is `{fn, field?, groupBy?, buckets?}` with `fn` one of `count`, `sum`, `min`, `max`; a grouped aggregate returns rows such as `{"customer":"Example Pty Ltd","sum":1850}` and caps at 200 groups. `truncation` is `none`, `groups` or `scan`. `withheld` appears when the caller's grant hides fields or rows. Where the message above shows one example, the same code has sibling messages that name the field or operator at fault: `data/denied` also reads `no aggregate access to '<entity>'` for an aggregate; `data/no-select` also reads `select at least one field`; `data/bad-filter` also covers a `filter` that is not an array, an entry that is not an object, and an entry missing `field`, `op` or `value`; `data/bad-aggregate` also covers `aggregate` that is not an object, a `field` that is not a string, a `groupBy` that is not an array and `buckets` that are not `day`, `month` or `year`. An unknown entity, an entity with no grant and an entity with no shared fields all answer with the same `data/denied`, on purpose. An app can read for a signed-in person by sending that person's gateway identity token in the `X-Vmnodes-On-Behalf-Of` header; the query then runs with that person's access, and a token that is not valid for the app returns 403 `identity/on-behalf-of-invalid` with the message `identity token not valid for this application: <jose error>`. Only an app's own token may send the header. The `sourceRef` is an opaque value for this reader: do not parse it.

## Ask a question

`POST /v1/data/ask`

Asks one business question in plain language. The platform plans a constrained query from the caller's grants, runs it through the governed data path, and returns a cited answer with the exact plan that ran.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/data/ask" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"question":"What is the total value of quotes sent this month, by customer?"}'
```

**Request body**

```json
{
  "question": "What is the total value of quotes sent this month, by customer?"
}
```

**Response** `200`

```json
{
  "answer": "Example Pty Ltd has 1850 in quotes this month; Sample Co has 420.5.",
  "queries": [
    {
      "plan": {
        "entity": "quotes.quote",
        "select": [
          "customer"
        ],
        "aggregate": {
          "fn": "sum",
          "field": "total",
          "groupBy": [
            "customer"
          ]
        }
      },
      "rows": [
        {
          "customer": "Example Pty Ltd",
          "sum": 1850
        },
        {
          "customer": "Sample Co",
          "sum": 420.5
        }
      ],
      "provenance": {
        "entity": "quotes.quote/v1",
        "source": "quotes",
        "freshestAt": "2026-10-21T22:41:55.000Z",
        "stalestAt": "2026-10-20T03:14:07.000Z"
      },
      "rowCount": 2,
      "truncated": false,
      "truncation": "none"
    }
  ],
  "plan": {
    "entity": "quotes.quote",
    "select": [
      "customer"
    ],
    "aggregate": {
      "fn": "sum",
      "field": "total",
      "groupBy": [
        "customer"
      ]
    }
  },
  "rows": [
    {
      "customer": "Example Pty Ltd",
      "sum": 1850
    },
    {
      "customer": "Sample Co",
      "sum": 420.5
    }
  ],
  "provenance": {
    "entity": "quotes.quote/v1",
    "source": "quotes",
    "freshestAt": "2026-10-21T22:41:55.000Z",
    "stalestAt": "2026-10-20T03:14:07.000Z"
  },
  "truncated": false,
  "rowCount": 2,
  "model": "example-model"
}
```

| Status | Code | Message |
|---|---|---|
| 501 | `ask/not-configured` | `natural-language queries are not configured on this control plane` |

`answer` is model-written, so the example answer is illustrative; the numbers come from `rows`. `queries` holds every query that ran, one per entity, because a question across two entities needs one query each. `plan`, `rows`, `provenance`, `truncated`, `truncation` and `rowCount` repeat the first query flat. `requestedChart` and `proposals` appear only when the question asked for a chart or for something to happen. Response shape not yet documented for `proposals` and `requestedChart`. A proposal is a request awaiting approval: nothing has happened until a person approves it. `question` is 1 to 2000 characters. Other 422 codes: `ask/bad-question`, `ask/no-data-access`, `ask/model-failed`, `ask/too-many-queries`, `ask/bad-plan`. A portal session may also call this route.

## List pinned charts

`GET /v1/data/pins`

Lists the caller's pinned charts, each re-run now as the caller, so a chart never shows more than the caller may see.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/data/pins" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "pins": [
    {
      "id": "pin_01JBX3G8NNBHKBVKS3CEH95TW0",
      "title": "Quote value by customer",
      "question": "What is the total value of quotes by customer?",
      "plan": {
        "entity": "quotes.quote",
        "select": [
          "customer"
        ],
        "aggregate": {
          "fn": "sum",
          "field": "total",
          "groupBy": [
            "customer"
          ]
        }
      },
      "chartKind": "bars",
      "position": 0,
      "createdAt": "2026-10-20T03:14:07.000Z",
      "rows": [
        {
          "customer": "Example Pty Ltd",
          "sum": 1850
        }
      ],
      "rowCount": 1,
      "truncated": false,
      "truncation": "none",
      "provenance": {
        "entity": "quotes.quote/v1",
        "source": "quotes",
        "freshestAt": "2026-10-21T22:41:55.000Z",
        "stalestAt": "2026-10-20T03:14:07.000Z"
      },
      "unavailable": false
    }
  ]
}
```

Pins belong to one user. `unavailable` is true when the caller can no longer read the data behind a chart. A portal session may also call this route.

## Pin a chart

`POST /v1/data/pins`

Saves a grouped aggregate as a chart on the caller's dashboard. The `plan` is the plan returned by the ask call.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/data/pins" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"title":"Quote value by customer","question":"What is the total value of quotes by customer?","plan":{"entity":"quotes.quote","select":["customer"],"aggregate":{"fn":"sum","field":"total","groupBy":["customer"]}},"chartKind":"bars"}'
```

**Request body**

```json
{
  "title": "Quote value by customer",
  "question": "What is the total value of quotes by customer?",
  "plan": {
    "entity": "quotes.quote",
    "select": [
      "customer"
    ],
    "aggregate": {
      "fn": "sum",
      "field": "total",
      "groupBy": [
        "customer"
      ]
    }
  },
  "chartKind": "bars"
}
```

**Response** `201`

```json
{
  "id": "pin_01JBX3G8NNBHKBVKS3CEH95TW0"
}
```

| Status | Code | Message |
|---|---|---|
| 422 | `pins/no-question` | `a pin needs the question it answers` |
| 422 | `pins/not-chartable` | `only a grouped aggregate can be pinned as a chart` |
| 422 | `pins/full` | `a dashboard holds 24 charts — remove one first` |

`title` is optional and is cut to 120 characters. `chartKind` is optional and uses the chart names the ask call reports in `requestedChart`: `bars`, `stacked`, `grouped`, `line`, `pie` or `radar`. A user holds at most 24 pins. A portal session may also call this route.

## Remove a pinned chart

`DELETE /v1/data/pins/{id}`

Removes one of the caller's pinned charts.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `id` | path | yes | The pin id, from the list of pinned charts. |

**Example**

```bash
curl -sS -X DELETE "$VMNODES_API_URL/v1/data/pins/<id>" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "removed": true
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `pins/not-found` | `no such pinned chart` |

A portal session may also call this route.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
