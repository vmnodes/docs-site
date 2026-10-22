# Sharing

Understand how an app shares records with other apps in its org, and who decides which fields leave. Read this before you publish anything, and before you plan an app that needs another app's data.

To share is to publish a curated copy of your records. Other apps cannot read your database, so you describe a record type once, send records that match it, and an administrator chooses which fields other apps may read. A shared record type is an entity, named `<app>.<thing>`, for example `acme-notes.note`.

## The three names, and the trap in them

One record type is written three ways. Writing the wrong one is the commonest mistake.

| Where | Written as | Example |
|---|---|---|
| `publishes` in `vmnodes.json` | `<thing>/vN`: no app name, no dot | `"publishes": ["note/v1"]` |
| The publish API's `entity` field | `<app>.<thing>`: no version | `acme-notes.note` |
| The Shares tab | `<app>.<thing>` | `acme-notes.note` |

The app name in the API call is the name the app was put online as, so the app must read it from `VMNODES_APP_NAME` and not type it in. The starter does:

```js
const APP_NAME = process.env.VMNODES_APP_NAME || "starter";
```

```js
// vmnodes.json declares "note/v1"; the platform puts the app's own name in front.
const entity = `${appName}.note`;
```

A wrong app name is refused with `applications publish only in their own namespace — '<entity>' must start with '<appName>.'` (`publish/namespace-denied`). An entity that `vmnodes.json` does not list is refused with `publish/not-declared`. The version is sent separately and defaults to 1, which matches `note/v1`.

## Turn publishing on

1. List the entity in `vmnodes.json`: `"publishes": ["note/v1"]`. The local name is lowercase letters, digits and hyphens, starting with a letter, and the version is `v` and a whole number from 1.
2. Deploy to production. When `publishes` is not empty, VMnodes passes two settings to the app before it starts: `VMNODES_API_URL`, where to send calls, and `VMNODES_PUBLISH_TOKEN`, which proves the calls come from your app. They are never set when you run locally, so the starter turns publishing off and `/health` reports `"publishing": false`. Treat the token like a password: never commit it or log it.
3. Make the two calls below from your app.

The token is revoked at the deploy where `publishes` becomes `[]`. Removing one entity from `publishes` retires it at the next production deploy; sending it records afterwards is refused with `This app no longer shares '<entity>'. Nothing new is accepted for it.`

## The two calls

Both go to `VMNODES_API_URL` with `Authorization: Bearer <VMNODES_PUBLISH_TOKEN>`. These are the starter's, from `publish.js`. First describe the record type, once:

```js
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
```

Then send records:

```js
await call("/v1/publish/records", {
  entity,
  mode,
  records: notes.map((n) => ({
    recordKey: n.id,
    payload: { text: n.text, author: n.authorName, postedAt: n.postedAt },
    sourceUpdatedAt: n.postedAt,
  })),
});
```

Field types are `string`, `number`, `boolean` and `timestamp`. A call takes at most 1000 records. Every call and error is in [the publish API](../reference/publish-api.md).

> **Trap:** register after the app is live, not at start-up. The platform checks the entity against the live deployment's `vmnodes.json`, and during the first deploy there is no live deployment yet, so a call made while the app boots fails with `publish/not-declared`. The starter describes the entity on its first publish, which happens when someone posts a note.

> **Trap:** re-describing an entity with a shorter `queryableFields` list replaces the old list. A field you leave out stops being queryable for everyone.

## `upsert` and `snapshot`

`mode` says what happens to records you do not send this time.

| Mode | Does | Use it when |
|---|---|---|
| `upsert` | adds and updates the records you send, and never removes one | the data is kept in memory, or you send only what changed |
| `snapshot` | also removes every record missing from this batch | the list you send is the complete set, read from the app's database |

> **Trap:** `snapshot` with data kept in memory deletes everything. A restart empties memory, and the next snapshot tells the platform every record is gone, for every app reading it. The starter picks the mode in one place, `storageFor`, from `DATABASE_URL`. There is no way to remove one record alone: resend the whole set under `snapshot`, without it.

A second quiet version: two `snapshot` publishes in flight at once can arrive out of order, and the older list deletes the newest record. The starter publishes one at a time and reads the list when its turn comes:

```js
let publishing = Promise.resolve();
function publishLatest() {
  publishing = publishing
    .then(async () => publisher.publishAll(await store.list()))
    .catch((e) => console.error("publish failed:", e.message));
  return publishing;
}
```

## The Shares tab decides what leaves

An administrator opens the app's **Shares** tab. Each shared record type is a card with its description and entity name, and one row per field.

- **Fields are not shared until an administrator switches them on.** A field of an app's record type starts **Not shared**, with the badge "Waiting for your decision", and the tab says "N fields are waiting for your decision." Publishing a field does not share it.
- Press **Turn on** on a field. A page asks "Share <field>?", names who would be able to read it (or says no app reads it yet), and has a button **Share <field>**. A field that looks like a contact detail carries the badge "Contact detail" and "Usually kept private."
- Press **Turn off** on a shared field. This takes effect at once and removes that field's values from the platform's copy of the records. Your app's own data is untouched.
- The card's **Who can read this** list names the apps, groups and people who can read the record type.
- An app that publishes nothing shows "Your app doesn't share anything yet."

Nobody can read a shared record type until an administrator has switched on its fields and a reader has been given access.

## Reading what others share

Reading another app's records is not self-serve. A reader needs access created for it by your VMnodes contact, and there is no key in `vmnodes.json` to ask for it. The **Shares** tab does not grant it.

> **Coming:** reading another app's shared data from a portal app. Today it needs your VMnodes contact.

## Related

- [Share data](../how-to/share-data.md)
- [Read shared data](../how-to/read-shared-data.md)
- [The publish API](../reference/publish-api.md)
- [Data](data.md)
