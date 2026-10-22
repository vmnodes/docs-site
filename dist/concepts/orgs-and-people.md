# Orgs and people

Understand who can do what in an org: who is an administrator, who is a member, and how a person gets into an app. Read this before you plan who will use the app you are building.

## Org

An org is a customer organisation on VMnodes. It has a short name, its slug (3 to 30 lowercase letters, digits and hyphens), and its portal is at `apps.<slug>.vmnodes.com`. Its apps live at `<app>.<slug>.vmnodes.com`. The examples in these docs use the org `acme`.

- **How an org starts.** Sign-up is by invite today. An invite code comes from your VMnodes contact, and so does the sign-up address. Self-serve sign-up is not open.
- **What an org owns.** Its people, its apps, its shared data and its compute. **Get compute** creates the host that runs the org's apps. Your plan sets how many hosts the org may have; a second request past the limit answers "Your plan includes <n> host(s)."

## Administrator

An administrator is an org member who runs the org's apps in the portal. The person who signs the org up is its first administrator. Only an administrator can:

- press **Put an app online** and **Update to latest commit**;
- use **Change roles**, attach a group, and read the **People** and **Shares** tabs;
- turn shared fields on and off in the **Shares** tab;
- open **Usage** and **Console** (logs and roll back).

A member who is not an administrator sees the **Overview** tab of an app and nothing more. If they open an administrator screen they get "Nothing to see here" or "Nothing to launch here".

## Member

A member is a person in the org's directory. Only members can sign in to the portal or to any of the org's apps. A person who is not a member receives no sign-in code and gets the same answer as an unknown email address.

> **Trap:** a portal session cannot add a person to the org. The **People** tab lists people who are already members and gives them roles; it has no invite button. Ask your VMnodes contact to add anyone new, before you plan an app that needs a second person.

## Access

Access means being let into one app. It is separate from being an administrator and separate from a role.

- Every app has its own list of who may open it. A member who is not on the list sees the page "Not authorised": "Your account is signed in, but it has no entitlement to this application." This is true for administrators too.
- The person who puts an app online gets access to it at once, and every role the app declares.
- Giving someone a role also gives them access. Taking a role away does not take away access.
- Attaching a group on the **People** tab gives everyone in the group access, including people added to the group later, and optionally one role. You cannot remove a group from that page yet, and a group can only be created by your VMnodes contact.
- **Your apps** lists only the apps the signed-in person has access to.

Anyone outside the org cannot be given access. There is no sign-up page for an app's own customers.

> **Coming:** letting an app's own customers sign themselves up. Today only org members can use an app.

## Related

- [Roles](roles.md)
- [Sign-in and identity](sign-in-and-identity.md)
- [Apps](apps.md)
- [Limits](../reference/limits.md)
