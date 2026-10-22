# Sharing data from your app

These two calls publish your app's records so other apps and people can read them through the governed data path. Call them with your app's own token, which the platform injects as `VMNODES_PUBLISH_TOKEN` (API address in `VMNODES_API_URL`). Every request sends `Authorization: Bearer <token>` and a JSON body. Errors come back as `{"error":{"code":"...","message":"..."}}`. The API allows 300 requests per minute per caller.

## Register an entity

`POST /v1/publish/entities`

Declares a shared entity and its queryable fields. Call it once per entity version at boot, after the app has a live production deployment, and before publishing records. The entity name must be `<appName>.<local>`, and `vmnodes.json` must declare `<local>/vN` under `publishes`. Registering the same version again replaces the field list. Every field of an app's entity starts not shared: `notSharedFields` lists them, and an administrator decides which become readable.

**Auth:** app token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/publish/entities" \
  -H "Authorization: Bearer $VMNODES_PUBLISH_TOKEN" \
  -H "content-type: application/json" \
  --data '{"entity":"quotes.quote","version":1,"description":"A quote sent to a customer","classification":"internal","queryableFields":[{"name":"quoteNumber","type":"string"},{"name":"customer","type":"string"},{"name":"total","type":"number"},{"name":"sentAt","type":"timestamp"}],"grain":["quoteNumber"]}'
```

**Request body**

```json
{
  "entity": "quotes.quote",
  "version": 1,
  "description": "A quote sent to a customer",
  "classification": "internal",
  "queryableFields": [
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
  "grain": [
    "quoteNumber"
  ]
}
```

**Response** `201`

```json
{
  "entityDefinitionId": "de_01JBX36G6FWVCMAESX3YS8FNKE",
  "notSharedFields": [
    "quoteNumber",
    "customer",
    "total",
    "sentAt"
  ]
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `publish/workload-token-required` | `publishing needs a workload token bound to an application` |
| 422 | `publish/unknown-application` | `no such application` |
| 422 | `publish/namespace-denied` | `applications publish only in their own namespace — '<entity>' must start with '<appName>.'` |
| 422 | `publish/entity-owned-elsewhere` | `'<entity>' belongs to a different source` |
| 422 | `publish/not-declared` | `'<entity>' at version <n> cannot be registered: no live deployment. vmnodes.json's "publishes" must list "<local>/v<n>" once this application has one.` |
| 422 | `publish/not-declared` | `'<entity>' at version <n> is not declared on the live deployment — vmnodes.json's "publishes" must list "<local>/v<n>".` |
| 422 | `publish/not-declared` | `'<entity>' at version <n> cannot be registered: the live deployment's image recorded no publishes list (built before vmnodes.json publishes was read), so there is nothing to check against. Rebuild to declare one, listing "<local>/v<n>" in vmnodes.json's "publishes".` |
| 422 | `data/bad-entity-name` | `entity names are namespace.name, lowercase, with NO version suffix — '<entity>' is not one. A manifest declares 'name/vN'; this field takes the bare name and 'version' separately.` |
| 422 | `data/description-required` | `description is required — it is what a human reads when deciding whether to grant access to this dataset` |
| 422 | `data/no-queryable-fields` | `queryableFields must list at least one field — an entity nobody can query is not publishable` |
| 422 | `data/bad-queryable-field` | `every queryable field needs a name` |
| 422 | `data/bad-field-type` | `field '<name>' has type '<type>' — must be string, number, boolean or timestamp` |
| 422 | `data/bad-grain` | `grain names <f, f>, which are not queryable fields on this entity` |

`version` defaults to 1. `classification` defaults to `internal`. Field `type` is one of `string`, `number`, `boolean`, `timestamp`. `grain` names the fields that identify one record and must be queryable fields. Send the bare entity name and the version separately: `quotes.quote` with `version` 1, never `quotes.quote/v1`. The three `publish/not-declared` errors mean the same thing from different starting points: the live production deployment does not list `quote/v1` under `publishes` in `vmnodes.json`. The first is the common trap: an app that registers at boot, before its first deployment is live, has no live deployment yet, so register after startup and retry. Replace `<local>` with the part of the entity after `<appName>.`.

## Publish records

`POST /v1/publish/records`

Sends up to 1000 records for a registered entity. Each record has a stable `recordKey` and a `payload` object. Fields that are not shared are removed from the stored payload. With `mode` `snapshot` the call is treated as the complete set: records you do not send are tombstoned. With `upsert` (the default) only the records you send change.

**Auth:** app token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/publish/records" \
  -H "Authorization: Bearer $VMNODES_PUBLISH_TOKEN" \
  -H "content-type: application/json" \
  --data '{"entity":"quotes.quote","mode":"upsert","records":[{"recordKey":"Q-1042","payload":{"quoteNumber":"Q-1042","customer":"Example Pty Ltd","total":1850,"sentAt":"2026-10-20T01:00:00.000Z"},"sourceUpdatedAt":"2026-10-20T01:00:00.000Z"},{"recordKey":"Q-1043","payload":{"quoteNumber":"Q-1043","customer":"Sample Co","total":420.5,"sentAt":"2026-10-21T04:30:00.000Z"}}]}'
```

**Request body**

```json
{
  "entity": "quotes.quote",
  "mode": "upsert",
  "records": [
    {
      "recordKey": "Q-1042",
      "payload": {
        "quoteNumber": "Q-1042",
        "customer": "Example Pty Ltd",
        "total": 1850,
        "sentAt": "2026-10-20T01:00:00.000Z"
      },
      "sourceUpdatedAt": "2026-10-20T01:00:00.000Z"
    },
    {
      "recordKey": "Q-1043",
      "payload": {
        "quoteNumber": "Q-1043",
        "customer": "Sample Co",
        "total": 420.5,
        "sentAt": "2026-10-21T04:30:00.000Z"
      }
    }
  ]
}
```

**Response** `200`

```json
{
  "upserted": 2,
  "tombstoned": 0
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `publish/workload-token-required` | `publishing needs a workload token bound to an application` |
| 422 | `publish/too-many-records` | `publish at most 1000 records per call` |
| 422 | `publish/unknown-entity` | `register '<entity>' before publishing to it` |
| 422 | `publish/retired` | `This app no longer shares '<entity>'. Nothing new is accepted for it.` |
| 422 | `publish/entity-owned-elsewhere` | `'<entity>' belongs to a different source` |

`sourceUpdatedAt` is optional and, when sent, is used for freshness in query provenance. `mode` defaults to `upsert`. Records that fail field checks return 422 with a message naming the field.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
