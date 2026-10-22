# API reference

The VMnodes HTTP API: what your app calls to share and read data, and what an administrator's tools call to manage apps. Every endpoint below has an example you can run.

## Who can call it

- **Your app**, with its own app token. When your app shares data, VMnodes gives it `VMNODES_API_URL` and `VMNODES_PUBLISH_TOKEN` (see [Environment variables](../reference/environment.md)). Endpoints marked *app token* are called this way.
- **Tools and scripts**, with an API token. API tokens are issued by your VMnodes contact today; there is no screen for them yet. The examples read it from `$VMNODES_API_TOKEN`.

Every example uses `$VMNODES_API_URL` as the base address. Inside your app it is set for you; for an API token, your VMnodes contact tells you the address.

## Errors

A refused request answers with a 4xx or 5xx status and a body of the form `{"error": {"code": "<area>/<reason>", "message": "<sentence>"}}`. The `code` is stable; the `message` is for people. `401` means the token is missing or not valid; `429` means slow down and retry.

## Sections

| Section | Endpoints |
|---|---|
| [Sharing data from your app](sharing.md) | 2 |
| [Reading shared data](reading.md) | 7 |
| [Identity and the app directory](identity.md) | 5 |
| [Applications and deployments](applications.md) | 17 |
| [People and roles](people.md) | 3 |
| [Groups](groups.md) | 3 |
| [Data governance](governance.md) | 1 |
| [Actions and approvals](actions.md) | 11 |
| [Connectors](connectors.md) | 2 |
| [Mail](mail.md) | 1 |
| [AI completions](ai.md) | 1 |
| [Organisation](organisation.md) | 4 |

This reference documents 57 endpoints. The API has others that are for the platform's own use and are not part of the public reference.
