# Data

Understand where an app's data lives, which of it survives an update, and how to ask VMnodes for a database. Read this before your app stores anything it cannot afford to lose.

## Three places data can be

| Where | Survives an update or restart? | Who can read it |
|---|---|---|
| Memory or the container's own disk | No. An update replaces the container, and a restart empties memory | Your app |
| The app's database | Yes | Your app only |
| Shared records, a curated copy you publish | Yes, as long as your app publishes them | Other apps in the org, field by field, as an administrator decides. See [Sharing](sharing.md) |

Private application data is kept separate from shared business data. Other apps cannot read your database, and that is deliberate. Share a curated copy instead.

## Ask for a database

Say so in `vmnodes.json`:

```json
{
  "apiVersion": "vmnodes.com/v1",
  "roles": [
    {
      "name": "starter.editor",
      "description": "Can post and edit messages."
    }
  ],
  "database": true,
  "publishes": ["note/v1"]
}
```

When VMnodes deploys a commit with `"database": true`, it creates the app's own PostgreSQL database first, waits until it is ready, and only then starts your app with `DATABASE_URL` set to a full connection string. You do not create the database by hand and you do not copy the connection string anywhere. VMnodes does not create tables for you: your app creates its own, as the starter's `store.js` does when it starts.

If the database cannot be set up, nothing is started and any version already running keeps running. Try again.

## Read `DATABASE_URL`

The starter decides where notes live in one place, from `DATABASE_URL`:

```js
function storageFor(env) {
  return env.DATABASE_URL
    ? { kind: "postgres", publishMode: "snapshot" }
    : { kind: "memory", publishMode: "upsert" };
}
```

`/health` reports which one is running as `"storage": "postgres"` or `"storage": "memory"`, and the app's page says so in its last line.

Two rules keep data safe:

- **No quiet fallback.** If `DATABASE_URL` is set but the database cannot be reached, the starter refuses to start. Falling back to memory would lose every note at the next restart.
- **Locally there is no database.** `npm run dev` sets no `DATABASE_URL`, so the starter keeps notes in memory. To try the database on your computer, set `DATABASE_URL` to a Postgres database of your own.

## Traps

> **Trap:** without `"database": true`, an update clears your data. The **Deployment** card warns "Updating replaces your app's container. Anything not saved in its database is cleared." before you press **Update to latest commit**. Anything the app wrote to its own disk or kept in memory is gone, not only the notes. Put `"database": true` in `vmnodes.json` and keep the data in the database before the first update.

> **Trap:** adding `"database": true` in a later commit takes effect at the next deploy, and nothing the app held in memory or on its disk before then is carried into it. Decide before the app holds data you care about.

> **Trap:** removing `"database"` from `vmnodes.json` does not delete the database. The app keeps it, and the **Deployment** card says "This app still has its database, and keeps it, although vmnodes.json no longer asks for one." A file edit is never what deletes your data.

> **Trap:** `snapshot` publishing treats each batch as everything you have, and deletes shared records missing from it. Publish with `snapshot` only when the list is read from the database. The starter picks the mode in `storageFor` so the two cannot drift. See [Sharing](sharing.md).

## Related

- [Keep data through updates](../how-to/keep-data-through-updates.md)
- [`vmnodes.json`](../reference/vmnodes-json.md)
- [Sharing](sharing.md)
- [Apps](apps.md)
