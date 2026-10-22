# AI completions

Run a model completion without holding model credentials. Needs the `ai.complete` scope, which the manifest `permissions.ai.complete` field requests. Prompt and completion text is never stored by the platform; only lengths are.

## Complete a prompt

`POST /v1/ai/complete`

Runs a model completion and returns the text. Pass `jsonSchema` to get JSON that matches a schema.

**Auth:** API token with the ai.complete scope.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/ai/complete" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"prompt":"Draft a two-sentence follow-up for quote Q-1042 sent to Example Pty Ltd.","system":"You write short, friendly business emails.","maxTokens":300}'
```

**Request body**

```json
{
  "prompt": "Draft a two-sentence follow-up for quote Q-1042 sent to Example Pty Ltd.",
  "system": "You write short, friendly business emails.",
  "maxTokens": 300
}
```

**Response** `200`

```json
{
  "completion": "Hi Pat, I wanted to check that quote Q-1042 reached you. Let me know if you have any questions.",
  "model": "example-model"
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `ai/forbidden` | `token lacks the ai.complete scope` |
| 400 | `ai/bad-prompt` | `prompt is required (max 40000 chars)` |
| 400 | `ai/bad-system` | `system prompt too long (max 10000 chars)` |
| 429 | `ai/rate-limited` | `hourly completion limit reached` |
| 502 | `ai/failed` | `model call failed; retry later` |
| 400 | `ai/bad-schema` | `jsonSchema was rejected by the model host — schemas are normalised to strict mode (all properties required; use a null type for optional fields), but this one still failed validation` |

`system` and `maxTokens` are optional; `maxTokens` is capped at 2000. `jsonSchema` is `{name, schema}`. When no model is set up the 503 body is a bare `{"error":"no model is configured on this control plane"}` with no code. Limits: 60 completions per hour per caller and 200 per hour per organisation. The 502 is safe to retry; `ai/bad-schema` is not.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
