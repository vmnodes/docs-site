# Connectors

Connectors link the organisation to outside systems. Setting one up is an operator step: ask your VMnodes contact.

## List connectors

`GET /v1/connectors`

Lists the organisation's connectors with their state.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/connectors" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "id": "conn_01JBX3K00ZAR68QNR66YFVTGS1",
    "kind": "xero",
    "status": "connected",
    "tenantName": "Example Pty Ltd",
    "lastSyncAt": "2026-10-21T22:41:55.000Z",
    "lastError": null
  }
]
```

| Status | Code | Message |
|---|---|---|
| 501 | `connector/not-configured` | `no connectors configured` |

## Sync Xero

`POST /v1/connectors/xero/sync`

Pulls contacts and invoices from the connected Xero organisation into the platform.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/connectors/xero/sync" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "contacts": 42,
  "invoices": 118,
  "lines": 307,
  "tenant": "Example Pty Ltd"
}
```

| Status | Code | Message |
|---|---|---|
| 501 | `connector/not-configured` | `Xero is not configured` |
| 422 | `xero/not-connected` | `connect Xero first` |
| 422 | `xero/disabled` | `the Xero connection is disabled` |

Connecting Xero is an operator step: ask your VMnodes contact.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
