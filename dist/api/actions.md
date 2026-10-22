# Actions and approvals

Actions are the only write path across apps: a caller proposes a typed action, the action's approval policy decides whether it queues at once or waits for a different person to approve, and the result is polled by invocation id. Plans chain several actions behind one approval.

## List actions

`GET /v1/actions`

Lists the registered actions the caller may propose or approve, with each input schema, risk and approval policy.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/actions" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "action": "quotes.send-quote",
    "version": 1,
    "description": "Email a quote to the customer",
    "risk": "moderate",
    "approvalPolicy": "required",
    "inputSchema": {
      "type": "object",
      "properties": {
        "quoteNumber": {
          "type": "string"
        }
      },
      "required": [
        "quoteNumber"
      ]
    },
    "derivedInputs": [],
    "canPropose": true,
    "canApprove": false
  }
]
```

`risk` is `low`, `moderate` or `high`. `approvalPolicy` is `none` or `required`. `derivedInputs` names inputs the platform fills in from governed data; a caller cannot supply them.

## Propose an action

`POST /v1/actions/propose`

Proposes one action. A low-risk, pre-authorised action queues at once; one that needs approval waits for a different person. Poll the invocation for the outcome.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/actions/propose" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"action":"quotes.send-quote","input":{"quoteNumber":"Q-1042"},"idempotencyKey":"send-Q-1042-2026-10-22"}'
```

**Request body**

```json
{
  "action": "quotes.send-quote",
  "input": {
    "quoteNumber": "Q-1042"
  },
  "idempotencyKey": "send-Q-1042-2026-10-22"
}
```

**Response** `202`

```json
{
  "invocationId": "inv_01JBX3VSJ2D3QV2Z0B17EQ78VS",
  "status": "proposed",
  "deduplicated": false
}
```

| Status | Code | Message |
|---|---|---|
| 422 | `actions/denied` | `no propose access to '<action>'` |
| 422 | `actions/bad-input` | `input does not match the action schema: <detail>` |
| 422 | `actions/rate-limited` | `'<action>' allows <n> proposals per hour` |

`status` is `proposed` (waiting for approval) or `queued`. `input` defaults to an empty object. Always send an `idempotencyKey` you derive from the business event: without one every call is a new proposal and nothing is deduplicated. Supplying an input the platform derives returns 422 `actions/derived-input-supplied`.

## List actions awaiting approval

`GET /v1/actions/pending`

Lists proposals waiting for approval, limited to actions the caller may approve.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/actions/pending" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
[
  {
    "invocationId": "inv_01JBX3VSJ2D3QV2Z0B17EQ78VS",
    "action": "quotes.send-quote",
    "risk": "moderate",
    "input": {
      "quoteNumber": "Q-1042"
    },
    "provenance": {},
    "description": "Email a quote to the customer",
    "compensation": null,
    "derivedInputs": [],
    "proposedBy": "usr_00000000000000000000000002",
    "proposedAt": "2026-10-21T22:41:55.000Z"
  }
]
```

Response shape not yet documented for `provenance`; the empty object in the example is a placeholder.

## Approve an action

`POST /v1/actions/{invocationId}/approve`

Approves a waiting proposal and queues it. The approver must be someone other than the proposer.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `invocationId` | path | yes | The invocation id from the propose call. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/actions/<invocationId>/approve" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"reason":"Checked the total with the customer"}'
```

**Request body**

```json
{
  "reason": "Checked the total with the customer"
}
```

**Response** `200`

```json
{
  "status": "queued"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `actions/not-found` | `no such invocation` |
| 422 | `actions/not-pending` | `invocation is '<status>', not awaiting approval` |
| 422 | `actions/denied` | `no approve access to '<action>'` |
| 422 | `actions/self-approval` | `the approver must be different from the proposer` |

`reason` is optional. A portal session may also call this route.

## Deny an action

`POST /v1/actions/{invocationId}/deny`

Denies a waiting proposal.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `invocationId` | path | yes | The invocation id from the propose call. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/actions/<invocationId>/deny" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"reason":"Wrong customer"}'
```

**Request body**

```json
{
  "reason": "Wrong customer"
}
```

**Response** `200`

