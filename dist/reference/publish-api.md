# Publish and query API

Your app shares records with other apps in the org by registering an entity and then publishing records to it, with two calls. Read this page when you add sharing to an app, when a publish call is refused, or when you need to read shared records back.

## Before you call

1. Declare the entity in `vmnodes.json`, for example `"publishes": ["note/v1"]`, and update the app. See [vmnodes.json reference](vmnodes-json.md#publishes). This gives the app its publish token.
2. Your app reads two values from its environment: `VMNODES_PUBLISH_TOKEN` and `VMNODES_API_URL`. See [Environment variables](environment.md#secrets).
3. Every call sends `Authorization: Bearer $VMNODES_PUBLISH_TOKEN` to `VMNODES_API_URL`.

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/publish/entities" \
  -H "Authorization: Bearer $VMNODES_PUBLISH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity":"expenses.claim","version":1,"description":"Expense claims submitted by staff.","queryableFields":[{"name":"amount","type":"number"}]}'
```

The token must belong to an app. A token that does not is refused with 403 `publish/workload-token-required`: `publishing needs a workload token bound to an application`. The API allows 300 requests a minute, and a request body larger than 1 MiB is refused.
An app that declares no entity in `publishes` has no token and cannot publish. See [Reading with no token](#reading-shared-records) for what that means for an app that only reads.

### Errors in every response

An error is `{"error":{"code":"<code>","message":"<message>"}}`. Most checks answer 422. Some answer 403, 404, 409 or 501, and the table below gives the code and message.

A 500 answers with: `the platform failed handling this request. Quote reference <request id> — the detail is in the platform log, deliberately not in this response.` Quote the reference to your VMnodes contact.

## Register an entity

`POST /v1/publish/entities`

Register once per entity, after the app is live. Registering the same entity again replaces its list of queryable fields.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `entity` | string | yes | `<app>.<name>`: lowercase, with no version. The prefix is your app's name, `VMNODES_APP_NAME`. |
| `version` | integer | no | Defaults to 1; 0 or a missing value gives 1. It must match the `/vN` in `vmnodes.json`. |
| `description` | string | yes | What this data is. A person reads it when deciding whether to turn sharing on. |
| `classification` | string | no | Defaults to `internal`. |
| `queryableFields` | array of `{name, type}` | yes, at least one | The fields others may read. `type` is `string`, `number`, `boolean` or `timestamp`. |
| `grain` | array of field names | no | The fields that identify one record. Each must be in `queryableFields`. |

A successful call answers 201:

```json
{ "entityDefinitionId": "…", "removedQueryableFields": [], "notSharedFields": ["amount"] }
```

`removedQueryableFields` and `notSharedFields` appear when they are not empty.

### Fields start off not shared

A field of a published entity is not shared until an administrator turns it on: in the portal, under **Shares**. Until then:

- `notSharedFields` lists the field.
- Publishing drops that field from each record. The platform keeps only the values of fields that are both queryable and shared.
- Turning a field on does not fill in records already published. Publish them again.
- Turning a field off deletes the stored values for it.

An entity has one owning app, for good. Another app cannot publish to it.

### Register errors

| Code | Message |
|---|---|
| `data/bad-entity-name` | `entity names are namespace.name, lowercase, with NO version suffix — '<entity>' is not one. A manifest declares 'name/vN'; this field takes the bare name and 'version' separately.` |
| `data/description-required` | `description is required — it is what a human reads when deciding whether to grant access to this dataset` |
| `data/no-queryable-fields` | `queryableFields must list at least one field — an entity nobody can query is not publishable` |
| `data/bad-queryable-field` | `every queryable field needs a name` |
| `data/bad-field-type` | `field '<name>' has type '<type>' — must be string, number, boolean or timestamp` |
| `data/bad-grain` | `grain names <field, field>, which are not queryable fields on this entity` |
| `publish/namespace-denied` | `applications publish only in their own namespace — '<entity>' must start with '<app>.'` |
| `publish/not-declared` | `'<entity>' at version <n> is not declared on the live deployment — vmnodes.json's "publishes" must list "<local>/v<n>".` |
| `publish/not-declared` | `'<entity>' at version <n> cannot be registered: no live deployment. vmnodes.json's "publishes" must list "<local>/v<n>" once this application has one.` |
| `publish/not-declared` | `'<entity>' at version <n> cannot be registered: the live deployment's image recorded no publishes list (built before vmnodes.json publishes was read), so there is nothing to check against. Rebuild to declare one, listing "<local>/v<n>" in vmnodes.json's "publishes".` |

**Do not register while the app is starting.** The check reads the live version's list, and your new version is not live until it answers its health check. Registering at boot fails with `publish/not-declared` and "no live deployment" on a launch, and on an update checks the old version's list. Register on the first publish instead, and try again on failure, as the starter's `publish.js` does.

## Publish records

`POST /v1/publish/records`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `entity` | string | yes | The registered entity. |
| `records` | array | yes | Up to 1000 per call. |
| `records[].recordKey` | string | yes | Your id for the record. The same key replaces the record. |
| `records[].payload` | object | yes | The values, keyed by field name. |
| `records[].sourceUpdatedAt` | string | no | When the record last changed, an ISO 8601 timestamp. |
| `mode` | `upsert` or `snapshot` | no | `upsert` by default. |

- **`upsert`** adds new records and replaces records with the same `recordKey`. Nothing is deleted.
- **`snapshot`** upserts what you send and marks every record you did not send as deleted. Send the whole list every time. Use it when the app keeps its records in a database, so a record deleted there disappears from the share too.

A successful call answers 200: `{"upserted": 3, "tombstoned": 0}`. `tombstoned` counts records marked deleted.

### Publish errors

| Code | Message |
|---|---|
| `publish/unknown-entity` | `register '<entity>' before publishing to it` |
| `publish/retired` | `This app no longer shares '<entity>'. Nothing new is accepted for it.` |
| `publish/entity-owned-elsewhere` | `'<entity>' belongs to a different source` |
| `publish/too-many-records` | `publish at most 1000 records per call` |

An entity is retired when its entry leaves `publishes`. Add it back, update the app, and register it again.

## Example

This is what the starter does for a `note/v1` entity in an app launched as `noticeboard`, with `VMNODES_APP_NAME` set to `noticeboard`:

```js
const base = process.env.VMNODES_API_URL;
const headers = {
  authorization: `Bearer ${process.env.VMNODES_PUBLISH_TOKEN}`,
  "content-type": "application/json",
};
const entity = `${process.env.VMNODES_APP_NAME}.note`;

async function call(path, body) {
  const res = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

await call("/v1/publish/entities", {
  entity,
  description: "Notes posted on the team noticeboard.",
  classification: "internal",
  queryableFields: [
    { name: "text", type: "string" },
    { name: "author", type: "string" },
    { name: "postedAt", type: "timestamp" },
  ],
});

await call("/v1/publish/records", {
  entity,
  mode: "snapshot",
  records: notes.map((n) => ({
    recordKey: n.id,
    payload: { text: n.text, author: n.authorName, postedAt: n.postedAt },
    sourceUpdatedAt: n.postedAt,
  })),
});
```

The call answers `{"upserted":N,"tombstoned":0}` when it worked.

## Reading shared records

`POST /v1/data/query` reads records that another app, or your own, has shared and been granted access to.

An app can read only what it has been given access to. Today, giving an app access to a shared entity is done by your VMnodes contact. Ask them for access to the entity by name, such as `crm.note`, and for a token for your app.

**An app that publishes nothing has no token.** The platform creates a token for an app only when its `vmnodes.json` lists at least one entry under `publishes`. A portal app with no `publishes` entry has no credential to send to `POST /v1/data/query`, which answers 401 `auth/unauthorised` with `a valid API token is required`. If your app only reads shared records, ask your VMnodes contact for a token and for the access, rather than adding a `publishes` entry to get one.
> **Coming:** reading another app's shared data from a portal app, without asking your VMnodes contact. Today it needs them.

### Query request

```json
{
  "entity": "crm.note",
  "select": ["text", "author", "postedAt"],
  "filter": [{ "field": "author", "op": "eq", "value": "Eden" }],
  "orderBy": { "field": "postedAt", "dir": "desc" },
  "limit": 20
}
```

| Field | Meaning |
|---|---|
| `entity` | Required. The entity name. |
| `select` | Required. At least one field name. |
| `filter` | Optional list of `{field, op, value}`. `op` is `eq`, `ne`, `in` (1 to 100 values), `gt`, `gte`, `lt`, `lte` or `contains`. |
| `orderBy` | Optional `{field, dir}`. `dir` is `asc` or `desc`. |
| `limit` | Optional positive whole number. Default 50, at most 200. |
| `aggregate` | Optional `{fn, field?, groupBy?, buckets?}`. `fn` is `count`, `sum`, `min` or `max`. `buckets` is `{field: "day" | "month" | "year"}`. A grouped result is capped at 200 groups. |

### How a filter compares values

A filter compares values by the field's `type`, which the publishing app declared in `queryableFields`. `GET /v1/data/entities/<entity>` lists each field and its type.

- **`number`:** compared as numbers.
- **`string`:** compared as text. `eq` is exact and case-sensitive; `contains` ignores case.
- **`timestamp`:** compared as a point in time, and **any time-zone offset in the value is ignored**. Write every timestamp filter in UTC, ending in `Z`.
  - `"2026-10-20"` means midnight UTC at the start of 20 October.
  - `"2026-10-20T00:00:00+11:00"` is read as midnight UTC, eleven hours late, and nothing warns you.
  - To ask for one day or week in the business's own time zone, turn its start and end into UTC instants first. [Dates and time zones](../how-to/dates-and-time-zones.md) has `wallTimeToInstant` for that.
  - A stored value that does not begin with `YYYY-MM-DD` never matches a timestamp filter.
- **`boolean`:** compared as the text `true` or `false`.

An aggregate returns one row per group, holding the `groupBy` fields and one value named after `fn`. For example, `"aggregate": {"fn": "count", "groupBy": ["stylist"]}` returns rows such as `{"stylist": "Ana", "count": 3}`. With no `groupBy` it returns one row, such as `{"count": 12}`. `sum`, `min` and `max` read the `field` you name as a number, and skip values that are not numbers.

The response:

```json
{
  "rows": [ { "text": "Lunch is on", "author": "Eden", "postedAt": "2026-10-22T01:00:00.000Z" } ],
  "provenance": { "entity": "crm.note", "source": "crm", "freshestAt": "…", "stalestAt": "…" },
  "truncated": false,
  "rowCount": 1
}
```

`truncated` is `true` when more rows matched than were returned. `truncation` says why: `none`, `groups` or `scan`. `withheld` lists fields the caller may not see, when there are any. `provenance` says which app the rows came from and how old they are.

To see what exists and what fields you may read, call `GET /v1/data/entities`, and `GET /v1/data/entities/<entity>` for one.

An app on its own sees what the app has been granted. To see only what a person is also allowed to see, send the identity header's value as `X-Vmnodes-On-Behalf-Of: <the X-Vmnodes-Identity value>`; the result is limited to what both the app and the person may read. Only an app's token may send it.

### Query errors

| Message | Meaning |
|---|---|
| `no query access to '<entity>'` | The same text for an entity that does not exist, one you have no access to, and one with no field shared with you. |
| `no aggregate access to '<entity>'` | The same, for an aggregate. |
| `field '<field>' is not available to you on '<entity>'` | The field is not shared with you. |
| `rows of '<entity>' are identified by <grain>, and <hidden> <is\|are> not available to you — two rows could differ in a way you cannot see. Aggregate instead (count, sum, min, max), which needs no row identity.` | You cannot see every field that identifies a row. |
| `unknown operator '<op>'` | Use one of the operators above. |
| `select at least one field` | `select` is empty. |
| `select is required — select at least one field` | `select` is missing. |
| `entity is required and must be a string` | |
| `select must be an array of field names` | |
| `limit must be a positive integer` | |

## Related

- [Sharing data with other apps](../concepts/sharing.md)
- [vmnodes.json reference](vmnodes-json.md)
- [Environment variables](environment.md)
- [Limits and what is not possible yet](limits.md)
