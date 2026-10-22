# Limits and what is not possible yet

This page lists every fixed limit on a VMnodes app, and everything a builder cannot do on their own today, with what to do instead. Read it before you promise a customer a feature, and when something you expected is missing.

Where a row says "your VMnodes contact", that person at VMnodes can do it for you; the portal and the app cannot.

| Limit or not possible yet | Today | What to do instead |
|---|---|---|
| Creating an org | Needs an invite code. | Ask your VMnodes contact for an invite code. |
| Inviting a second person | No portal screen. The person must already be a member of the org. | Ask your VMnodes contact to invite them. |
| Creating a group | The portal can attach an existing group to an app, not create one. | Ask your VMnodes contact to create the group, then attach it on the **People** tab. |
| API tokens | Builders cannot create them. | Ask your VMnodes contact. An app that shares data gets its own token automatically; see [Publish and query API](publish-api.md). |
| Secrets and environment variables you choose | `vmnodes.json` has no key for them, and the portal has no screen. | Keep configuration in the app, or in its database. The platform's own variables are on [Environment variables](environment.md). |
| Reading another app's shared data | Needs a grant made by your VMnodes contact, and a token. | Ask your VMnodes contact for access to the entity by name. A portal app that publishes nothing has no token. |
| Mail, AI, directory and Xero connections | Not available to a portal app. | Ask your VMnodes contact. The [manifest path](manifest-json.md) can ask for some of them. |
| The manifest path | Your VMnodes contact signs, submits and approves. | Give them the manifest and the image. |
| A public app, one anyone can open | Not available. Everyone who opens an app must be a member of the org with access. | Give each person access on the **People** tab. |
| Stopping and starting an app | No portal button. | Ask your VMnodes contact. |
| Disconnecting GitHub | No screen. An org connects one GitHub account. | Ask your VMnodes contact. |
| Python or another language without a `Dockerfile` | Depends on how the platform is set up. | Commit a `Dockerfile`; see [Build, run and security checks](build-and-run.md#build-paths). |
| Scan setting | Whether critical findings block a deploy is set by VMnodes. | Fix critical findings either way; see [Security scan](build-and-run.md#security-scan). |
| Repository layout | The app is at the repository root; no subdirectories or monorepos. | Move the app to the root of its own repository. |
| Branch and repository on update | **Update to latest commit** uses the latest commit of the default branch of the repository the app was launched from. It cannot be changed. | Merge into the default branch, then update. |
| Updates at once | One per app at a time. | Wait for the running one to finish. |
| Who sees what in the portal | A member who is not an administrator sees the **Overview** tab only. | Ask an administrator to do what needs the other tabs. |
| Port | 3000, fixed, and the app must listen on all addresses. | Listen on 3000. |
| Memory and CPU | Fixed: 2048 MiB maximum memory, a CPU share of 512. | Keep the app within them. |
| Data kept in the container | Cleared on every update. | Set `"database": true` and keep data there. See [Environment variables](environment.md#secrets). |
| Logs | The Console shows the last 50 lines; the files rotate at 10 MB, three kept. | Log what you need to find a fault, and keep it short. |
| `vmnodes.json` size | 64 KiB. | Keep roles short. |
| App name | 3 to 30 characters, lowercase letters, digits and hyphens, not reserved. See [Build, run and security checks](build-and-run.md#the-apps-address-and-name). | Pick another name. |
| Role name | One or two segments joined by a dot, each 2 to 31 characters. | See [vmnodes.json reference](vmnodes-json.md#roles). |
| A role added by an update | Nobody holds it until an administrator gives it. | Give it on the **People** tab with **Change roles**. |
| Records per publish call | 1000. | Send in batches. In `snapshot` mode a batch that is only part of the list marks the rest as deleted, so use `upsert` for batches. |
| Publish and query requests | 300 requests a minute, and 1 MiB per request. | Batch and cache. |
| Query rows | 50 by default, at most 200 per query. Grouped results are cut at 200 groups. The `in` filter takes 1 to 100 values. | Filter and aggregate. |
| Launch scan wait | 10 minutes. Boot window for the first health check: 60 seconds. | Make the app answer `/health` quickly. |

## Related

- [vmnodes.json reference](vmnodes-json.md)
- [Build, run and security checks](build-and-run.md)
- [Publish and query API](publish-api.md)
- [Orgs and people](../concepts/orgs-and-people.md)
