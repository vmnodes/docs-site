# Mail

Send a plain-text email to a person in the organisation or to an address, from the platform's sending address. Needs the `mail.send` scope, which the manifest `permissions.mail.send` field requests.

## Send an email

`POST /v1/connectors/mail/send`

Sends a plain-text email to a person in the organisation or to an address. The idempotency key makes a retried call send once.

**Auth:** API token with the mail.send scope.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/connectors/mail/send" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"to":{"email":"pat@example.com"},"subject":"Quote Q-1042","textBody":"Hello Pat,\n\nYour quote Q-1042 is ready.","ref":"Q-1042","idempotencyKey":"quote-Q-1042-sent"}'
```

**Request body**

```json
{
  "to": {
    "email": "pat@example.com"
  },
  "subject": "Quote Q-1042",
  "textBody": "Hello Pat,\n\nYour quote Q-1042 is ready.",
  "ref": "Q-1042",
  "idempotencyKey": "quote-Q-1042-sent"
}
```

**Response** `202`

```json
{
  "messageId": "mail_01JBX3GGZF4R91KTZVQGQ41EZX",
  "status": "sent"
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `mail/forbidden` | `token lacks the mail.send scope` |
| 400 | `mail/bad-subject` | `subject is required (max 200 chars)` |
| 400 | `mail/bad-body` | `textBody is required (max 100000 chars)` |
| 400 | `mail/bad-idempotency-key` | `idempotencyKey is required (max 200 chars)` |
| 400 | `mail/bad-ref` | `ref must be a string (max 100 chars)` |
| 400 | `mail/bad-recipient` | `provide exactly one of to.userId or to.email` |
| 400 | `mail/unknown-recipient` | `no such user in this organisation` |
| 429 | `mail/rate-limited` | `hourly send limit reached` |
| 502 | `mail/send-failed` | `mail transport failed; retry with the same idempotencyKey` |

`to` holds exactly one of `userId` or `email`. `ref` is optional. An invalid address returns 400 `mail/bad-recipient` with `invalid email address`. When mail is not set up the 503 body is a bare `{"error":"mail transport is not configured"}` with no code. Limits: 50 sends per hour per caller and 200 per hour per organisation; a 429 carries a `retry-after` header of 300 seconds.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
