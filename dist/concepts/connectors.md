# Connectors

Understand what a connector is and which ones an administrator can set up in the portal today. Read this when your app needs to read a private repository, or needs mail, AI or a directory of people.

A connector links your org to an outside service. GitHub is the only connector an administrator connects in the portal. Mail, AI and directory need your VMnodes contact.

## GitHub

GitHub is how VMnodes reads a private repository when it builds your app. A public repository needs no connector: paste its `https://` address.

**Connect GitHub** appears on the **Put an app online** page, in the section **1. Where is the code?**, while the org has no GitHub connection that can read a repository. Only an administrator sees that page.

1. Press **Connect GitHub**.
2. On GitHub's own screen, install VMnodes Builds against the repository, or the whole account, and you are brought back.
3. The page now reads "GitHub is connected as" and the account name, and a **Repository** list shows the repositories VMnodes can read. It lists the first 100. For others, open **Can't see your repo? Paste its URL**.

It worked when your private repository is in the **Repository** list.

- **One GitHub account connects to one org.** A second org that tries the same account is refused with "This GitHub account is already connected to a different organisation on VMnodes." and is not told which org holds it. Ask your VMnodes contact.
- **A GitHub organisation owner may need to approve first.** You see "Your GitHub organisation owner needs to approve VMnodes Builds. Once they have, press Connect again." Press **Connect GitHub** again after they have.
- **A private repository must be given to VMnodes Builds on GitHub** before it appears in the list. If a launch says "We can't read that repository. If it's private, connect GitHub first, then try again.", connect GitHub or give the app access to that repository.
- **Never put a username, password or token in a repository address.** It is refused with "Remove the username, password or token from the repository URL. Private repositories connect through GitHub instead." Use **Connect GitHub**.
- **Disconnecting GitHub is not possible in the portal today.** Ask your VMnodes contact.

An update reads the same repository through the same connection, so the connection must stay in place for **Update to latest commit** to work on a private repository.

## Mail, AI and directory

Sending mail, asking an AI model to complete text, and looking up or inviting people in the org's directory are not available to an app you put online from the portal. Your app receives no setting for them. Ask your VMnodes contact if your app needs one of them.

## Related

- [Getting started](../getting-started.md)
- [Apps](apps.md)
- [Orgs and people](orgs-and-people.md)
- [Limits](../reference/limits.md)