```json
{
  "status": "denied"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `actions/not-found` | `no such invocation` |
| 422 | `actions/not-pending` | `invocation is '<status>', not awaiting approval` |
| 422 | `actions/denied` | `no approve access to '<action>'` |
| 422 | `actions/self-approval` | `the approver must be different from the proposer` |

`reason` is optional. A portal session may also call this route.

## Get an action invocation

`GET /v1/actions/{invocationId}`

Returns the status and result of one invocation. Only the proposer or someone who may approve the action can see it.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `invocationId` | path | yes | The invocation id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/actions/<invocationId>" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "invocationId": "inv_01JBX3VSJ2D3QV2Z0B17EQ78VS",
  "action": "quotes.send-quote",
  "status": "succeeded",
  "input": {
    "quoteNumber": "Q-1042"
  },
  "provenance": {},
  "result": {
    "sent": true
  },
  "errorDetail": null,
  "proposedBy": "usr_00000000000000000000000002",
  "approvedBy": "usr_00000000000000000000000009",
  "denyReason": null,
  "attempts": 1,
  "proposedAt": "2026-10-20T03:14:07.000Z",
  "completedAt": "2026-10-21T22:41:55.000Z"
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `actions/not-found` | `no such invocation` |

`status` is `proposed`, `queued`, `leased`, `running`, `succeeded`, `failed`, `denied` or `dead`. Anyone else gets 404. Response shape not yet documented for `provenance` and `result`, whose contents depend on the action; the examples are placeholders.

## Grant action access

`POST /v1/actions/grants`

Lets one user, one group or one app propose, or approve, an action. Name exactly one principal.

**Auth:** administrator API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/actions/grants" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"action":"quotes.send-quote","groupId":"grp_01JBX3AEWFGRGNRHA3GTM6Y8FZ","allowPropose":true,"allowApprove":false,"purpose":"Sales team sends quotes","expiresDays":90}'
```

**Request body**

```json
{
  "action": "quotes.send-quote",
  "groupId": "grp_01JBX3AEWFGRGNRHA3GTM6Y8FZ",
  "allowPropose": true,
  "allowApprove": false,
  "purpose": "Sales team sends quotes",
  "expiresDays": 90
}
```

**Response** `201`

```json
{
  "grantId": "ag_01JBX3FS6TKPBWAAZHT7N83MS7"
}
```

| Status | Code | Message |
|---|---|---|
| 403 | `grants/forbidden-workload` | `an application's own token cannot grant access; an organisation administrator's admin token can` |
| 403 | `grants/forbidden-scope` | `granting requires the 'admin' scope` |
| 422 | `actions/one-principal` | `exactly one of userId/groupId/applicationId is required` |
| 422 | `actions/unknown-action` | `no action '<action>' in this organisation` |

`allowPropose` defaults to true and `allowApprove` to false. `purpose` and `expiresDays` are optional. A portal session cannot call this route.

## Propose a plan

`POST /v1/plans`

Proposes up to 20 actions as one plan that a person approves once. A step can use an earlier step's output with `{"$fromStep": 1, "output": "fieldName"}`.

