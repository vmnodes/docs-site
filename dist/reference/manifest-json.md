# manifest.json reference

`manifest.json` is the advanced way to put an app on VMnodes. It is run by your VMnodes contact: they sign the manifest, submit it and approve the install. Read this page only when an app has to declare actions that other apps can trigger, consume other apps' shared data as an installed extension, or ask for a mail, directory or AI permission. An app that only needs sign-in, roles, a database and sharing goes online from the portal with [`vmnodes.json`](vmnodes-json.md) instead.

> **Operator-run.** You cannot submit a manifest from the portal. Ask your VMnodes contact to submit it, and send them the manifest and the image to install.

## When to use which file

| You need | Use |
|---|---|
| Roles, a database, sharing your records, from a repository an administrator launches | `vmnodes.json` and **Put an app online** |
| Actions other apps trigger, consuming shared data as an extension, mail, directory or AI permissions | `manifest.json`, through your VMnodes contact |

One repository can carry both files; the starter does. They are separate declarations. `vmnodes.json` lists `publishes` as `note/v1`, with no app name. `manifest.json` lists `data.publishes` as `starter.note/v1`, with the name in front.

An app installed by manifest runs the image you built, pinned by digest. The portal's **Update to latest commit** does not apply to it; a new version is a new manifest with a higher version number.

## Example

```json
{
  "apiVersion": "vmnodes.com/v1",
  "kind": "Extension",
  "metadata": {
    "name": "starter",
    "version": "0.1.0",
    "publisher": "your-org",
    "description": "A team noticeboard"
  },
  "runtime": {
    "image": "SET-AT-RELEASE@sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "port": 3000,
    "healthEndpoint": "/health",
    "database": false,
    "resources": { "memory": "512Mi" }
  },
  "data": {
    "publishes": ["starter.note/v1"],
    "consumes": []
  },
  "permissions": {
    "templates": ["starter.editor"]
  }
}
```

The all-zero `runtime.image` is a placeholder that is correct in your repository until the image is built, and it is refused at submission on purpose.

## Fields

