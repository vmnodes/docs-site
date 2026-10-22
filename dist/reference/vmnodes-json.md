# vmnodes.json reference

`vmnodes.json` is the file at your repository's root that tells VMnodes which roles your app checks, whether it needs a database, and which records it shares. Read this page when you write or change that file, or when a launch or update refuses it.

## Example

A complete file:

```json
{
  "apiVersion": "vmnodes.com/v1",
  "roles": [
    { "name": "expenses.submitter", "description": "Can submit expense claims." },
    { "name": "expenses.approver", "description": "Can approve or reject expense claims submitted by others." }
  ],
  "database": true,
  "publishes": ["claim/v1"]
}
```

The smallest useful file, for an app that has no roles, no database and shares nothing:

```json
{ "apiVersion": "vmnodes.com/v1" }
```

An app can also have no `vmnodes.json` at all. A missing file reads as no roles, no database and nothing shared.

## File rules

- The file is named `vmnodes.json` and sits at the repository root. Files in subdirectories are not read.
- It is read from the exact commit that is built, on a launch and on every update. Commit the file before you launch or update.
- It must be a regular file. A symbolic link or a directory is refused.
- It must be at most 64 KiB (65,536 bytes).
- It must be strict JSON: no comments, no trailing commas, no byte-order mark. A comma after the last item gives `vmnodes.json is not valid JSON`.
- Only the four keys below are allowed. Any other key is refused.
- The first problem found is the one reported. Fix it, commit, and try again; the next problem, if any, is reported then. The checks run in this order: valid JSON, top-level object, unknown keys, `apiVersion`, `database`, `publishes`, `roles`.

## Keys

| Key | Type | Default | Meaning |
|---|---|---|---|
| `apiVersion` | string | none (required when the file exists) | Must be exactly `vmnodes.com/v1`. |
| `roles` | array of `{name, description}` | `[]` | The roles your app checks. |
| `database` | boolean | `false` | Whether your app gets a PostgreSQL database. |
| `publishes` | array of strings | `[]` | The kinds of record your app shares with other apps. |

A key set to `null` is refused. Leave the key out instead.

### apiVersion

The value is the string `vmnodes.com/v1`. Any other value, or a missing key, is refused.

### roles

Each role is an object with a `name` and a `description`.

```json
"roles": [
  { "name": "expenses.approver", "description": "Can approve or reject expense claims submitted by others." }
]
```

**Name.** A role name is lowercase kebab-case, optionally with one dot. In words: one or two segments joined by a single dot; each segment is 2 to 31 characters, starts with a letter, and continues with lowercase letters, digits or hyphens. The regular expression is:

```
^[a-z][a-z0-9-]{1,30}(\.[a-z][a-z0-9-]{1,30})?$
```

`approver`, `expenses.approver` and `hr-team.line-manager` are valid. `Approver`, `approver.`, `a.b` (segments too short) and `a.b.c` (two dots) are not. The part before the dot does not have to match your app's name. Use the same name in your code, for example `identity.requireRole(user, "expenses.approver")`.

**Description.** Required. The description is trimmed, and a description that is only spaces is refused. An administrator reads it in the portal before giving the role to someone, so write what the role lets a person do, in plain English.

Each role name appears once. Extra keys inside a role object are ignored.

### database