**Auth:** API token.

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/plans" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"name":"Onboard Sample Co","description":"Create the customer and send the first quote","steps":[{"action":"quotes.create-quote","input":{"customer":"Sample Co"}},{"action":"quotes.send-quote","input":{"quoteNumber":{"$fromStep":1,"output":"quoteNumber"}},"waitUntil":"2026-10-23T00:00:00.000Z","waitReason":"Send after the customer'\''s office opens"}]}'
```

**Request body**

```json
{
  "name": "Onboard Sample Co",
  "description": "Create the customer and send the first quote",
  "steps": [
    {
      "action": "quotes.create-quote",
      "input": {
        "customer": "Sample Co"
      }
    },
    {
      "action": "quotes.send-quote",
      "input": {
        "quoteNumber": {
          "$fromStep": 1,
          "output": "quoteNumber"
        }
      },
      "waitUntil": "2026-10-23T00:00:00.000Z",
      "waitReason": "Send after the customer's office opens"
    }
  ]
}
```

**Response** `201`

```json
{
  "planId": "plan_01JBX3M08R69XJE166YVJK034H",
  "status": "proposed"
}
```

| Status | Code | Message |
|---|---|---|
| 422 | `plans/no-name` | `a plan needs a name` |
| 422 | `plans/empty` | `a plan needs at least one step` |
| 422 | `plans/too-long` | `a plan holds at most 20 steps` |
| 422 | `plans/step-denied` | `step <n>: no propose access to '<action>'` |
| 422 | `plans/bad-reference` | `step <n> field '<key>' refers to step <k>, which is not an earlier step — a reference can only name a step that has already run` |
| 422 | `plans/bad-wait` | `step <n>: waitUntil is not a valid timestamp` |
| 422 | `plans/bad-template-ref` | `templateRef is at most 200 characters` |

`description`, `templateRef`, `waitUntil` and `waitReason` are optional. The plan's steps run in order once approved.

## List plans

`GET /v1/plans`

Lists plans the caller proposed or may decide.

**Auth:** API token.

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/plans" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "plans": [
    {
      "id": "plan_01JBX3M08R69XJE166YVJK034H",
      "name": "Onboard Sample Co",
      "description": "Create the customer and send the first quote",
      "status": "proposed",
      "templateRef": null,
      "proposedBy": "usr_00000000000000000000000002",
      "approvedBy": null,
      "denyReason": null,
      "createdAt": "2026-10-20T03:14:07.000Z",
      "completedAt": null,
      "steps": [
        {
          "id": "pstep_01JBX34AGQ80JJ4HDT8QY4V3PY",
          "position": 1,
          "action": "quotes.send-quote",
          "input": {
            "quoteNumber": "Q-1043"
          },
          "status": "pending",
          "invocationId": null,
          "result": null,
          "errorDetail": null,
          "description": "Email a quote to the customer",
          "risk": "moderate",
          "compensation": null,
          "waitUntil": null,
          "waitReason": null
        }
      ]
    }
  ]
}
```

## Get a plan

`GET /v1/plans/{id}`

Returns one plan with each step's status and result.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `id` | path | yes | The plan id. |

**Example**

```bash
curl -sS -X GET "$VMNODES_API_URL/v1/plans/<id>" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN"
```

**Response** `200`

```json
{
  "id": "plan_01JBX3M08R69XJE166YVJK034H",
  "name": "Onboard Sample Co",
  "description": "Create the customer and send the first quote",
  "status": "proposed",
  "templateRef": null,
  "proposedBy": "usr_00000000000000000000000002",
  "approvedBy": null,
  "denyReason": null,
  "createdAt": "2026-10-20T03:14:07.000Z",
  "completedAt": null,
  "steps": [
    {
      "id": "pstep_01JBX34AGQ80JJ4HDT8QY4V3PY",
      "position": 1,
      "action": "quotes.send-quote",
      "input": {
        "quoteNumber": "Q-1043"
      },
      "status": "pending",
      "invocationId": null,
      "result": null,
      "errorDetail": null,
      "description": "Email a quote to the customer",
      "risk": "moderate",
      "compensation": null,
      "waitUntil": null,
      "waitReason": null
    }
  ]
}
```

| Status | Code | Message |
|---|---|---|
| 404 | `plans/not-found` | `no such plan` |

Plan `status` is `proposed`, `approved`, `running`, `completed`, `denied` or `failed`.

## Approve or deny a plan

`POST /v1/plans/{id}/decision`

Approves or denies a proposed plan. Approving needs approve access to every action in it, and the approver must be someone other than the proposer.

**Auth:** API token.

| Parameter | In | Required | Meaning |
|---|---|---|---|
| `id` | path | yes | The plan id. |

**Example**

```bash
curl -sS -X POST "$VMNODES_API_URL/v1/plans/<id>/decision" \
  -H "Authorization: Bearer $VMNODES_API_TOKEN" \
  -H "content-type: application/json" \
  --data '{"decision":"approve","reason":"Reviewed the quote values"}'
```

**Request body**

```json
{
  "decision": "approve",
  "reason": "Reviewed the quote values"
}
```

**Response** `200`

```json
{
  "status": "approved"
}
```

| Status | Code | Message |
|---|---|---|
| 400 | `plans/bad-decision` | `decision must be approve or deny` |
| 404 | `plans/not-found` | `no such plan` |
| 422 | `plans/not-pending` | `plan is '<status>', not awaiting approval` |
| 422 | `plans/self-approval` | `the approver must be different from the proposer` |
| 422 | `plans/step-not-approvable` | `you may not approve '<action>' (step <n>), so you cannot approve a plan containing it` |

`status` in the response is `approved` or `denied`. `reason` is optional. This route needs an API token: a portal session cannot call it.

## Related

- [API reference](index.md)
- [Troubleshooting](../troubleshooting.md)