| Field | Rule |
|---|---|
| `apiVersion` | Exactly `vmnodes.com/v1`. |
| `kind` | Exactly `Extension`. |
| `metadata.name` | Starts with a lowercase letter, then lowercase letters, digits or hyphens: `^[a-z][a-z0-9-]*$`. Your entities and roles are named from it. |
| `metadata.version` | `MAJOR.MINOR.PATCH`, three whole numbers, such as `0.1.0`: `^\d+\.\d+\.\d+$`. No `v` prefix and no suffix. |
| `metadata.publisher` | Required. A publisher your VMnodes contact has set up. Anything else is refused. |
| `metadata.description` | Free text. |
| `runtime.image` | `<registry>/<repo>@sha256:<64 hex characters>`: one exact image, never a tag. Your VMnodes contact tells you which registry. |
| `runtime.port` | A whole number from 1 to 65535. It must be the port your app listens on. |
| `runtime.healthEndpoint` | Optional. The path the platform checks. |
| `runtime.database` | Optional boolean. `true` creates a database and sets `DATABASE_URL`. |
| `runtime.resources.memory` | Optional. Up to `512Mi` runs with a 512 MiB maximum, up to `2048Mi` with 2048 MiB, above that with 4096 MiB. Leaving it out gives 512 MiB. |
| `runtime.resources.cpu`, `runtime.resources.storage` | Accepted and ignored. |
| `data.publishes` | List of `<metadata.name>.<thing>/vN`. The part before the first dot must be `metadata.name`. Keep the `/vN`. The rest follows [the `publishes` rules](vmnodes-json.md#publishes). |
| `data.consumes` | List of entity names with **no** `/vN`. A grant covers the entity at every version. |
| `actions` | See [Actions](#actions). |
| `permissions.templates` | List of role names. Each must follow the [role name rules](vmnodes-json.md#roles). They are shown to the person approving the install; they do not stop an administrator giving other roles. |
| `permissions.proposes` | List of `namespace.name` actions the app may propose, with no suffix. |
| `permissions.mail.send` | Boolean. |
| `permissions.directory.inviteCustomers`, `permissions.directory.lookupPeople`, `permissions.directory.listGroupMembers` | Booleans. |
| `permissions.ai.complete` | Boolean. |

Each permission above must be a real JSON `true` or `false`. A string or number such as `"true"` or `1` is refused.

### Actions

`actions` is an array. Each item is either an action name, or an object:

| Key | Rule |
|---|---|
| `name` | Required. `<metadata.name>.<action>`. |
| `description` | Required. What an approver reads before a run. |
| `inputSchema` | Required. A JSON object. |
| `risk` | Required. `low`, `moderate` or `high`. |
| `approvalPolicy` | Required. `none` or `required`. `high` risk needs `required`. |
| `callback.path` | Required. A path on the app's own address, starting with `/`, with no `//` and no `://`. |
| `outputSchema`, `timeoutSeconds`, `maxPerHour`, `compensation`, `derivedInputs` | Optional. |

### What the permissions become

The app's token is given the scope `publish` always, plus `mail.send`, `directory.invite-customers`, `directory.lookup`, `directory.group-members` and `ai.complete` for each permission set to `true`.

## What an install does

An install creates the app, issues its token and secrets, grants access to each entity in `data.consumes` and each action in `permissions.proposes`, creates the database when `runtime.database` is `true`, scans the image, starts it and checks it answers. The person who approves the install is given access, and the first role in `permissions.templates` that ends in `.admin` (such as `starter.admin`), when the manifest lists one.

A new version (an upgrade) keeps the name and the publisher and must have a higher version. If it widens what the app can do, by adding to what it consumes, publishes, proposes or asks for, it waits as pending approval until a person approves the wider access. Removing something never waits. If an upgrade seems to have done nothing, check for a pending approval before sending it again.

## Errors

A rejected manifest reports the first problem found. `<name>`, `<entity>`, `<path>` and the like stand for your values.

### Shape and identity

- `manifest must be an object`
- `apiVersion must be vmnodes.com/v1`
- `kind must be Extension`
- `metadata.publisher is required`
- `publisher '<publisher>' is not trusted on this control plane`
- `manifest signature does not verify against the publisher key`
- `manifest signature is malformed`
- `metadata.name must be lowercase letters, digits, hyphens`
- `metadata.version must be MAJOR.MINOR.PATCH`

### Runtime

- `runtime.image is still the release placeholder — patch it with the built digest before signing`
- `runtime.image must be pinned to a digest (<registry>/<repo>@sha256:<64 hex>)`
- `runtime.port must be a port number`

### Data and permissions

- `published entity '<entity>' is outside the '<name>.*' namespace`
- `published entity '<entity>': <problem>`, where `<problem>` is one of the [`publishes` problems](vmnodes-json.md#publishes)
- `'<entity>' must not carry a version suffix: a grant covers the entity, all versions, so the suffix asserts a scope the platform does not enforce. Use '<entity-without-suffix>'.`
- `requested action '<action>' is not a namespace.name action`
- `role template '<template>' is not a usable role name: <problem>`
- `<path> must be true or false, not <json> — it rides a token scope and an approval screen, and anything else reads as granted in one place and not the other`

### Actions

- `action '<action>' is outside the '<name>.*' namespace`
- `actions[<i>] must be an action name or an action declaration object`
- `actions[<i>] declares no name`
- `action '<name>' declares no description, which is what a human reads before approving a run`
- `action '<name>' declares no inputSchema object`
- `action '<name>' must declare risk as one of low, moderate, high`
- `action '<name>' must declare approvalPolicy as one of none, required`
- `action '<name>' is high risk, so approvalPolicy must be 'required'`
- `action '<name>' must declare callback.path as a path on its own hostname, starting with '/'`
- `action '<name>' declares callback.path '<path>', which names a host — it must be a path on the extension's own hostname`

### Install and upgrade

- `extension '<name>' is <status> — use upgrade, or remove it first`
- `version <new> is not newer than installed <installed>`
- `an upgrade keeps the extension name`
- `an upgrade keeps the publisher`

## Related

- [vmnodes.json reference](vmnodes-json.md)
- [Publish and query API](publish-api.md)
- [Sharing data with other apps](../concepts/sharing.md)
- [Limits and what is not possible yet](limits.md)