`true` gives your app a PostgreSQL database. `false`, or leaving the key out, gives it none. See [Changes between commits](#changes-between-commits) for what happens when the value changes.

### publishes

Each entry names one kind of record your app shares, as `<local>/vN`:

```json
"publishes": ["claim/v1"]
```

- `<local>` is lowercase, starts with a letter, and continues with lowercase letters, digits or hyphens: `^[a-z][a-z0-9-]*$`. It has no length limit and no dot.
- `/vN` is the version: `v` followed by a whole number from 1, with no leading zero. `v1` and `v12` are valid. `v0` and `v01` are not.
- Each entry appears once.

You write the local name only. The platform puts your app's name in front: the entry `note/v1` in an app named `crm` is the entity `crm.note`, version 1. In the publish calls you use the prefixed name `crm.note` and a separate `version` field; see [Publish and query API](publish-api.md).

An entry is a declaration, not a registration. Your app still has to register the entity once it is live. Registering an entity the live version does not declare is refused with `publish/not-declared`.

## Changes between commits

VMnodes compares what the file declares now with what the app had before, and applies the difference during the deploy. It does this before the new version starts, so if the new version then fails its health check, the old version keeps serving but the changes below have already been applied.

### Roles

- **Added roles** are defined. Nobody holds them until an administrator gives them. A launch gives the person who launched the app every declared role, and an update does not give anyone a newly declared role.
- **Removed roles** are retired. A retired role stops appearing in `user.roles`, nobody can be given it, and people who hold it stay listed and keep access to the app. A missing file, or `"roles": []`, retires every role the file declared.
- **A role you declare again** stops being retired. It does not give the role back to anyone. In the portal, the role shows **Give it back to N people who had it**, and the role list offers **Clear roles your app no longer uses** with a **Clear all N** button.
- Roles an administrator assigned by hand, and roles declared only by an advanced-path extension, are never retired by this comparison.

### Database

- `"database": true` creates a PostgreSQL database before your app starts and waits for it to be ready (up to 2 minutes). Your app receives its connection string as `DATABASE_URL`; see [Environment variables](environment.md). All environments of the app share one database.
- Removing the key, or setting it to `false`, does not delete the database or the `DATABASE_URL` value. The portal says "This app still has its database, and keeps it, although vmnodes.json no longer asks for one."
- An app without a database loses anything it stored in its container on every update. The portal says "Updating replaces your app's container. Anything not saved in its database is cleared."

### Publishes

- This applies to production deploys. A launch from the portal is a production deploy.
- **A non-empty list** gives the app a publish token the first time. The platform stores it as the secret `VMNODES_PUBLISH_TOKEN`, with the address `VMNODES_API_URL`. The token is not rotated on later updates. If the token exists but the app's secret is missing, the token is replaced.
- **An empty or missing list** revokes the token and removes both values at the start of the deploy.
- **An entity you remove from the list** is retired. Its records are kept, and new publishes to it are refused with `publish/retired`. Add it back, deploy, and register it again to bring it back.
- If the platform cannot create or deliver the token, the deploy fails with `deploy/publish-token-failed`.
- The live version's list is what the platform checks when your app registers an entity. During an update, the previous version's list applies until the new version is live.

## Errors

Each message below is what a rejected `vmnodes.json` reports. `<i>` is the zero-based position of the entry in its array, so the first role is `roles[0]`. `<entry>`, `<name>`, `<key>` and `<json>` stand for the offending value.

### File

- `vmnodes.json must be a regular file, not a symlink or directory`
- `vmnodes.json is larger than 64 KiB`
- `vmnodes.json is not valid JSON`
- `vmnodes.json must be a JSON object`

### Keys

- `vmnodes.json declares an unknown key '<key>' — only 'apiVersion', 'roles', 'database', 'publishes' are recognised here`
- `vmnodes.json apiVersion must be 'vmnodes.com/v1', got <json>`. A missing key prints `got undefined`.
- `vmnodes.json 'database' must be true or false, got <json>`

### Roles

- `vmnodes.json 'roles' must be an array`
- `roles[<i>] must be an object with 'name' and 'description'`
- `roles[<i>].name must be a string`
- `roles[<i>] ('<name>') is not a usable role name: role names are lowercase kebab-case, optionally namespaced with one dot`
- `roles[<i>] declares '<name>' a second time — each role is declared once`
- `roles[<i>] ('<name>') has no description — every role shown to a human needs a plain-English consequence`

### Publishes

- `vmnodes.json 'publishes' must be an array`
- `publishes[<i>] must be a string`
- `publishes[<i>] ('<entry>') is not a usable publishes entry: <problem>`
- `publishes[<i>] declares '<entry>' a second time — each entity is declared once`

`<problem>` is one of these:

- `a publishes entry must be a non-empty string`
- `'<entry>' has no version — a publishes entry is '<local>/vN'`
- `'<entry>' has a dot in its local name — the namespace is supplied at publish time, not written here`
- `'<entry>': the local name must be lowercase, starting with a letter, then lowercase letters, digits or hyphens`
- `'<entry>': the version must be 'vN' with N a whole number`
- `'<entry>': the version must not have a leading zero`
- `'<entry>': the version must be a positive integer`

### Where the message appears

The portal's launch page shows a fixed set of sentences. A refused `vmnodes.json` shows there as `We couldn't read that repository or build it. Try again, or check the repository is public or GitHub is connected.` The exact message above is available to your VMnodes contact; ask them for it, and compare your file with the rules on this page first.

## Related

- [Roles](../concepts/roles.md)
- [Environment variables](environment.md)
- [Publish and query API](publish-api.md)
- [Build, run and security checks](build-and-run.md)
