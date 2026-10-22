# Roles

Understand how an app declares roles, how an administrator gives them to people, and how the app checks them. Read this before you let anyone do something that only some people should do.

A role is a name like `starter.editor` that your app checks. The app declares it, an administrator gives it to people, and the identity header carries it into every request.

## Declare roles in `vmnodes.json`

Roles live in `vmnodes.json` at the repository root. This is the starter's whole file:

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

- Every role needs a `description`. It is what an administrator reads before giving the role, so say what the person can then do, in plain words.
- A name is lowercase letters, digits and hyphens, starts with a letter, and has at most one dot: `leave-requests.approver`. Each side of the dot is 2 to 31 characters. Most apps use their own name before the dot. `Leave_Requests.Approver` is refused.
- A name must be declared once. A mistake in the file (an unknown key, a bad name, a duplicate, a missing description) stops the build, and the launch page shows only a generic sentence. Check the file against [`vmnodes.json`](../reference/vmnodes-json.md) before you push.
- VMnodes reads the file from the exact commit it builds. No file means the app has no roles.
- The file must be an ordinary file under 64 KiB. A symlink is refused.

The part before the dot need not match the app's name. The starter keeps the two apart in `server.js`: the app's name comes from `VMNODES_APP_NAME`, and the role prefix is a constant.

```js
// Must match the role names in vmnodes.json exactly ("starter.editor").
const ROLE_PREFIX = "starter";
const EDITOR_ROLE = `${ROLE_PREFIX}.editor`;
```

> **Trap:** the string in `vmnodes.json` and the string your code checks must be identical. A role your code checks but `vmnodes.json` does not declare can never be given to anyone.

## Give roles to people

Declaring a role gives it to nobody except the person who launches the app.

- **At launch** the person who puts the app online gets every role the app declares. The launch page says "You have every role acme-notes declares: starter.editor."
- **After that** an administrator opens the app's **People** tab, presses **Change roles** on a person, ticks roles and presses **Save roles**. The person's row then lists them, or reads "No roles".
- **An update does not give new roles.** When a later commit adds a role, nobody has it, not even you. Give it with **Change roles**.
- **A role gives access.** Giving someone a role also lets them open the app. Taking a role away does not take away access.
- **A group can carry a role.** Attach a group on the **People** tab and pick a role: everyone in the group holds it, including people added later. A role someone holds through a group arrives in `roles` the same way.
- **No declared roles, nothing to give.** The **People** tab reads "No roles yet" and "<app> has not declared any roles, so there is nothing to assign here."

A role reaches your app on the person's next request, in `user.roles`. Nothing is cached and nothing is redeployed.

## Check roles on the server

Check the role in the server on every request that needs it. Hiding a button stops nobody who sends the request directly.

```js
identity.requireRole(user, EDITOR_ROLE); // checked on the SERVER. Hiding a button is not security.
```

`requireRole` throws an `IdentityError` with status 403 and the message `role 'starter.editor' required`. Return that status to the caller. A 403 from your app means the person is signed in and has access but lacks the role. It is not the gateway's "Not authorised" page, which means the person has no access at all. See [Sign-in and identity](sign-in-and-identity.md).

Test both directions before you call a role check done: a person without the role gets 403, and a person with it gets through. Locally, `/_as/reader` and `/_as/editor` sign you in as each.

## Retired roles

Taking a role out of `vmnodes.json` retires it when that commit deploys. A retired role no longer arrives in `user.roles` and cannot be given to anyone. People who held it stay listed.

- The **People** tab shows a notice, for example "2 people hold roles your app no longer uses". It opens a page headed "Clear roles your app no longer uses" with a **Clear all** button. Clearing removes the role from them and not their access.
- A commit with no `vmnodes.json` declares no roles, so deploying it retires them all.
- Putting the role back in `vmnodes.json` makes it available again but gives it to nobody. The **People** tab offers **Give it back to N people who had it**, and an administrator decides.

## Related

- [Sign-in and identity](sign-in-and-identity.md)
- [`vmnodes.json`](../reference/vmnodes-json.md)
- [Orgs and people](orgs-and-people.md)
- [Submit and approve](../how-to/approvals.md)
